'use client'
import { trpc } from '@/lib/trpc/client'
import { useState } from 'react'

type Fournisseur = { id: string; nom: string }

type IngredientMercuriale = {
  ingredient_id: string
  nom: string
  unite_standard: string
  mercuriale_id: string | null
  prix: number | null
  unite: string
  unite_commande: string | null
  colisage: number | null
  reference_fournisseur: string | null
  date_maj: string | null
  fournisseur: Fournisseur | null
  fournisseurs_disponibles: Fournisseur[]
}

type Tab = 'tous' | 'manquants' | 'prices'

const UNITES = ['kg', 'L', 'pièce', 'botte', 'boîte', 'sachet', 'barquette']

function formatDate(iso: string | null): string {
  if (!iso) return ''
  return new Date(iso).toLocaleDateString('fr-FR', {
    day: '2-digit',
    month: '2-digit',
    year: '2-digit',
  })
}

function exportCSV(data: IngredientMercuriale[]) {
  const header = [
    'Ingrédient',
    'Fournisseur',
    'Prix HT',
    'Unité',
    'Unité commande',
    'Colisage',
    'Référence',
    'Dernière MAJ',
  ]
  const rows = data.map((item) => [
    item.nom,
    item.fournisseur?.nom ?? '',
    item.prix != null ? item.prix.toFixed(4) : '',
    item.unite,
    item.unite_commande ?? '',
    item.colisage != null ? item.colisage.toString() : '',
    item.reference_fournisseur ?? '',
    formatDate(item.date_maj),
  ])
  const csvContent = [header, ...rows]
    .map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(','))
    .join('\n')

  const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = `mercuriale_${new Date().toISOString().split('T')[0]}.csv`
  link.click()
  URL.revokeObjectURL(url)
}

type EditState = {
  prix: string
  unite: string
  fournisseur_id: string
  unite_commande: string
  colisage: string
  reference_fournisseur: string
}

