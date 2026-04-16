#!/usr/bin/env node
/**
 * scripts/seed-test-restaurant.js
 *
 * Crée un restaurant de test complet pour les flows E2E.
 * Idempotent — supprime l'existant avant de recréer.
 *
 * Usage :
 *   node scripts/seed-test-restaurant.js          → crée le restaurant de test
 *   node scripts/seed-test-restaurant.js --reset  → supprime puis recrée
 *   node scripts/seed-test-restaurant.js --delete → supprime uniquement
 *
 * Requiert : NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY dans .env.local
 */

// Charger .env.local
const fs = require('fs')
const path = require('path')

const envPath = path.join(__dirname, '..', '.env.local')
if (fs.existsSync(envPath)) {
  const lines = fs.readFileSync(envPath, 'utf8').split('\n')
  for (const line of lines) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const idx = trimmed.indexOf('=')
    if (idx === -1) continue
    const key = trimmed.slice(0, idx).trim()
    const value = trimmed.slice(idx + 1).trim()
    if (!process.env[key]) process.env[key] = value
  }
}

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error('❌ NEXT_PUBLIC_SUPABASE_URL et SUPABASE_SERVICE_ROLE_KEY requis')
  process.exit(1)
}

const TEST_EMAIL = 'test-e2e@lerush.app'
const TEST_PASSWORD = 'TestE2E_LeRush2026!'
const TEST_RESTAURANT_NOM = '[TEST E2E] Le Rush Demo'

// ── Helpers ──────────────────────────────────────────────────────────────────

async function api(path, options = {}) {
  const res = await fetch(`${SUPABASE_URL}${path}`, {
    ...options,
    headers: {
      apikey: SERVICE_KEY,
      Authorization: `Bearer ${SERVICE_KEY}`,
      'Content-Type': 'application/json',
      Prefer: options.prefer || 'return=representation',
      ...options.headers,
    },
  })
  const text = await res.text()
  if (!res.ok) throw new Error(`[${res.status}] ${path} → ${text}`)
  try {
    return JSON.parse(text)
  } catch {
    return text
  }
}

async function authAdmin(path, options = {}) {
  const res = await fetch(`${SUPABASE_URL}/auth/v1/admin${path}`, {
    ...options,
    headers: {
      apikey: SERVICE_KEY,
      Authorization: `Bearer ${SERVICE_KEY}`,
      'Content-Type': 'application/json',
    },
  })
  const text = await res.text()
  if (!res.ok && res.status !== 422) throw new Error(`[${res.status}] auth${path} → ${text}`)
  try {
    return { status: res.status, data: JSON.parse(text) }
  } catch {
    return { status: res.status, data: text }
  }
}

// ── Suppression ───────────────────────────────────────────────────────────────

async function deleteExisting() {
  console.log('\n🗑️  Suppression des données de test existantes...')

  // Trouver le restaurant de test
  const restaurants = await api(
    `/rest/v1/restaurants?nom=eq.${encodeURIComponent(TEST_RESTAURANT_NOM)}&select=id,owner_id`
  )

  for (const r of restaurants) {
    const rid = r.id

    // Supprimer dans l'ordre des dépendances
    const tables = [
      `fiche_technique?plat_id=in.(select id from plats where restaurant_id=eq.${rid})`,
      `plats?restaurant_id=eq.${rid}`,
      `mercuriale?restaurant_id=eq.${rid}`,
      `bons_de_commande?restaurant_id=eq.${rid}`,
      `fournisseurs?restaurant_id=eq.${rid}`,
      `restaurant_ingredients?restaurant_id=eq.${rid}`,
      `equipements?restaurant_id=eq.${rid}`,
      `restaurant_users?restaurant_id=eq.${rid}`,
      `restaurants?id=eq.${rid}`,
    ]

    for (const table of tables) {
      try {
        await api(`/rest/v1/${table}`, { method: 'DELETE', prefer: 'return=minimal' })
      } catch (e) {
        // ignore — table peut ne pas exister encore
      }
    }
    console.log(`   ✅ Restaurant ${rid} supprimé`)

    // Supprimer l'user
    if (r.owner_id) {
      await authAdmin(`/users/${r.owner_id}`, { method: 'DELETE' })
      console.log(`   ✅ User ${r.owner_id} supprimé`)
    }
  }

  if (!restaurants.length) console.log('   (aucun restaurant de test trouvé)')
}

