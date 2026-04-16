import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { extractInvoiceData, matchIngredient } from '@/lib/ai/invoice-ocr'
import { claudeMatchIngredients } from '@/lib/ai/ingredient-matcher'
import { invoiceOCRLimiter } from '@/lib/upstash'

export const maxDuration = 30

export async function POST(req: NextRequest) {
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })

  const restaurantId = req.headers.get('x-restaurant-id')
  if (!restaurantId) return NextResponse.json({ error: 'restaurant_id manquant' }, { status: 400 })

  // Rate limit: 50 OCR/jour/restaurant
  if (invoiceOCRLimiter) {
    const { success } = await invoiceOCRLimiter.limit(`invoice_ocr:${restaurantId}`)
    if (!success) {
      return NextResponse.json(
        { error: 'Limite OCR atteinte (50/jour). Réessayez demain.' },
        { status: 429 }
      )
    }
  }

  const formData = await req.formData()
  const file = formData.get('image') as File | null
  if (!file) return NextResponse.json({ error: 'Image requise' }, { status: 400 })

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
  if (!ALLOWED_TYPES.includes(file.type)) {
    return NextResponse.json(
      { error: 'Format non supporté. Acceptés : JPG, PNG, WEBP, HEIC, GIF, PDF' },
      { status: 400 }
    )
  }
  if (file.size > 20 * 1024 * 1024) {
    return NextResponse.json({ error: 'Fichier trop lourd (max 20 MB)' }, { status: 400 })
  }

  const imageBase64 = Buffer.from(await file.arrayBuffer()).toString('base64')

  // Extraire données facture via Gemini
  const invoiceData = await extractInvoiceData(imageBase64, file.type)

  // Trouver le fournisseur via nom extrait (best-effort)
  let fournisseurId: string | null = null
  if (invoiceData.fournisseur_nom) {
    const { data: fournisseurs } = await supabase
      .from('fournisseurs')
      .select('id')
      .eq('restaurant_id', restaurantId)
      .ilike('nom', `%${invoiceData.fournisseur_nom.slice(0, 8)}%`)
      .is('deleted_at', null)
      .limit(1)
    fournisseurId = fournisseurs?.[0]?.id ?? null
  }

  // Récupérer ingrédients du restaurant
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

  // ── COUCHE 1 — Mappings confirmés (mémoire persistante) ──────────────────
  // Fournisseur connu → 100% automatique après 1ère confirmation
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

  // ── COUCHE 2 — JS fuzzy (exact, partial, reverse substring) ──────────────
  type MatchedLigne = (typeof invoiceData.lignes)[number] & {
    ingredient_id: string | null
    matched: boolean
    match_source: 'mapping' | 'fuzzy' | 'ai' | 'none'
    ai_confidence?: number
  }

  const lignesAvecMatch: MatchedLigne[] = invoiceData.lignes.map((ligne) => {
    const norm = ligne.designation.toLowerCase().trim()

    // Mapping persistant (exact sur designation_norm)
    if (mappingIndex.has(norm)) {
      return {
        ...ligne,
        ingredient_id: mappingIndex.get(norm)!,
        matched: true,
        match_source: 'mapping',
      }
    }

    // JS fuzzy fallback
    const fuzzyId = matchIngredient(ligne.designation, ingredients)
    if (fuzzyId) {
      return { ...ligne, ingredient_id: fuzzyId, matched: true, match_source: 'fuzzy' }
    }

    return { ...ligne, ingredient_id: null, matched: false, match_source: 'none' }
  })

  // ── COUCHE 3 — Claude Haiku (sémantique, pour les lignes non matchées) ────
  const unmatched = lignesAvecMatch.filter((l) => l.match_source === 'none')
  if (unmatched.length > 0) {
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
  }

  // ── Mise à jour automatique mercuriale (couche 1 + 2 uniquement) ──────────
  // Suggestions IA (couche 3) requièrent confirmation utilisateur avant mise à jour
  const autoUpdates: string[] = []
  if (fournisseurId) {
    const mappingDesignationsUsed: string[] = []

    for (const ligne of lignesAvecMatch) {
      if (
        ligne.ingredient_id &&
        ligne.prix_unitaire_ht > 0 &&
        (ligne.match_source === 'mapping' || ligne.match_source === 'fuzzy')
      ) {
        await supabase
          .from('mercuriale')
          .update({ est_actif: false })
          .eq('ingredient_id', ligne.ingredient_id)
          .eq('est_actif', true)

        await supabase.from('mercuriale').insert({
          ingredient_id: ligne.ingredient_id,
          fournisseur_id: fournisseurId,
          prix: ligne.prix_unitaire_ht,
          unite: ligne.unite || 'kg',
          est_actif: true,
          source: 'ocr',
          date_maj: new Date().toISOString(),
        })

        autoUpdates.push(ligne.designation)

        if (ligne.match_source === 'mapping') {
          mappingDesignationsUsed.push(ligne.designation.toLowerCase().trim())
        }
      }
    }

    // Incrémenter usage_count pour les mappings utilisés
    if (mappingDesignationsUsed.length > 0) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (supabase as any).rpc('increment_mapping_usage', {
        p_restaurant_id: restaurantId,
        p_fournisseur_id: fournisseurId,
        p_designations: mappingDesignationsUsed,
      })
    }
  }

  return NextResponse.json({
    invoice: { ...invoiceData, lignes: lignesAvecMatch },
    auto_updated: autoUpdates,
    // Suggestions IA : à confirmer en 1 tap → sauvegarde dans ingredient_supplier_mappings
    ai_suggested: lignesAvecMatch.filter((l) => l.match_source === 'ai'),
    // Vraiment inconnus : saisie manuelle requise
    requires_manual: lignesAvecMatch.filter((l) => !l.matched).length,
  })
}