function IngredientCard({ item, onSaved }: { item: IngredientMercuriale; onSaved: () => void }) {
  const [editing, setEditing] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [showAdvanced, setShowAdvanced] = useState(false)
  const [form, setForm] = useState<EditState>({
    prix: item.prix != null ? item.prix.toString() : '',
    unite: item.unite,
    fournisseur_id: item.fournisseur?.id ?? '',
    unite_commande: item.unite_commande ?? '',
    colisage: item.colisage != null ? item.colisage.toString() : '',
    reference_fournisseur: item.reference_fournisseur ?? '',
  })

  const setPrice = trpc.commandes.setMercurialePrice.useMutation({
    onSuccess: () => {
      setEditing(false)
      onSaved()
    },
  })

  const deletePrice = trpc.commandes.deleteMercurialePrice.useMutation({
    onSuccess: () => {
      setConfirmDelete(false)
      onSaved()
    },
  })

  function startEdit() {
    setForm({
      prix: item.prix != null ? item.prix.toString() : '',
      unite: item.unite,
      fournisseur_id: item.fournisseur?.id ?? '',
      unite_commande: item.unite_commande ?? '',
      colisage: item.colisage != null ? item.colisage.toString() : '',
      reference_fournisseur: item.reference_fournisseur ?? '',
    })
    setShowAdvanced(false)
    setEditing(true)
  }

  function handleSubmit() {
    const prix = parseFloat(form.prix)
    if (!prix || prix <= 0) return
    setPrice.mutate({
      ingredient_id: item.ingredient_id,
      fournisseur_id: form.fournisseur_id || null,
      prix,
      unite: form.unite,
      unite_commande: form.unite_commande || undefined,
      colisage: form.colisage ? parseFloat(form.colisage) : undefined,
      reference_fournisseur: form.reference_fournisseur || undefined,
    })
  }

  const hasPrix = item.prix != null

  return (
    <div
      className="bg-white rounded-xl border border-gray-100 p-4"
      data-testid={`ingredient-card-${item.ingredient_id}`}
    >
      {!editing ? (
        <>
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="font-medium text-sm text-gray-900 truncate">{item.nom}</p>
              <p className="text-xs text-gray-400 truncate mt-0.5">
                {item.fournisseur?.nom ?? '—'}
              </p>
            </div>
            <div className="flex items-center gap-3 flex-shrink-0">
              {hasPrix ? (
                <span className="font-mono text-sm font-semibold text-gray-900">
                  {item.prix!.toFixed(2)} €/{item.unite}
                </span>
              ) : (
                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-red-50 text-red-600">
                  Prix manquant
                </span>
              )}
              <button
                onClick={startEdit}
                className="text-gray-400 hover:text-accent transition-colors"
                aria-label="Modifier"
                data-testid={`edit-prix-${item.ingredient_id}`}
              >
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                  <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                </svg>
              </button>
              {hasPrix && (
                <button
                  onClick={() => setConfirmDelete(true)}
                  className="text-gray-300 hover:text-red-500 transition-colors"
                  aria-label="Supprimer le prix"
                  data-testid={`delete-prix-${item.ingredient_id}`}
                >
                  <svg
                    width="15"
                    height="15"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <polyline points="3 6 5 6 21 6" />
                    <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
                    <path d="M10 11v6M14 11v6" />
                    <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
                  </svg>
                </button>
              )}
            </div>
          </div>

          {/* Confirmation suppression inline */}
          {confirmDelete && (
            <div className="mt-3 pt-3 border-t border-gray-100 flex items-center justify-between gap-3">
              <p className="text-xs text-gray-600">Supprimer le prix ?</p>
              <div className="flex gap-2">
                <button
                  onClick={() => deletePrice.mutate({ ingredient_id: item.ingredient_id })}
                  disabled={deletePrice.isPending}
                  className="text-xs text-white bg-red-500 px-3 py-1.5 rounded-lg font-medium disabled:opacity-50"
                >
                  {deletePrice.isPending ? '…' : 'Oui'}
                </button>
                <button
                  onClick={() => setConfirmDelete(false)}
                  className="text-xs text-gray-500 border border-gray-200 px-3 py-1.5 rounded-lg"
                >
                  Annuler
                </button>
              </div>
            </div>
          )}
        </>
      ) : (
        <div className="space-y-3">
          <p className="font-medium text-sm text-gray-900">{item.nom}</p>

          {/* Prix + unité — champs essentiels */}
          <div className="flex gap-2">
            <div className="flex-1">
              <label className="text-xs text-gray-500 mb-1 block">Prix HT (€)</label>
              <input
                type="number"
                value={form.prix}
                onChange={(e) => setForm((f) => ({ ...f, prix: e.target.value }))}
                step="0.01"
                min="0.01"
                placeholder="0.00"
                className="w-full px-2 py-1.5 rounded-lg border border-accent text-sm font-mono focus:outline-none"
                autoFocus
                data-testid={`prix-input-${item.ingredient_id}`}
              />
            </div>
            <div className="w-32">
              <label className="text-xs text-gray-500 mb-1 block">Unité</label>
              <select
                value={form.unite}
                onChange={(e) => setForm((f) => ({ ...f, unite: e.target.value }))}
                className="w-full px-2 py-1.5 rounded-lg border border-gray-200 text-sm focus:outline-none"
              >
                {UNITES.map((u) => (
                  <option key={u} value={u}>
                    {u}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Options avancées repliées */}
          <button
            type="button"
            onClick={() => setShowAdvanced((v) => !v)}
            className="text-xs text-gray-400 hover:text-gray-600 flex items-center gap-1"
          >
            <span>{showAdvanced ? '▾' : '▸'}</span>
            Options avancées (fournisseur, colisage, référence)
          </button>

          {showAdvanced && (
            <div className="space-y-3">
              <div>
                <label className="text-xs text-gray-500 mb-1 block">Fournisseur</label>
                <select
                  value={form.fournisseur_id}
                  onChange={(e) => setForm((f) => ({ ...f, fournisseur_id: e.target.value }))}
                  className="w-full px-2 py-1.5 rounded-lg border border-gray-200 text-sm focus:outline-none"
                >
                  <option value="">— Aucun fournisseur —</option>
                  {item.fournisseurs_disponibles.map((four) => (
                    <option key={four.id} value={four.id}>
                      {four.nom}
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex gap-2">
                <div className="flex-1">
                  <label className="text-xs text-gray-500 mb-1 block">Unité commande</label>
                  <input
                    type="text"
                    value={form.unite_commande}
                    onChange={(e) => setForm((f) => ({ ...f, unite_commande: e.target.value }))}
                    placeholder="ex: colis, carton"
                    className="w-full px-2 py-1.5 rounded-lg border border-gray-200 text-sm focus:outline-none"
                  />
                </div>
                <div className="w-28">
                  <label className="text-xs text-gray-500 mb-1 block">Colisage</label>
                  <input
                    type="number"
                    value={form.colisage}
                    onChange={(e) => setForm((f) => ({ ...f, colisage: e.target.value }))}
                    step="0.1"
                    min="0.1"
                    placeholder="ex: 5"
                    className="w-full px-2 py-1.5 rounded-lg border border-gray-200 text-sm focus:outline-none"
                  />
                </div>
              </div>
              <div>
                <label className="text-xs text-gray-500 mb-1 block">Référence fournisseur</label>
                <input
                  type="text"
                  value={form.reference_fournisseur}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, reference_fournisseur: e.target.value }))
                  }
                  placeholder="Code article"
                  className="w-full px-2 py-1.5 rounded-lg border border-gray-200 text-sm focus:outline-none"
                />
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-2 pt-1">
            <button
              onClick={handleSubmit}
              disabled={setPrice.isPending || !form.prix || parseFloat(form.prix) <= 0}
              className="flex-1 text-sm text-white bg-accent py-2 rounded-lg disabled:opacity-50 font-medium"
            >
              {setPrice.isPending ? 'Enregistrement…' : 'Enregistrer'}
            </button>
            <button
              onClick={() => setEditing(false)}
              className="px-4 text-sm text-gray-500 border border-gray-200 rounded-lg"
            >
              Annuler
            </button>
          </div>

          {setPrice.error && <p className="text-xs text-red-500">{setPrice.error.message}</p>}
        </div>
      )}
    </div>
  )
}

export function MercurialeTable() {
  const { data: ingredients, refetch } = trpc.commandes.getAllIngredientsMercuriale.useQuery()
  const [tab, setTab] = useState<Tab>('tous')

  const all = ingredients ?? []
  const priced = all.filter((i) => i.prix != null)
  const missing = all.filter((i) => i.prix == null)

  const filtered = tab === 'tous' ? all : tab === 'prices' ? priced : missing

  const tabs: { key: Tab; label: string; count: number }[] = [
    { key: 'tous', label: 'Tous', count: all.length },
    { key: 'manquants', label: 'Prix manquants', count: missing.length },
    { key: 'prices', label: 'Pricés', count: priced.length },
  ]

  return (
    <div data-testid="mercuriale-table">
      {/* Header stats + export */}
      <div className="flex items-center justify-between mb-4">
        <p className="text-sm text-gray-500">
          <span className="font-semibold text-gray-900">
            {priced.length}/{all.length}
          </span>{' '}
          ingrédients pricés
        </p>
        {all.length > 0 && (
          <button
            onClick={() => exportCSV(all)}
            className="text-xs text-accent font-medium hover:underline flex items-center gap-1"
          >
            ↓ Export CSV
          </button>
        )}
      </div>

      {/* Tabs */}
      {all.length > 0 && (
        <div className="flex gap-1 mb-4 bg-gray-50 p-1 rounded-xl">
          {tabs.map((t) => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`flex-1 text-xs py-1.5 px-2 rounded-lg font-medium transition-colors ${
                tab === t.key
                  ? 'bg-white text-gray-900 shadow-sm'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              {t.label}
              {t.count > 0 && (
                <span className={`ml-1 ${tab === t.key ? 'text-accent' : 'text-gray-400'}`}>
                  ({t.count})
                </span>
              )}
            </button>
          ))}
        </div>
      )}

      {/* Liste */}
      <div className="space-y-2">
        {filtered.map((item) => (
          <IngredientCard key={item.ingredient_id} item={item} onSaved={() => refetch()} />
        ))}
      </div>

      {all.length === 0 && (
        <div className="text-center py-8 text-gray-400 text-sm">
          Aucun ingrédient trouvé dans vos fiches recettes
        </div>
      )}

      {all.length > 0 && filtered.length === 0 && (
        <div className="text-center py-8 text-gray-400 text-sm">
          {tab === 'manquants'
            ? 'Tous les ingrédients ont un prix !'
            : 'Aucun ingrédient pricé pour le moment.'}
        </div>
      )}
    </div>
  )
}