// ── Création ──────────────────────────────────────────────────────────────────

async function createTestRestaurant() {
  console.log('\n🚀 Création du restaurant de test E2E...')

  // 1. Créer l'user de test
  console.log(`\n1️⃣  User: ${TEST_EMAIL}`)
  let userId

  const existing = await authAdmin(`/users?email=${encodeURIComponent(TEST_EMAIL)}`)
  const existingUser = existing.data?.users?.[0]

  if (existingUser) {
    userId = existingUser.id
    // Mettre à jour le mot de passe
    await authAdmin(`/users/${userId}`, {
      method: 'PUT',
      body: JSON.stringify({ password: TEST_PASSWORD, email_confirm: true }),
    })
    console.log(`   ✅ User existant mis à jour (${userId})`)
  } else {
    const created = await authAdmin('/users', {
      method: 'POST',
      body: JSON.stringify({
        email: TEST_EMAIL,
        password: TEST_PASSWORD,
        email_confirm: true,
        user_metadata: { full_name: 'Test E2E' },
      }),
    })
    userId = created.data.id
    console.log(`   ✅ User créé (${userId})`)
  }

  // 2. Créer le restaurant
  console.log('\n2️⃣  Restaurant...')
  const [restaurant] = await api('/rest/v1/restaurants', {
    method: 'POST',
    body: JSON.stringify({
      nom: TEST_RESTAURANT_NOM,
      type: 'restaurant',
      owner_id: userId,
      adresse: {
        rue: '1 Rue de la République',
        ville: 'Paris',
        cp: '75001',
      },
      parametres: {
        devise: 'EUR',
        tva_taux: 10,
        food_cost_cible: 30,
      },
    }),
  })
  const restaurantId = restaurant.id
  console.log(`   ✅ Restaurant créé (${restaurantId})`)

  // 3. Lier l'user au restaurant
  console.log('\n3️⃣  Lien user ↔ restaurant...')
  await api('/rest/v1/restaurant_users', {
    method: 'POST',
    body: JSON.stringify({
      restaurant_id: restaurantId,
      user_id: userId,
      role: 'owner',
    }),
  })
  console.log('   ✅ Owner lié')

  // 4. Créer des ingrédients de test (via catalog)
  console.log('\n4️⃣  Ingrédients (restaurant_ingredients)...')

  // Chercher quelques ingrédients existants dans le catalog
  const catalog = await api(
    '/rest/v1/ingredients_catalog?select=id,nom&limit=10&is_verified=eq.true'
  )

  const ingredientIds = []
  for (const cat of catalog.slice(0, 5)) {
    const [ri] = await api('/rest/v1/restaurant_ingredients', {
      method: 'POST',
      body: JSON.stringify({
        restaurant_id: restaurantId,
        catalog_id: cat.id,
      }),
    })
    ingredientIds.push({ id: ri.id, nom: cat.nom })
  }

  // Ajouter un ingrédient custom
  const [customIng] = await api('/rest/v1/restaurant_ingredients', {
    method: 'POST',
    body: JSON.stringify({
      restaurant_id: restaurantId,
      nom_custom: 'Fond de veau maison',
      allergenes_override: [],
    }),
  })
  ingredientIds.push({ id: customIng.id, nom: 'Fond de veau maison' })
  console.log(`   ✅ ${ingredientIds.length} ingrédients créés`)

  // 5. Créer un fournisseur
  console.log('\n5️⃣  Fournisseur...')
  const [fournisseur] = await api('/rest/v1/fournisseurs', {
    method: 'POST',
    body: JSON.stringify({
      restaurant_id: restaurantId,
      nom: 'Metro Test',
      contact_tel: '0123456789',
      contact_email: 'commandes@metro-test.fr',
      notes: 'Fournisseur de test E2E',
    }),
  })
  console.log(`   ✅ Fournisseur créé (${fournisseur.id})`)

  // 6. Créer des entrées mercuriale
  console.log('\n6️⃣  Mercuriale (prix)...')
  const prixMap = [
    { ingredient_id: ingredientIds[0]?.id, prix: 2.5, unite: 'kg' },
    { ingredient_id: ingredientIds[1]?.id, prix: 8.0, unite: 'kg' },
    { ingredient_id: ingredientIds[2]?.id, prix: 1.2, unite: 'kg' },
  ].filter((p) => p.ingredient_id)

  for (const prix of prixMap) {
    await api('/rest/v1/mercuriale', {
      method: 'POST',
      body: JSON.stringify({
        fournisseur_id: fournisseur.id,
        ...prix,
        est_actif: true,
        source: 'manual',
      }),
    })
  }
  console.log(`   ✅ ${prixMap.length} prix créés`)

  // 7. Créer un plat de test
  console.log('\n7️⃣  Plat + Fiche technique...')
  const [plat] = await api('/rest/v1/plats', {
    method: 'POST',
    body: JSON.stringify({
      restaurant_id: restaurantId,
      nom: 'Bœuf bourguignon test',
      statut: 'actif',
      instructions: 'Plat de test pour les flows E2E.',
    }),
  })

  // Fiche technique
  for (let i = 0; i < Math.min(3, ingredientIds.length); i++) {
    await api('/rest/v1/fiche_technique', {
      method: 'POST',
      body: JSON.stringify({
        plat_id: plat.id,
        ingredient_id: ingredientIds[i].id,
        grammage: (i + 1) * 100,
        unite: 'g',
        ordre: i,
      }),
    })
  }
  console.log(`   ✅ Plat "${plat.nom}" + ${Math.min(3, ingredientIds.length)} ingrédients`)

  // 8. Créer un équipement PMS
  console.log('\n8️⃣  Équipement PMS...')
  await api('/rest/v1/equipements', {
    method: 'POST',
    body: JSON.stringify({
      restaurant_id: restaurantId,
      nom: 'Réfrigérateur positif test',
      type: 'frigo',
      temp_min: 0,
      temp_max: 4,
      localisation: 'Cuisine principale',
      frequence_releve: '2x_jour',
      actif: true,
    }),
  })
  console.log('   ✅ Équipement créé')

  // 9. Écrire .env.test
  console.log('\n9️⃣  Écriture .env.test...')
  const envTest = `# Compte de test E2E — NE PAS COMMITTER
# Généré par scripts/seed-test-restaurant.js le ${new Date().toISOString()}

TEST_E2E_EMAIL=${TEST_EMAIL}
TEST_E2E_PASSWORD=${TEST_PASSWORD}
TEST_E2E_RESTAURANT_ID=${restaurantId}
TEST_E2E_USER_ID=${userId}
TEST_E2E_FOURNISSEUR_ID=${fournisseur.id}
TEST_E2E_PLAT_ID=${plat.id}
`
  fs.writeFileSync(path.join(__dirname, '..', '.env.test'), envTest)
  console.log('   ✅ .env.test écrit')

  // ── Résumé ──
  console.log('\n' + '═'.repeat(60))
  console.log('✅ RESTAURANT DE TEST E2E PRÊT')
  console.log('═'.repeat(60))
  console.log(`\n📧 Email    : ${TEST_EMAIL}`)
  console.log(`🔑 Password : ${TEST_PASSWORD}`)
  console.log(`🏪 Restaurant ID : ${restaurantId}`)
  console.log(`\n📁 Credentials dans .env.test (gitignored)`)
  console.log('\nUtilisation dans Playwright :')
  console.log("  import { TEST_E2E_EMAIL, TEST_E2E_PASSWORD } from '../.env.test'")
  console.log('  ou via process.env.TEST_E2E_EMAIL\n')
}

// ── Main ──────────────────────────────────────────────────────────────────────

const args = process.argv.slice(2)

;(async () => {
  try {
    if (args[0] === '--delete') {
      await deleteExisting()
      console.log('\n✅ Suppression terminée')
    } else if (args[0] === '--reset') {
      await deleteExisting()
      await createTestRestaurant()
    } else {
      await deleteExisting()
      await createTestRestaurant()
    }
  } catch (err) {
    console.error('\n❌', err.message)
    process.exit(1)
  }
})()
