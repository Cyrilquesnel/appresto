#!/usr/bin/env node
/**
 * scripts/import-sirene.mjs
 *
 * Télécharge les établissements restauration depuis l'API recherche-entreprises.api.gouv.fr
 * (SIRENE INSEE — gratuit, sans clé API) et les importe dans la table `prospects` Supabase.
 *
 * Usage :
 *   node scripts/import-sirene.mjs [--ape 56.10A,56.10B] [--dept 75,69,13] [--limit 500]
 *
 * Par défaut :
 *   --ape  56.10A,56.10B,56.10C,56.30Z
 *   --dept (tous)
 *   --limit 1000
 *
 * Score heuristique SIRENE (sans téléphone ni note) :
 *   - Score de base           : 20
 *   - Taille (effectif > 0)   : +10
 *   NB : Ces leads seront enrichis ensuite par le cron google-maps-scrape.
 */

import fs from 'fs'
import path from 'path'

// ─── Config ──────────────────────────────────────────────────────────────────

const SUPABASE_URL = 'https://ngneaotxxvwfbwwdqiqz.supabase.co'
const ENV_FILE = path.resolve(process.cwd(), '.env.local')

const API_BASE = 'https://recherche-entreprises.api.gouv.fr/search'
const PER_PAGE = 25
const REQUEST_DELAY_MS = 200 // politesse envers l'API

// Codes APE ciblés (format API : "56.10A")
const DEFAULT_APE = ['56.10A', '56.10B', '56.10C', '56.30Z']

// Blacklist chaînes (insensible à la casse)
const CHAINES = [
  'mcdonald',
  'burger king',
  'kfc',
  'subway',
  'quick',
  'five guys',
  'pizza hut',
  'domino',
  'brioche doree',
  'brioche dorée',
  'paul',
  'hippopotamus',
  'courtepaille',
  'flunch',
  'leon',
  'leon de bruxelles',
  'sushishop',
  'sushi shop',
  'planet sushi',
  'buffalo grill',
  'popeyes',
  'taco bell',
  'chipotle',
  'casino restauration',
  'sodexo',
  'compass',
  'elior',
  'areas',
  'la boucherie',
  'speed burger',
  'starbucks',
  'bagelstein',
  'pitaya',
  'matsuri',
  'o tacos',
  'kebab',
]

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
    const val = trimmed
      .slice(idx + 1)
      .trim()
      .replace(/^["']|["']$/g, '')
    env[key] = val
  }
  return env
}

// ─── Parse arguments CLI ──────────────────────────────────────────────────────

