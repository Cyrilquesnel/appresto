'use client'
import { useState, useMemo } from 'react'
import { trpc } from '@/lib/trpc/client'
import type { InvoiceLigne } from './InvoiceUpload'

const UNITES = ['kg', 'g', 'L', 'cl', 'pièce', 'boîte', 'sachet', 'botte', 'barquette', 'colis']

interface LineState {
  ingredientId: string | null
  ingredientNom: string
  search: string
  conditionnement: number // nb d'unités dans le pack (1 = pas de pack)
  prix: number // prix unitaire calculé
  unite: string
  saved: boolean
}

interface Props {
  lignes: InvoiceLigne[]
  onSaved: () => void
  onClose: () => void
}

export function InvoiceManualReviewModal({ lignes, onSaved, onClose }: Props) {
  const utils = trpc.useUtils()

  const { data: allIngredients } = trpc.commandes.getAllIngredientsMercuriale.useQuery()

  const setPrice = trpc.commandes.setMercurialePrice.useMutation({
    onSuccess: () => utils.commandes.getAllIngredientsMercuriale.invalidate(),
  })

  const ingredientList = useMemo(
    () => (allIngredients ?? []).map((i) => ({ id: i.ingredient_id, nom: i.nom })),
    [allIngredients]
  )

  const [states, setStates] = useState<LineState[]>(() =>
    lignes.map((l) => ({
      ingredientId: null,
      ingredientNom: '',
      search: '',
      conditionnement: 1,
      prix: l.prix_unitaire_ht,
      unite: l.unite || 'pièce',
      saved: false,
    }))
  )

  const [saving, setSaving] = useState<number | null>(null)

  function update(i: number, patch: Partial<LineState>) {
    setStates((prev) => prev.map((s, idx) => (idx === i ? { ...s, ...patch } : s)))
  }

  function selectIngredient(i: number, id: string, nom: string) {
    update(i, { ingredientId: id, ingredientNom: nom, search: nom })
  }

  function handleConditionnement(i: number, val: number) {
    const cond = Math.max(1, val)
    const newPrix = lignes[i].prix_unitaire_ht / cond
    update(i, { conditionnement: cond, prix: Math.round(newPrix * 100) / 100 })
  }

  async function handleSave(i: number) {
    const s = states[i]
    if (!s.ingredientId) return
    setSaving(i)
    try {
      await setPrice.mutateAsync({
        ingredient_id: s.ingredientId,
        prix: s.prix,
        unite: s.unite,
      })
      update(i, { saved: true })
      const allSaved = states.every((st, idx) => idx === i || st.saved || !st.ingredientId)
      if (allSaved) onSaved()
    } finally {
      setSaving(null)
    }
  }

  const pending = states.filter((s) => !s.saved)

  return (
    <div className="fixed inset-0 z-[100] flex items-end justify-center bg-black/50 p-4">
      <div className="bg-white rounded-2xl w-full max-w-md max-h-[85vh] flex flex-col">
        {/* Header */}
        <div className="p-4 border-b border-gray-100">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-bold text-gray-900">Produits non reconnus</h3>
              <p className="text-xs text-gray-400 mt-0.5">
                Rattachez chaque produit à un ingrédient
              </p>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 text-lg leading-none"
            >
              ✕
            </button>
          </div>
        </div>

        {/* Lines */}
        <div className="overflow-y-auto flex-1 divide-y divide-gray-100">
          {lignes.map((ligne, i) => {
            const s = states[i]
            if (s.saved)
              return (
                <div key={i} className="p-4 flex items-center gap-2">
                  <span className="text-xs text-gray-400 truncate flex-1">{ligne.designation}</span>
                  <span className="text-xs text-green-600 font-medium shrink-0">✓ Sauvegardé</span>
                </div>
              )

            const filtered =
              s.search.trim().length >= 1
                ? ingredientList
                    .filter((ing) => ing.nom.toLowerCase().includes(s.search.toLowerCase()))
                    .slice(0, 5)
                : []

            return (
              <div key={i} className="p-4 space-y-3">
                {/* Désignation OCR */}
                <p className="text-xs font-mono text-orange-500 truncate">{ligne.designation}</p>

                {/* Recherche ingrédient */}
                <div className="relative">
                  <input
                    type="text"
                    placeholder="Rechercher un ingrédient…"
                    value={s.search}
                    onChange={(e) =>
                      update(i, { search: e.target.value, ingredientId: null, ingredientNom: '' })
                    }
                    className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-accent"
                  />
                  {filtered.length > 0 && !s.ingredientId && (
                    <div className="absolute top-full left-0 right-0 bg-white border border-gray-200 rounded-xl shadow-lg z-10 mt-1 overflow-hidden">
                      {filtered.map((ing) => (
                        <button
                          key={ing.id}
                          type="button"
                          onClick={() => selectIngredient(i, ing.id, ing.nom)}
                          className="w-full text-left px-3 py-2 text-sm hover:bg-gray-50 truncate"
                        >
                          {ing.nom}
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {/* Prix & conditionnement */}
                <div className="flex items-center gap-2">
                  <div className="flex-1">
                    <label className="text-xs text-gray-400 block mb-1">Pack (nb unités)</label>
                    <input
                      type="number"
                      min={1}
                      step={1}
                      value={s.conditionnement}
                      onChange={(e) => handleConditionnement(i, parseInt(e.target.value) || 1)}
                      className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-accent"
                    />
                  </div>
                  <div className="flex-1">
                    <label className="text-xs text-gray-400 block mb-1">Prix/unité HT</label>
                    <div className="border border-gray-200 rounded-xl px-3 py-2 text-sm bg-gray-50 font-mono">
                      {s.prix.toFixed(2)} €
                    </div>
                  </div>
                  <div className="flex-1">
                    <label className="text-xs text-gray-400 block mb-1">Unité</label>
                    <select
                      value={s.unite}
                      onChange={(e) => update(i, { unite: e.target.value })}
                      className="w-full border border-gray-200 rounded-xl px-2 py-2 text-sm focus:outline-none focus:border-accent"
                    >
                      {UNITES.map((u) => (
                        <option key={u}>{u}</option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Bouton valider */}
                <button
                  type="button"
                  disabled={!s.ingredientId || saving === i}
                  onClick={() => handleSave(i)}
                  className="w-full py-2.5 rounded-xl text-sm font-semibold text-white disabled:opacity-40 transition-opacity"
                  style={
                    {
                      backgroundColor: s.ingredientId ? 'var(--color-accent)' : '#d1d5db',
                    } as React.CSSProperties
                  }
                >
                  {saving === i
                    ? 'Sauvegarde…'
                    : s.ingredientId
                      ? `Valider → ${s.ingredientNom}`
                      : 'Sélectionnez un ingrédient'}
                </button>
              </div>
            )
          })}
        </div>

        {/* Footer */}
        {pending.length === 0 && (
          <div className="p-4 border-t border-gray-100">
            <button
              type="button"
              onClick={onClose}
              className="w-full py-3 rounded-xl bg-green-500 text-white text-sm font-semibold"
            >
              ✓ Tout validé — Fermer
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
