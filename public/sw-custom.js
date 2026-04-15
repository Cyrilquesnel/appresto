// ═══ PUSH NOTIFICATIONS ═══
self.addEventListener('push', (event) => {
  if (!event.data) return
  const payload = event.data.json()
  event.waitUntil(
    self.registration.showNotification(payload.title, {
      body: payload.body,
      icon: payload.icon ?? '/icons/icon-192.png',
      badge: payload.badge ?? '/icons/icon-192.png',
      data: payload.data,
    })
  )
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const url = event.notification.data?.url ?? '/'
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
      const existing = clients.find((c) => c.url.includes(self.registration.scope))
      if (existing) {
        existing.focus()
        existing.postMessage({ type: 'NAVIGATE', url })
      } else {
        self.clients.openWindow(url)
      }
    })
  )
})

// ═══ OFFLINE SYNC ═══
const DB_NAME = 'onrush-sync'
const STORE_NAME = 'pms-queue'
const SYNC_TAG = 'pms-sync'

const PMS_ROUTES = ['/api/trpc/pms.saveTemperatureLog', '/api/trpc/pms.saveChecklistCompletion']

function openDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1)
    request.onupgradeneeded = (e) => {
      const db = e.target.result
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'id' })
      }
    }
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
}

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url)
  const isPMSRoute = PMS_ROUTES.some((route) => url.pathname.startsWith(route))
  if (!isPMSRoute) return

  event.respondWith(
    fetch(event.request.clone()).catch(async () => {
      const db = await openDB()
      const body = await event.request.clone().text()
      const record = {
        id: crypto.randomUUID(),
        url: event.request.url,
        method: event.request.method,
        headers: Object.fromEntries(event.request.headers.entries()),
        body,
        timestamp: Date.now(),
      }

      await new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, 'readwrite')
        tx.objectStore(STORE_NAME).add(record)
        tx.oncomplete = resolve
        tx.onerror = reject
      })

      if (self.registration.sync) {
        await self.registration.sync.register(SYNC_TAG)
      }

      return new Response(JSON.stringify({ result: { data: { queued: true } } }), {
        headers: { 'Content-Type': 'application/json' },
      })
    })
  )
})

self.addEventListener('sync', (event) => {
  if (event.tag === SYNC_TAG) {
    event.waitUntil(flushQueue())
  }
})

async function flushQueue() {
  const db = await openDB()
  const records = await new Promise((resolve) => {
    const tx = db.transaction(STORE_NAME, 'readonly')
    const req = tx.objectStore(STORE_NAME).getAll()
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => resolve([])
  })

  for (const record of records) {
    try {
      const response = await fetch(record.url, {
        method: record.method,
        headers: record.headers,
        body: record.body,
      })
      if (response.ok) {
        await new Promise((resolve) => {
          const tx = db.transaction(STORE_NAME, 'readwrite')
          tx.objectStore(STORE_NAME).delete(record.id)
          tx.oncomplete = resolve
        })
        console.log('[sw] Synced PMS record:', record.id)
      }
    } catch (err) {
      console.error('[sw] Failed to sync:', record.id, err)
    }
  }

  const clients = await self.clients.matchAll()
  clients.forEach((client) => client.postMessage({ type: 'PMS_SYNC_COMPLETE' }))
}
