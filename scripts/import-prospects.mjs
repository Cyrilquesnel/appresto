#!/usr/bin/env node
/**
 * scripts/import-prospects.mjs
 *
 * Import un CSV Outscraper/Google Maps dans la table `prospects` de Supabase.
 *
 * Usage :
 *   node scripts/import-prospects.mjs leads.csv
 *
 * Format CSV attendu (colonnes Outscraper) :
 *   name, full_address, city, postal_code, phone, site, rating, reviews, type, subtypes, google_place_id
 *
 * Score heuristique (sans appel LLM — le vrai scoring tourne dans le cron) :
 *   - rating ≥ 4.2 ET ≥ 50 avis  → +30
 *   - site web présent            → +20
 *   - téléphone présent           → +20
 *   - indépendant (pas chaîne)    → +20
 *   - données complètes           → +10
 */

import fs from 'fs'
import path from 'path'

// ─── Config ──────────────────────────────────────────────────────────────────

const SUPABASE_URL = 'https://ngneaotxxvwfbwwdqiqz.supabase.co'
const ENV_FILE = path.resolve(process.cwd(), '.env.local')

// ─── Read .env.local ──────────────────────────────────────────────────────────

function loadEnv(filePath) {
  if (!fs.existsSync(filePath)) {
    console.error(`❌ Fichier .env.local introuvable : ${filePath}`)
    process.exit(1)
  }
  const lines = fs.readFileSync(filePath, 'utf-8').split('\n')
  const env = {}
  for (const line of lines) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const idx = trimmed.indexOf('=')
    if (idx === -1) continue
    const key = trimmed.slice(0, idx).trim()
    const val = trimmed.slice(idx + 1).trim().replace(/^["']|["']$/g, '')
    env[key] = val
  }
  return env
}

// ─── CSV parser (built-in, no deps) ──────────────────────────────────────────

/**
 * Parse a CSV string into an array of objects.
 * Handles quoted fields (with commas and newlines inside).
 */
function parseCSV(content) {
  const lines = []
  let current = ''
  let inQuotes = false

  for (let i = 0; i < content.length; i++) {
    const ch = content[i]
    if (ch === '"') {
      if (inQuotes && content[i + 1] === '"') {
        current += '"'
        i++
      } else {
        inQuotes = !inQuotes
      }
    } else if (ch === '\n' && !inQuotes) {
      lines.push(current)
      current = ''
    } else {
      current += ch
    }
  }
  if (current.trim()) lines.push(current)

  if (lines.length < 2) return []

  const headers = splitCSVLine(lines[0]).map((h) => h.trim().toLowerCase())

  return lines.slice(1).map((line) => {
    const values = splitCSVLine(line)
    const row = {}
    headers.forEach((h, i) => {
      row[h] = (values[i] ?? '').trim()
    })
    return row
  })
}

function splitCSVLine(line) {
  const fields = []
  let field = ''
  let inQuotes = false

  for (let i = 0; i < line.length; i++) {
    const ch = line[i]
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        field += '"'
        i++
      } else {
        inQuotes = !inQuotes
      }
    } else if (ch === ',' && !inQuotes) {
      fields.push(field)
      field = ''
    } else {
      field += ch
    }
  }
  fields.push(field)
  return fields
}

// ─── Score heuristique ────────────────────────────────────────────────────────

const CHAIN_KEYWORDS = [
  'mcdonalds',
  'mcdonald',
  'burger king',
  'kfc',
  'subway',
  'pizza hut',
  'dominos',
  'domino',
  'quick',
  'paul ',
  'brioche doree',
  'brioche dorée',
  'flunch',
  "leon",
  'leon de bruxelles',
  'hippopotamus',
  'courtepaille',
  'buffalo grill',
  'la boucherie',
  'jardin de',
  'flam\'s',
  'speed burger',
  'starbucks',
  'five guys',
  'kebab',
  'bagelstein',
  'pitaya',
  'sushi shop',
  'matsuri',
  'o tacos',
]

function isChain(name, subtypes) {
  const haystack = `${name} ${subtypes}`.toLowerCase()
  return CHAIN_KEYWORDS.some((kw) => haystack.includes(kw))
}

function computeScore(row) {
  let score = 0
  const breakdown = {}

  const rating = parseFloat(row.rating ?? row['rating/'] ?? '') || null
  const reviews = parseInt(row.reviews ?? row['reviews/'] ?? row.reviews_count ?? '', 10) || null

  // rating + reviews bonus
  if (rating !== null && reviews !== null && rating >= 4.2 && reviews >= 50) {
    score += 30
    breakdown.rating_reviews = 30
  }

  // website
  const site = row.site ?? row.website ?? ''
  if (site && site !== '') {
    score += 20
    breakdown.website = 20
  }

  // phone
  const phone = row.phone ?? row.telephone ?? ''
  if (phone && phone !== '') {
    score += 20
    breakdown.phone = 20
  }

  // independent
  const name = row.name ?? ''
  const subtypes = row.subtypes ?? ''
  if (!isChain(name, subtypes)) {
    score += 20
    breakdown.independent = 20
  }

  // complete data (name + city + phone or email)
  const city = row.city ?? row.ville ?? ''
  if (name && city && (phone || row.email)) {
    score += 10
    breakdown.complete = 10
  }

  return { score, breakdown }
}

// ─── Map CSV row to Supabase row ──────────────────────────────────────────────

