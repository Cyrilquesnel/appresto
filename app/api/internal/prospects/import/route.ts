// Import CSV de prospects — compatible Ultimate Web Scraper, Outscraper, exports Google Maps
// Protégé par INTERNAL_CRON_KEY (middleware.ts)

import { NextRequest } from 'next/server'
import Papa from 'papaparse'
import { createServiceClient, prospectionTable } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

// Mapping flexible des noms de colonnes → champ interne
const FIELD_MAP: Record<string, string[]> = {
  nom: [
    'name',
    'nom',
    'business_name',
    'title',
    'restaurant',
    'company',
    'place_name',
    'businessname',
  ],
  telephone: [
    'phone',
    'telephone',
    'tel',
    'phone_number',
    'mobile',
    'contact_phone',
    'phonenumber',
  ],
  website: ['website', 'site', 'url', 'web', 'site_web', 'homepage'],
  rating: ['rating', 'note', 'stars', 'score', 'google_rating', 'avg_rating'],
  reviews_count: [
    'reviews_count',
    'reviews',
    'avis',
    'nb_avis',
    'review_count',
    'total_reviews',
    'number_of_reviews',
  ],
  google_place_id: ['place_id', 'google_place_id', 'id', 'place_id_google', 'gplace_id'],
  ville: ['city', 'ville', 'locality', 'town', 'municipality', 'address_city'],
  adresse: [
    'address',
    'adresse',
    'full_address',
    'street_address',
    'location',
    'formatted_address',
  ],
  email: ['email', 'email_address', 'mail', 'contact_email'],
}

function resolveHeaders(headers: string[]): Record<string, string> {
  const normalized = headers.map((h) => h.toLowerCase().trim().replace(/\s+/g, '_'))
  const mapping: Record<string, string> = {}
  for (const [field, aliases] of Object.entries(FIELD_MAP)) {
    for (let i = 0; i < normalized.length; i++) {
      if (aliases.includes(normalized[i])) {
        mapping[field] = headers[i]
        break
      }
    }
  }
  return mapping
}

function normalizePhone(phone: string): string {
  const digits = phone.replace(/\D/g, '')
  if (digits.startsWith('0') && digits.length === 10) return '33' + digits.slice(1)
  if (digits.startsWith('33')) return digits
  return digits
}

const CHAINS_BLACKLIST = [
  'mcdonald',
  'mcdo',
  'kfc',
  'burger king',
  'subway',
  'quick',
  'five guys',
  'domino',
  'pizza hut',
  'buffalo grill',
  'hippopotamus',
  'flunch',
  'brioche dorée',
  'paul ',
  'starbucks',
  'bagelstein',
  'pitaya',
  "o'tacos",
  'otacos',
]

function isChaine(nom: string): boolean {
  const lower = nom.toLowerCase()
  return CHAINS_BLACKLIST.some((c) => lower.includes(c))
}

function computeScore(p: {
  telephone: string | null
  website: string | null
  email: string | null
  rating: number | null
  reviews_count: number | null
}): number {
  let s = 20 // Indépendant supposé (chaînes déjà filtrées)
  if ((p.rating ?? 0) >= 4.2 && (p.reviews_count ?? 0) >= 50) s += 20
  else if ((p.rating ?? 0) >= 3.8) s += 10
  if (p.website && !p.website.includes('tripadvisor') && !p.website.includes('google')) s += 15
  if (p.telephone && p.email) s += 5
  else if (p.telephone) s += 3
  return Math.min(s, 100)
}

export async function POST(req: NextRequest) {
  const supabase = createServiceClient()

  const formData = await req.formData()
  const file = formData.get('file') as File | null
  const rawCsv = formData.get('csv') as string | null

  if (!file && !rawCsv) {
    return Response.json(
      { error: 'Fournir un fichier CSV (champ "file") ou du texte CSV (champ "csv")' },
      { status: 400 }
    )
  }

  const csvText = rawCsv ?? (await file!.text())

  const parsed = Papa.parse(csvText, {
    header: true,
    skipEmptyLines: true,
    transformHeader: (h) => h.trim(),
  })

  if (parsed.errors.length > 0 && parsed.data.length === 0) {
    return Response.json(
      { error: 'CSV invalide', details: parsed.errors.slice(0, 3) },
      { status: 400 }
    )
  }

  const rows = parsed.data as Record<string, string>[]
  if (rows.length === 0) return Response.json({ error: 'CSV vide' }, { status: 400 })

  const headers = Object.keys(rows[0])
  const fieldMap = resolveHeaders(headers)

  if (!fieldMap.nom) {
    return Response.json(
      {
        error: 'Colonne "nom" introuvable. Colonnes détectées : ' + headers.join(', '),
        hint: 'Renommer une colonne en "name", "nom", "business_name" ou "title"',
      },
      { status: 400 }
    )
  }

  let inserted = 0
  let skipped = 0
  let chains = 0
  let errors = 0

  for (const row of rows) {
    const nom = (row[fieldMap.nom] ?? '').trim()
    if (!nom) {
      skipped++
      continue
    }
    if (isChaine(nom)) {
      chains++
      continue
    }

    const telephone = fieldMap.telephone ? normalizePhone(row[fieldMap.telephone] ?? '') : null
    const google_place_id = fieldMap.google_place_id
      ? (row[fieldMap.google_place_id] ?? '').trim() || null
      : null
    const website = fieldMap.website ? (row[fieldMap.website] ?? '').trim() || null : null
    const email = fieldMap.email ? (row[fieldMap.email] ?? '').trim() || null : null
    const ville = fieldMap.ville ? (row[fieldMap.ville] ?? '').trim() || null : null
    const adresse = fieldMap.adresse ? (row[fieldMap.adresse] ?? '').trim() || null : null

    const rawRating = fieldMap.rating ? parseFloat(row[fieldMap.rating] ?? '') : NaN
    const rating = isNaN(rawRating) ? null : Math.min(5, Math.max(0, rawRating))

    const rawReviews = fieldMap.reviews_count ? parseInt(row[fieldMap.reviews_count] ?? '') : NaN
    const reviews_count = isNaN(rawReviews) ? null : rawReviews

    const score = computeScore({
      telephone: telephone || null,
      website,
      email,
      rating,
      reviews_count,
    })

    const prospect = {
      nom,
      telephone: telephone || null,
      google_place_id,
      website,
      email,
      rating,
      reviews_count,
      ville,
      adresse: adresse ? { formatted: adresse } : null,
      score,
      source: 'csv_import',
      statut: 'new',
    }

    // Dédup : google_place_id si dispo, sinon nom+téléphone
    let existing = null
    if (google_place_id) {
      const { data } = await prospectionTable(supabase, 'prospects')
        .select('id')
        .eq('google_place_id', google_place_id)
        .single()
      existing = data
    } else if (telephone) {
      const { data } = await prospectionTable(supabase, 'prospects')
        .select('id')
        .eq('telephone', telephone)
        .single()
      existing = data
    }

    if (existing) {
      skipped++
      continue
    }

    const { error } = await prospectionTable(supabase, 'prospects').insert(prospect)
    if (error) {
      errors++
      continue
    }
    inserted++
  }

  return Response.json({
    total: rows.length,
    inserted,
    skipped_duplicate: skipped,
    skipped_chain: chains,
    errors,
    columns_mapped: fieldMap,
  })
}
