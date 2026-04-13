# Task 3.3: Génération Bons de Commande

## Objective
Génération des bons de commande par fournisseur avec calcul automatique du total HT. Gestion des statuts (brouillon → envoyé → confirmé → reçu).

## Context
Le bon de commande est l'outil central du module ACHETER. Il regroupe les besoins par fournisseur, calcule les totaux depuis la mercuriale, et s'envoie via WhatsApp/email/PDF (Task 3.4). L'UI doit permettre de créer un bon rapidement depuis la liste des ingrédients à commander.

## Dependencies
- Task 3.1 — fournisseurs + mercuriale opérationnels

## Blocked By
- Task 3.1

## Implementation Plan

### Step 1: Router tRPC — bons de commande

```typescript
// server/routers/commandes.ts — ajouter à la suite de 3.1
// (dans le même commandesRouter)

const BonLigneSchema = z.object({
  ingredient_id: z.string().uuid(),
  nom_produit: z.string().min(1),
  quantite: z.number().positive(),
  unite: z.string().min(1).max(20),
  prix_unitaire: z.number().positive().optional(), // depuis mercuriale
  ref_fournisseur: z.string().optional(),
})

// Ajouter dans commandesRouter:
generateBonDeCommande: protectedProcedure
  .input(z.object({
    fournisseur_id: z.string().uuid(),
    date_livraison_souhaitee: z.string().optional(), // ISO date
    notes: z.string().optional(),
    lignes: z.array(BonLigneSchema).min(1),
  }))
  .mutation(async ({ ctx, input }) => {
    const { fournisseur_id, date_livraison_souhaitee, lignes, notes } = input

    // Calculer total_ht depuis les prix
    let total_ht = 0
    for (const ligne of lignes) {
      if (ligne.prix_unitaire) {
        total_ht += ligne.quantite * ligne.prix_unitaire
      } else {
        // Chercher le prix dans la mercuriale
        const { data: prix } = await ctx.supabase
          .from('mercuriale')
          .select('prix')
          .eq('ingredient_id', ligne.ingredient_id)
          .eq('restaurant_id', ctx.restaurantId)
          .eq('est_actif', true)
          .single()
        if (prix) {
          total_ht += ligne.quantite * prix.prix
        }
      }
    }
    total_ht = Math.round(total_ht * 100) / 100

    // INSERT bon de commande
    const { data: bon, error: bonError } = await ctx.supabase
      .from('bons_de_commande')
      .insert({
        restaurant_id: ctx.restaurantId,
        fournisseur_id,
        date_livraison_souhaitee,
        notes,
        total_ht,
        statut: 'brouillon',
      })
      .select('id')
      .single()

    if (bonError || !bon) throw new Error(bonError?.message)

    // INSERT lignes
    await ctx.supabase.from('bons_de_commande_lignes').insert(
      lignes.map(l => ({
        bon_id: bon.id,
        restaurant_id: ctx.restaurantId,
        ingredient_id: l.ingredient_id,
        nom_produit: l.nom_produit,
        quantite: l.quantite,
        unite: l.unite,
        prix_unitaire: l.prix_unitaire,
        ref_fournisseur: l.ref_fournisseur,
      }))
    )

    return { bon_id: bon.id }
  }),

listBons: protectedProcedure
  .input(z.object({
    statut: z.enum(['brouillon', 'envoye', 'confirme', 'recu']).optional(),
    fournisseur_id: z.string().uuid().optional(),
  }).optional())
  .query(async ({ ctx, input }) => {
    let query = ctx.supabase
      .from('bons_de_commande')
      .select(`
        id, statut, total_ht, date_livraison_souhaitee, envoye_via, created_at,
        fournisseur:fournisseurs(id, nom, contact_whatsapp, contact_email)
      `)
      .eq('restaurant_id', ctx.restaurantId)
      .order('created_at', { ascending: false })

    if (input?.statut) query = query.eq('statut', input.statut)
    if (input?.fournisseur_id) query = query.eq('fournisseur_id', input.fournisseur_id)

    const { data } = await query
    return data ?? []
  }),

getBon: protectedProcedure
  .input(z.object({ bonId: z.string().uuid() }))
  .query(async ({ ctx, input }) => {
    const { data } = await ctx.supabase
      .from('bons_de_commande')
      .select(`
        *,
        fournisseur:fournisseurs(*),
        lignes:bons_de_commande_lignes(*)
      `)
      .eq('id', input.bonId)
      .eq('restaurant_id', ctx.restaurantId)
      .single()
    return data
  }),

updateStatutBon: protectedProcedure
  .input(z.object({
    bonId: z.string().uuid(),
    statut: z.enum(['brouillon', 'envoye', 'confirme', 'recu']),
    envoye_via: z.enum(['whatsapp', 'email', 'pdf']).optional(),
  }))
  .mutation(async ({ ctx, input }) => {
    await ctx.supabase
      .from('bons_de_commande')
      .update({
        statut: input.statut,
        envoye_via: input.envoye_via,
        date_envoi: input.statut === 'envoye' ? new Date().toISOString() : undefined,
      })
      .eq('id', input.bonId)
      .eq('restaurant_id', ctx.restaurantId)
    return { success: true }
  }),
```