function mapRow(row) {
  const { score, breakdown } = computeScore(row)

  // Extract city and postal code from full_address if not present
  let city = row.city ?? row.ville ?? ''
  let postalCode = row.postal_code ?? row.code_postal ?? ''

  if (!city && row.full_address) {
    // Try to extract from "75001 Paris" or "Paris, 75001"
    const match = row.full_address.match(/\b(\d{5})\b/)
    if (match) postalCode = postalCode || match[1]
  }

  const site = row.site ?? row.website ?? ''
  const phone = row.phone ?? row.telephone ?? ''
  const placeId = row.google_place_id ?? row.place_id ?? null

  return {
    nom: (row.name ?? '').trim(),
    telephone: phone || null,
    email: row.email ?? null,
    website: site || null,
    ville: city || null,
    code_postal: postalCode || null,
    score,
    score_breakdown: Object.keys(breakdown).length ? breakdown : null,
    rating: parseFloat(row.rating) || null,
    reviews_count: parseInt(row.reviews ?? row.reviews_count, 10) || null,
    type_cuisine: row.type ?? row.subtypes?.split(',')[0]?.trim() ?? null,
    statut: 'new',
    source: 'outscraper_csv',
    // Only include google_place_id if we have it (used for upsert conflict)
    ...(placeId ? { google_place_id: placeId } : {}),
  }
}

// ─── Supabase upsert ──────────────────────────────────────────────────────────

async function upsertProspects(rows, serviceKey) {
  const BATCH_SIZE = 50
  let inserted = 0
  let updated = 0
  let errors = 0

  for (let i = 0; i < rows.length; i += BATCH_SIZE) {
    const batch = rows.slice(i, i + BATCH_SIZE)
    const hasPlaceId = batch.every((r) => r.google_place_id)
    const conflictCol = hasPlaceId ? 'google_place_id' : 'nom,ville'

    try {
      const res = await fetch(
        `${SUPABASE_URL}/rest/v1/prospects?on_conflict=${conflictCol}`,
        {
          method: 'POST',
          headers: {
            apikey: serviceKey,
            Authorization: `Bearer ${serviceKey}`,
            'Content-Type': 'application/json',
            Prefer: 'resolution=merge-duplicates,return=representation',
          },
          body: JSON.stringify(batch),
        }
      )

      if (!res.ok) {
        const body = await res.text()
        console.error(`  ❌ Batch ${i / BATCH_SIZE + 1} erreur ${res.status}: ${body.slice(0, 200)}`)
        errors += batch.length
        continue
      }

      const result = await res.json()
      // Supabase returns the upserted rows; we can't easily distinguish insert vs update
      // so we approximate based on created_at vs now
      const now = Date.now()
      for (const r of result) {
        const createdAt = new Date(r.created_at).getTime()
        if (now - createdAt < 5000) {
          inserted++
        } else {
          updated++
        }
      }

      const progress = Math.min(i + BATCH_SIZE, rows.length)
      process.stdout.write(`\r  Traitement : ${progress}/${rows.length}`)
    } catch (err) {
      console.error(`\n  ❌ Batch ${i / BATCH_SIZE + 1} exception:`, err.message)
      errors += batch.length
    }
  }

  process.stdout.write('\n')
  return { inserted, updated, errors }
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  const csvPath = process.argv[2]
  if (!csvPath) {
    console.error('Usage : node scripts/import-prospects.mjs leads.csv')
    process.exit(1)
  }

  const resolvedPath = path.resolve(process.cwd(), csvPath)
  if (!fs.existsSync(resolvedPath)) {
    console.error(`❌ Fichier introuvable : ${resolvedPath}`)
    process.exit(1)
  }

  console.log(`\n📂 Lecture du fichier : ${resolvedPath}`)

  // Load env
  const env = loadEnv(ENV_FILE)
  const serviceKey = env.SUPABASE_SERVICE_ROLE_KEY
  if (!serviceKey) {
    console.error('❌ SUPABASE_SERVICE_ROLE_KEY manquant dans .env.local')
    process.exit(1)
  }

  // Parse CSV
  const content = fs.readFileSync(resolvedPath, 'utf-8')
  const rows = parseCSV(content)

  if (rows.length === 0) {
    console.error('❌ CSV vide ou mal formaté')
    process.exit(1)
  }

  console.log(`✅ ${rows.length} lignes lues`)

  // Skip rows without a name
  const validRows = rows.filter((r) => (r.name ?? '').trim())
  const skipped = rows.length - validRows.length
  if (skipped > 0) {
    console.log(`⚠️  ${skipped} lignes ignorées (nom manquant)`)
  }

  // Map to Supabase format
  const mapped = validRows.map(mapRow)

  // Score distribution
  const highScore = mapped.filter((r) => r.score >= 70).length
  const midScore = mapped.filter((r) => r.score >= 50 && r.score < 70).length
  const lowScore = mapped.filter((r) => r.score < 50).length
  console.log(`\n📊 Distribution des scores :`)
  console.log(`   Vert  (≥70) : ${highScore}`)
  console.log(`   Orange (50-69) : ${midScore}`)
  console.log(`   Rouge  (<50) : ${lowScore}`)

  // Upsert
  console.log(`\n⬆️  Import vers Supabase...`)
  const { inserted, updated, errors } = await upsertProspects(mapped, serviceKey)

  console.log(`\n✅ Import terminé :`)
  console.log(`   Insérés  : ${inserted}`)
  console.log(`   Mis à jour : ${updated}`)
  console.log(`   Erreurs  : ${errors}`)

  if (errors > 0) {
    process.exit(1)
  }
}

main().catch((err) => {
  console.error('\n❌ Erreur fatale :', err.message)
  process.exit(1)
})