function parseArgs(argv) {
  const args = { ape: DEFAULT_APE, dept: [], limit: 1000 }
  for (let i = 2; i < argv.length; i++) {
    if (argv[i] === '--ape' && argv[i + 1]) {
      args.ape = argv[++i].split(',').map((s) => s.trim())
    } else if (argv[i] === '--dept' && argv[i + 1]) {
      args.dept = argv[++i].split(',').map((s) => s.trim())
    } else if (argv[i] === '--limit' && argv[i + 1]) {
      args.limit = parseInt(argv[++i], 10) || 1000
    }
  }
  return args
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function isChain(nom) {
  const lower = (nom ?? '').toLowerCase()
  return CHAINES.some((kw) => lower.includes(kw))
}

// ─── Score heuristique ────────────────────────────────────────────────────────

function computeScore(etablissement) {
  let score = 20 // score de base SIRENE (pas de tel, pas de note)

  // Bonus taille : si on a un effectif renseigné
  const tranche = etablissement.tranche_effectif_salarie ?? ''
  if (tranche && tranche !== '00' && tranche !== 'NN') {
    score += 10
  }

  return score
}

// ─── Fetch une page API ───────────────────────────────────────────────────────

async function fetchPage(ape, dept, page) {
  const params = new URLSearchParams({
    activite_principale: ape,
    per_page: String(PER_PAGE),
    page: String(page),
    etat_administratif: 'A', // actif uniquement
  })

  if (dept.length === 1) {
    params.set('departement', dept[0])
  }

  const url = `${API_BASE}?${params.toString()}`

  const res = await fetch(url, {
    headers: { Accept: 'application/json' },
  })

  if (!res.ok) {
    const body = await res.text()
    throw new Error(`API ${res.status}: ${body.slice(0, 200)}`)
  }

  return res.json()
}

// ─── Fetch tous les établissements pour un code APE ──────────────────────────

async function fetchAllForApe(ape, dept, limit) {
  const results = []
  let page = 1
  let totalPages = 1

  while (page <= totalPages && results.length < limit) {
    // Si plusieurs départements, on boucle dessus nous-mêmes
    const depts = dept.length > 0 ? dept : [null]

    for (const d of depts) {
      if (results.length >= limit) break

      const deptFilter = d ? [d] : []
      let data
      try {
        data = await fetchPage(ape, deptFilter, page)
      } catch (err) {
        console.error(`\n  ⚠️  Erreur page ${page} APE ${ape} dept ${d ?? 'tous'}: ${err.message}`)
        continue
      }

      const total = data.total_results ?? 0
      totalPages = Math.ceil(total / PER_PAGE)

      const etablissements = data.results ?? []
      for (const entreprise of etablissements) {
        // L'API retourne des entreprises avec leurs établissements
        const siege = entreprise.siege ?? {}
        const matching = siege

        if (!matching) continue

        results.push({
          nom: entreprise.nom_complet ?? entreprise.nom_raison_sociale ?? '',
          siret: matching.siret ?? '',
          activite_principale: matching.activite_principale ?? ape,
          ville: matching.libelle_commune ?? '',
          code_postal: matching.code_postal ?? '',
          tranche_effectif_salarie: matching.tranche_effectif_salarie ?? '',
        })

        if (results.length >= limit) break
      }
    }

    process.stdout.write(
      `\r  APE ${ape} — page ${page}/${totalPages} — ${results.length} établissements collectés`
    )

    page++
    await sleep(REQUEST_DELAY_MS)

    // Éviter de dépasser totalPages si une seule itération de dept
    if (dept.length <= 1) break // on gère la pagination à l'extérieur
  }

  return results
}

// ─── Fetch complet (pagination) ───────────────────────────────────────────────

async function fetchSirene(ape, dept, limit) {
  const results = []
  let page = 1

  while (results.length < limit) {
    const depts = dept.length > 0 ? dept : [null]
    let pageHasResults = false

    for (const d of depts) {
      if (results.length >= limit) break

      const deptFilter = d ? [d] : []
      let data
      try {
        data = await fetchPage(ape, deptFilter, page)
      } catch (err) {
        console.error(`\n  ⚠️  Erreur page ${page} APE ${ape}: ${err.message}`)
        break
      }

      const total = data.total_results ?? 0
      const totalPages = Math.ceil(total / PER_PAGE)
      const etablissements = data.results ?? []

      if (etablissements.length === 0) break
      pageHasResults = true

      for (const entreprise of etablissements) {
        const siege = entreprise.siege ?? {}

        const nom = (entreprise.nom_complet ?? entreprise.nom_raison_sociale ?? '').trim()
        if (!nom) continue

        results.push({
          nom,
          siret: siege.siret ?? '',
          activite_principale: siege.activite_principale ?? ape,
          ville: (siege.libelle_commune ?? '').trim(),
          code_postal: siege.code_postal ?? '',
          tranche_effectif_salarie: siege.tranche_effectif_salarie ?? '',
        })

        if (results.length >= limit) break
      }

      process.stdout.write(
        `\r  APE ${ape} — page ${page} — ${results.length} établissements collectés`
      )

      // Si un seul département ou pas de filtre dept, on pagine normalement
      if (page >= Math.ceil(total / PER_PAGE)) {
        process.stdout.write('\n')
        return results
      }
    }

    if (!pageHasResults) break
    page++
    await sleep(REQUEST_DELAY_MS)
  }

  process.stdout.write('\n')
  return results
}

// ─── Map vers format Supabase ─────────────────────────────────────────────────

function mapToProspect(etab) {
  const score = computeScore(etab)

  return {
    nom: etab.nom,
    telephone: null, // SIRENE ne fournit pas les numéros de téléphone
    email: null,
    website: null,
    ville: etab.ville || null,
    code_postal: etab.code_postal || null,
    score,
    score_breakdown: { base: 20, ...(score > 20 ? { taille: score - 20 } : {}) },
    rating: null,
    reviews_count: null,
    type_cuisine: null,
    statut: 'new',
    source: 'sirene',
    // Utilise siret préfixé comme identifiant unique (réutilise la contrainte google_place_id)
    google_place_id: etab.siret ? `siret:${etab.siret}` : null,
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

    try {
      const res = await fetch(`${SUPABASE_URL}/rest/v1/prospects?on_conflict=google_place_id`, {
        method: 'POST',
        headers: {
          apikey: serviceKey,
          Authorization: `Bearer ${serviceKey}`,
          'Content-Type': 'application/json',
          Prefer: 'resolution=merge-duplicates,return=representation',
        },
        body: JSON.stringify(batch),
      })

      if (!res.ok) {
        const body = await res.text()
        console.error(
          `\n  ❌ Batch ${Math.floor(i / BATCH_SIZE) + 1} erreur ${res.status}: ${body.slice(0, 200)}`
        )
        errors += batch.length
        continue
      }

      const result = await res.json()
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
      process.stdout.write(`\r  Upsert Supabase : ${progress}/${rows.length}`)
    } catch (err) {
      console.error(`\n  ❌ Batch ${Math.floor(i / BATCH_SIZE) + 1} exception:`, err.message)
      errors += batch.length
    }
  }

  process.stdout.write('\n')
  return { inserted, updated, errors }
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  const args = parseArgs(process.argv)

  console.log('\n🏛️  Import SIRENE → Supabase prospects')
  console.log(`   Codes APE  : ${args.ape.join(', ')}`)
  console.log(`   Départements : ${args.dept.length > 0 ? args.dept.join(', ') : 'tous'}`)
  console.log(`   Limite     : ${args.limit} établissements\n`)

  // Load env
  const env = loadEnv(ENV_FILE)
  const serviceKey = env.SUPABASE_SERVICE_ROLE_KEY
  if (!serviceKey) {
    console.error('❌ SUPABASE_SERVICE_ROLE_KEY manquant dans .env.local')
    process.exit(1)
  }

  // Collecter tous les établissements pour chaque code APE
  const allRaw = []
  for (const ape of args.ape) {
    console.log(`\n🔍 Fetch APE ${ape}...`)
    const limitPerApe = Math.ceil(args.limit / args.ape.length)
    const etabs = await fetchSirene(ape, args.dept, limitPerApe)
    console.log(`   → ${etabs.length} établissements récupérés`)
    allRaw.push(...etabs)
  }

  console.log(`\n📦 Total brut : ${allRaw.length} établissements`)

  // Dédupliquer par SIRET (ou par nom+ville si pas de SIRET)
  const seen = new Set()
  const deduped = allRaw.filter((e) => {
    const key = e.siret || `${e.nom}|${e.ville}`
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
  console.log(`   Après déduplication : ${deduped.length}`)

  // Filtrer les chaînes
  const independants = deduped.filter((e) => !isChain(e.nom))
  const chainesExclues = deduped.length - independants.length
  console.log(`   Chaînes exclues : ${chainesExclues}`)
  console.log(`   Indépendants retenus : ${independants.length}`)

  if (independants.length === 0) {
    console.log('\n⚠️  Aucun établissement à importer.')
    process.exit(0)
  }

  // Mapper vers le format Supabase
  const mapped = independants.map(mapToProspect).filter((r) => r.nom && r.ville)
  const filteredEmpty = independants.length - mapped.length
  if (filteredEmpty > 0) {
    console.log(`   ⚠️  ${filteredEmpty} lignes ignorées (nom ou ville manquant)`)
  }

  // Distribution des scores
  console.log(`\n📊 Distribution des scores :`)
  const score30 = mapped.filter((r) => r.score >= 30).length
  const score20 = mapped.filter((r) => r.score === 20).length
  console.log(`   Score 30 (avec effectif) : ${score30}`)
  console.log(`   Score 20 (base)          : ${score20}`)

  // Upsert Supabase
  console.log(`\n⬆️  Import vers Supabase...`)
  const { inserted, updated, errors } = await upsertProspects(mapped, serviceKey)

  console.log(`\n✅ Import terminé :`)
  console.log(`   Insérés    : ${inserted}`)
  console.log(`   Mis à jour : ${updated}`)
  console.log(`   Erreurs    : ${errors}`)

  if (errors > 0) {
    process.exit(1)
  }
}

main().catch((err) => {
  console.error('\n❌ Erreur fatale :', err.message)
  process.exit(1)
})