### Step 2: Page liste des bons

```typescript
// app/(app)/commandes/page.tsx
'use client'
import { trpc } from '@/lib/trpc/client'
import Link from 'next/link'

const STATUT_LABELS = {
  brouillon: { label: 'Brouillon', color: 'text-gray-500 bg-gray-100' },
  envoye: { label: 'Envoyé', color: 'text-blue-600 bg-blue-50' },
  confirme: { label: 'Confirmé', color: 'text-success bg-green-50' },
  recu: { label: 'Reçu', color: 'text-primary bg-primary/10' },
}

export default function CommandesPage() {
  const { data: bons } = trpc.commandes.listBons.useQuery()

  return (
    <div className="max-w-2xl mx-auto px-4 py-6">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-bold text-primary">Commandes</h1>
        <Link href="/commandes/nouveau" className="px-4 py-2 bg-accent text-white rounded-xl font-medium" data-testid="new-commande-button">
          + Nouveau
        </Link>
      </div>

      <div className="space-y-3">
        {bons?.map(bon => {
          const statut = STATUT_LABELS[bon.statut as keyof typeof STATUT_LABELS]
          return (
            <Link key={bon.id} href={`/commandes/${bon.id}`}>
              <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100 active:scale-98 transition-transform" data-testid={`bon-${bon.id}`}>
                <div className="flex items-center justify-between">
                  <h3 className="font-semibold text-gray-900">{(bon.fournisseur as any)?.nom}</h3>
                  <span className={`text-xs px-2 py-1 rounded-full font-medium ${statut?.color}`}>
                    {statut?.label}
                  </span>
                </div>
                <p className="text-lg font-bold text-primary mt-1">{bon.total_ht?.toFixed(2)} € HT</p>
                {bon.date_livraison_souhaitee && (
                  <p className="text-xs text-gray-400 mt-1">
                    Livraison souhaitée: {new Date(bon.date_livraison_souhaitee).toLocaleDateString('fr-FR')}
                  </p>
                )}
              </div>
            </Link>
          )
        })}
        {bons?.length === 0 && (
          <div className="text-center py-12 text-gray-500">
            <p>Aucune commande</p>
            <Link href="/commandes/nouveau" className="text-accent text-sm mt-2 block">Créer une commande →</Link>
          </div>
        )}
      </div>
    </div>
  )
}
```

### Step 3: Page création bon de commande

```typescript
// app/(app)/commandes/nouveau/page.tsx
'use client'
import { trpc } from '@/lib/trpc/client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'

export default function NouveauBonPage() {
  const router = useRouter()
  const [selectedFournisseur, setSelectedFournisseur] = useState('')
  const [dateLivraison, setDateLivraison] = useState('')
  const [lignes, setLignes] = useState<any[]>([])

  const { data: fournisseurs } = trpc.commandes.listFournisseurs.useQuery()
  const { data: mercuriale } = trpc.commandes.getMercuriale.useQuery()
  const generateBon = trpc.commandes.generateBonDeCommande.useMutation({
    onSuccess: ({ bon_id }) => router.push(`/commandes/${bon_id}`),
  })

  const addLigne = (ingredient: any) => {
    if (!lignes.find(l => l.ingredient_id === ingredient.ingredient_id)) {
      setLignes([...lignes, {
        ingredient_id: ingredient.ingredient_id,
        nom_produit: ingredient.ingredient?.nom ?? ingredient.ingredient_id,
        quantite: 1,
        unite: ingredient.unite,
        prix_unitaire: ingredient.prix,
      }])
    }
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-6">
      <h1 className="text-xl font-bold text-primary mb-6">Nouveau bon de commande</h1>

      <div className="space-y-4">
        <select
          value={selectedFournisseur}
          onChange={e => setSelectedFournisseur(e.target.value)}
          className="w-full px-4 py-3 rounded-xl border border-gray-200 bg-white"
          data-testid="fournisseur-select"
        >
          <option value="">Sélectionner un fournisseur</option>
          {fournisseurs?.map(f => (
            <option key={f.id} value={f.id}>{f.nom}</option>
          ))}
        </select>

        <input
          type="date"
          value={dateLivraison}
          onChange={e => setDateLivraison(e.target.value)}
          className="w-full px-4 py-3 rounded-xl border border-gray-200"
          placeholder="Date de livraison souhaitée"
        />

        <div>
          <h3 className="text-sm font-medium text-gray-700 mb-2">Produits à commander:</h3>
          <div className="space-y-2 mb-3">
            {mercuriale?.filter(m => (m.fournisseur as any)?.id === selectedFournisseur || !selectedFournisseur)
              .map(item => (
                <button
                  key={item.id}
                  onClick={() => addLigne(item)}
                  className="w-full text-left p-3 bg-gray-50 rounded-xl hover:bg-gray-100 flex justify-between"
                >
                  <span>{(item.ingredient as any)?.nom}</span>
                  <span className="text-gray-500 text-sm">{item.prix} €/{item.unite}</span>
                </button>
              ))}
          </div>

          {lignes.map((ligne, i) => (
            <div key={i} className="flex items-center gap-2 p-2 bg-white rounded-xl border border-gray-200 mb-2">
              <span className="flex-1 text-sm">{ligne.nom_produit}</span>
              <input
                type="number"
                value={ligne.quantite}
                onChange={e => setLignes(lignes.map((l, j) => j === i ? { ...l, quantite: parseFloat(e.target.value) } : l))}
                min="0.1"
                step="0.5"
                className="w-20 px-2 py-1 border border-gray-200 rounded-lg text-center text-sm"
                data-testid={`ligne-quantite-${i}`}
              />
              <span className="text-xs text-gray-500">{ligne.unite}</span>
              <button onClick={() => setLignes(lignes.filter((_, j) => j !== i))} className="text-danger text-sm">✕</button>
            </div>
          ))}
        </div>

        {lignes.length > 0 && (
          <div className="bg-primary/5 rounded-xl p-3">
            <p className="text-sm font-medium text-primary">
              Total estimé: {lignes.reduce((sum, l) => sum + (l.quantite * (l.prix_unitaire ?? 0)), 0).toFixed(2)} € HT
            </p>
          </div>
        )}

        <button
          onClick={() => generateBon.mutate({
            fournisseur_id: selectedFournisseur,
            date_livraison_souhaitee: dateLivraison || undefined,
            lignes,
          })}
          disabled={!selectedFournisseur || lignes.length === 0 || generateBon.isPending}
          className="w-full py-4 bg-accent text-white font-semibold rounded-2xl disabled:opacity-50"
          data-testid="save-bon-button"
        >
          {generateBon.isPending ? 'Création...' : 'Créer le bon de commande'}
        </button>
      </div>
    </div>
  )
}
```

