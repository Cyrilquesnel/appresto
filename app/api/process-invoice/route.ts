import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { extractInvoiceData, matchIngredient } from '@/lib/ai/invoice-ocr'
import { claudeMatchIngredients } from '@/lib/ai/ingredient-matcher'
import { invoiceOCRLimiter } from '@/lib/upstash'

export const maxDuration = 60 // PDFs lourds peuvent prendre plus de 30s

const ALLOWED_TYPES = [
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/webp',
  'image/heic',
  'image/heif',
  'image/gif',
  'application/pdf',
]

export async function POST(req: NextRequest) {
  // ── Auth ──────────────────────────────────────────────────────────────────
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })

  const restaurantId = req.headers.get('x-restaurant-id')
  if (!restaurantId) return NextResponse.json({ error: 'restaurant_id manquant' }, { status: 400 })

  // ── Rate limit ────────────────────────────────────────────────────────────
  if (invoiceOCRLimiter) {
    const { success } = await invoiceOCRLimiter.limit(`invoice_ocr:${restaurantId}`)
    if (!success) {
      return NextResponse.json(
        { error: 'Limite OCR atteinte (50/jour). Réessayez demain.' },
        { status: 429 }
      )
    }
  }

  // ── Validation fichier ────────────────────────────────────────────────────
  let file: File | null = null
  try {
    const formData = await req.formData()
    file = formData.get('image') as File | null
  } catch {
    return NextResponse.json({ error: 'Impossible de lire le fichier envoyé' }, { status: 400 })
  }

  if (!file) return NextResponse.json({ error: 'Fichier requis' }, { status: 400 })

  if (!ALLOWED_TYPES.includes(file.type)) {
    return NextResponse.json(
      { error: `Format non supporté (${file.type}). Acceptés : JPG, PNG, WEBP, HEIC, PDF` },
      { status: 400 }
    )
  }

  if (file.size > 20 * 1024 * 1024) {
    return NextResponse.json({ error: 'Fichier trop lourd (max 20 Mo)' }, { status: 400 })
  }

  const arrayBuffer = await file.arrayBuffer()
  const buffer = Buffer.from(arrayBuffer)

  // ── COUCHE OCR : Gemini Vision (gemini-2.0-flash → gemini-2.0-flash-lite) ─
  // Gemini supporte PDF + images inline nativement.
  // Mindee v1 (InvoiceV4) retiré : clé v2 incompatible avec InvoiceV4.

  let invoiceData
  const ocrSource = 'gemini'

  // Normalise le MIME type : iOS peut envoyer application/octet-stream pour les PDFs
  const mimeType =
    file.type === 'application/octet-stream' && file.name?.toLowerCase().endsWith('.pdf')
      ? 'application/pdf'
      : file.type

  console.log(`[OCR] fichier=${file.name} type=${file.type} mimeNorm=${mimeType} size=${file.size}`)

  try {
    const imageBase64 = buffer.toString('base64')
    invoiceData = await extractInvoiceData(imageBase64, mimeType)
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Erreur inconnue'
    return NextResponse.json(
      {
        error: `Impossible d'analyser ce fichier. ${message}. Vérifiez que la facture est lisible et réessayez.`,
      },
      { status: 422 }
    )
  }

  if (!invoiceData.lignes?.length) {
    return NextResponse.json(
      { error: 'Aucune ligne de produit détectée dans cette facture.' },
      { status: 422 }
    )
  }

  // ── Identification fournisseur ────────────────────────────────────────────
  let fournisseurId: string | null = null
  if (invoiceData.fournisseur_nom) {
    const prefix = invoiceData.fournisseur_nom.slice(0, 8)
    const { data: fournisseurs } = await supabase
      .from('fournisseurs')
      .select('id')
      .eq('restaurant_id', restaurantId)
      .ilike('nom', `%${prefix}%`)
      .is('deleted_at', null)
      .limit(1)
    fournisseurId = fournisseurs?.[0]?.id ?? null
  }

  // ── Ingrédients du restaurant ─────────────────────────────────────────────
  const { data: ings } = await supabase
    .from('restaurant_ingredients')
    .select('id, nom_custom, catalog:ingredients_catalog(nom)')
    .eq('restaurant_id', restaurantId)
    .is('deleted_at', null)

  const ingredients = (ings ?? [])
    .map((i) => ({
      id: i.id,
      nom: i.nom_custom ?? (i.catalog as { nom: string } | null)?.nom ?? '',
    }))
    .filter((i) => i.nom !== '')

  // ── COUCHE 1 — Mappings persistants (fournisseur connu) ───────────────────
  const mappingIndex = new Map<string, string>()
  if (fournisseurId) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: mappings } = await (supabase as any)
      .from('ingredient_supplier_mappings')
      .select('designation_norm, ingredient_id')
      .eq('restaurant_id', restaurantId)
      .eq('fournisseur_id', fournisseurId)
    ;((mappings ?? []) as { designation_norm: string; ingredient_id: string }[]).forEach((m) =>
      mappingIndex.set(m.designation_norm, m.ingredient_id)
    )
  }

  // ── COUCHE 2 — Matching multi-stratégie (exact + Levenshtein + tokens) ────
  type MatchedLigne = (typeof invoiceData.lignes)[number] & {
    ingredient_id: string | null
    matched: boolean
    match_source: 'mapping' | 'fuzzy' | 'ai' | 'none'
    ai_confidence?: number
  }

  const lignesAvecMatch: MatchedLigne[] = invoiceData.lignes.map((ligne) => {
    const norm = ligne.designation.toLowerCase().trim()

    // Mapping persistant exact
    if (mappingIndex.has(norm)) {
      return {
        ...ligne,
        ingredient_id: mappingIndex.get(norm)!,
        matched: true,
        match_source: 'mapping',
      }
    }

    // Fuzzy amélioré : normalisation + Levenshtein + tokens
    const fuzzyId = matchIngredient(ligne.designation, ingredients)
    if (fuzzyId) {
      return { ...ligne, ingredient_id: fuzzyId, matched: true, match_source: 'fuzzy' }
    }

    return { ...ligne, ingredient_id: null, matched: false, match_source: 'none' }
  })

  // ── COUCHE 3 — Claude Haiku (sémantique, lignes non matchées) ─────────────
  const unmatched = lignesAvecMatch.filter((l) => l.match_source === 'none')
  if (unmatched.length > 0 && ingredients.length > 0) {
    try {
      const suggestions = await claudeMatchIngredients(
        unmatched.map((l) => l.designation),
        ingredients
      )
      suggestions.forEach((s) => {
        const ligne = lignesAvecMatch.find((l) => l.designation === s.designation)
        if (ligne) {
          ligne.ingredient_id = s.ingredient_id
          ligne.matched = true
          ligne.match_source = 'ai'
          ligne.ai_confidence = s.confidence
        }
      })
    } catch {
      // Claude Haiku indisponible → on continue sans matching IA
    }
  }

  // ── Mise à jour automatique mercuriale (couches 1 + 2 uniquement) ─────────
  const autoUpdates: string[] = []
  const mappingDesignationsUsed: string[] = []

  if (fournisseurId) {
    for (const ligne of lignesAvecMatch) {
      if (
        ligne.ingredient_id &&
        ligne.prix_unitaire_ht > 0 &&
        (ligne.match_source === 'mapping' || ligne.match_source === 'fuzzy')
      ) {
        const { error: updateErr } = await supabase
          .from('mercuriale')
          .update({ est_actif: false })
          .eq('ingredient_id', ligne.ingredient_id)
          .eq('est_actif', true)

        if (updateErr) {
          console.error('[Mercuriale] update est_actif=false failed:', updateErr.message)
          continue
        }

        const { error: insertErr } = await supabase.from('mercuriale').insert({
          restaurant_id: restaurantId,
          ingredient_id: ligne.ingredient_id,
          fournisseur_id: fournisseurId,
          prix: ligne.prix_unitaire_ht,
          unite: ligne.unite || 'kg',
          est_actif: true,
          source: 'ocr',
          date_maj: new Date().toISOString(),
        })

        if (insertErr) {
          console.error('[Mercuriale] insert failed:', insertErr.message)
          // Réactiver l'ancienne ligne pour éviter de se retrouver sans prix actif
          await supabase
            .from('mercuriale')
            .update({ est_actif: true })
            .eq('ingredient_id', ligne.ingredient_id)
            .eq('est_actif', false)
          continue
        }

        autoUpdates.push(ligne.designation)

        if (ligne.match_source === 'mapping') {
          mappingDesignationsUsed.push(ligne.designation.toLowerCase().trim())
        }
      }
    }

    if (mappingDesignationsUsed.length > 0 && fournisseurId) {
      // Sécurité : re-vérifier que fournisseurId appartient bien à ce restaurant
      // (fournisseurId est déjà issu d'une query filtrée par restaurant_id, mais guard explicite)
      const { data: fournisseurCheck } = await supabase
        .from('fournisseurs')
        .select('id')
        .eq('id', fournisseurId)
        .eq('restaurant_id', restaurantId)
        .single()

      if (fournisseurCheck) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await (supabase as any).rpc('increment_mapping_usage', {
          p_restaurant_id: restaurantId,
          p_fournisseur_id: fournisseurId,
          p_designations: mappingDesignationsUsed,
        })
      }
    }
  }

  return NextResponse.json({
    invoice: { ...invoiceData, lignes: lignesAvecMatch },
    auto_updated: autoUpdates,
    ai_suggested: lignesAvecMatch.filter((l) => l.match_source === 'ai'),
    requires_manual: lignesAvecMatch.filter((l) => !l.matched).length,
    ocr_source: ocrSource, // debug info
  })
}
