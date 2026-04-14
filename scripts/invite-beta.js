#!/usr/bin/env node
// scripts/invite-beta.js
// Invite des utilisateurs beta via Supabase Admin API.
// Usage :
//   node scripts/invite-beta.js user@example.com "Notes sur ce testeur"
//   node scripts/invite-beta.js --list    → affiche les invitations existantes
//
// Requiert : SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY dans l'environnement

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error('❌ SUPABASE_URL et SUPABASE_SERVICE_ROLE_KEY requis')
  process.exit(1)
}

const args = process.argv.slice(2)

async function supabaseAdmin(path, options = {}) {
  const url = `${SUPABASE_URL}${path}`
  const res = await fetch(url, {
    ...options,
    headers: {
      apikey: SERVICE_KEY,
      Authorization: `Bearer ${SERVICE_KEY}`,
      'Content-Type': 'application/json',
      ...options.headers,
    },
  })
  if (!res.ok) {
    const body = await res.text()
    throw new Error(`Supabase error ${res.status}: ${body}`)
  }
  return res.json()
}

async function inviteUser(email, notes) {
  console.log(`\n📧 Invitation de ${email}...`)

  // Créer l'invitation via Supabase Auth Admin API
  const user = await supabaseAdmin('/auth/v1/admin/invite', {
    method: 'POST',
    body: JSON.stringify({ email }),
  })

  // Enregistrer dans beta_invitations
  await supabaseAdmin('/rest/v1/beta_invitations', {
    method: 'POST',
    headers: { Prefer: 'return=minimal' },
    body: JSON.stringify({
      email,
      notes: notes || null,
    }),
  })

  console.log(`✅ Invitation envoyée à ${email} (user ID: ${user.id})`)
  console.log(`   Lien d'invitation dans votre dashboard Supabase Auth`)
}

async function listInvitations() {
  const rows = await supabaseAdmin('/rest/v1/beta_invitations?order=invited_at.desc&limit=50', {
    method: 'GET',
  })

  if (!rows.length) {
    console.log('Aucune invitation beta pour le moment.')
    return
  }

  console.log('\n📋 Invitations beta :')
  console.log('─'.repeat(60))
  for (const row of rows) {
    const status = row.accepted_at ? '✅ acceptée' : '⏳ en attente'
    console.log(`${status}  ${row.email.padEnd(35)} ${row.invited_at?.split('T')[0]}`)
    if (row.notes) console.log(`         ${row.notes}`)
  }
}

;(async () => {
  try {
    if (args[0] === '--list') {
      await listInvitations()
    } else if (args[0]) {
      const email = args[0]
      const notes = args[1]
      if (!email.includes('@')) {
        console.error('❌ Email invalide')
        process.exit(1)
      }
      await inviteUser(email, notes)
    } else {
      console.log('Usage:')
      console.log('  node scripts/invite-beta.js user@example.com "Notes"')
      console.log('  node scripts/invite-beta.js --list')
      process.exit(1)
    }
  } catch (err) {
    console.error('❌', err.message)
    process.exit(1)
  }
})()