### Step 4: Composant BonDeCommandePreview

```typescript
// components/commandes/BonDeCommandePreview.tsx
// Prévisualisation du bon avant envoi
// Affiche: fournisseur, date, lignes formatées, total HT
// Sera réutilisé par le PDF (Task 3.4)
```

### Step 5: Tests

```typescript
// tests/unit/bons-de-commande.test.ts
import { describe, it, expect } from 'vitest'

describe('generateBonDeCommande', () => {
  it('calcule total_ht = somme(quantite × prix_unitaire)', () => {
    const lignes = [
      { quantite: 5, prix_unitaire: 8.50 },
      { quantite: 2, prix_unitaire: 15.00 },
      { quantite: 0.5, prix_unitaire: 20.00 },
    ]
    const total = lignes.reduce((sum, l) => sum + l.quantite * l.prix_unitaire, 0)
    expect(Math.round(total * 100) / 100).toBe(82.50)
  })

  it('arrondit à 2 décimales', () => {
    const total = 3 * 7.999
    expect(Math.round(total * 100) / 100).toBe(24.00)
  })
})
```

## Files to Create

- `app/(app)/commandes/page.tsx`
- `app/(app)/commandes/nouveau/page.tsx`
- `app/(app)/commandes/[id]/page.tsx` (détail + actions envoi)
- `components/commandes/BonDeCommandePreview.tsx`
- `tests/unit/bons-de-commande.test.ts`

## Files to Modify

- `server/routers/commandes.ts` — ajouter generateBonDeCommande, listBons, getBon, updateStatutBon

## Contracts

### Provides (pour tâches suivantes)
- `trpc.commandes.generateBonDeCommande(...)` → `{ bon_id }`
- `trpc.commandes.listBons()` → liste avec statuts
- `trpc.commandes.getBon({ bonId })` → bon complet avec lignes
- `trpc.commandes.updateStatutBon(...)` → mise à jour statut + `envoye_via`
- Bon de commande données pour Task 3.4 (WhatsApp/email/PDF)

### Consumes (de Task 3.1)
- `fournisseurs` table + contact WhatsApp
- `mercuriale` pour prix unitaires
- `restaurant_ingredients` pour les noms

## Acceptance Criteria

- [ ] Générer bon avec 5 lignes → total HT calculé correctement
- [ ] Liste des bons avec filtre par statut
- [ ] Modifier quantités avant envoi
- [ ] Statut mis à jour manuellement (confirme, recu)
- [ ] Bon d'un restaurant non visible par un autre (RLS)
- [ ] `npm run typecheck` passe

## Testing Protocol

### Vitest
```bash
npm run test:unit -- bons-de-commande
```

### Playwright
```typescript
await page.goto('/commandes/nouveau')
await page.selectOption('[data-testid="fournisseur-select"]', 'FOURNISSEUR_ID')
// Ajouter des lignes et vérifier total
await page.click('[data-testid="save-bon-button"]')
await expect(page).toHaveURL(/\/commandes\//)
```

### pgTAP
```sql
-- Isolation bons entre restaurants
SELECT * FROM bons_de_commande WHERE restaurant_id = 'autre_restaurant';
-- Résultat: 0 lignes
```

## Git

- Branch: `phase-3/acheter`
- Commit message prefix: `Task 3.3:`

## PROGRESS.md Update

Marquer Task 3.3 ✅ dans PROGRESS.md.
