# Task 6.4: Seed Catalogue Ingrédients (500 items)

## Objective
Peupler `ingredients_catalog` avec 500 ingrédients courants de restauration — catégories, allergènes (14 codes EU), kcal/100g, unité standard. Recherche full-text < 200ms.

## Context
Le catalogue permet la recherche lors de la création de fiches techniques. L'index full-text (`search_vector`) est généré automatiquement. La fonction SQL `search_ingredients()` doit retourner des résultats pertinents en < 200ms. Données sources: liste curatée manuelle + Open Food Facts (pour les kcal).

## Dependencies
- Task 1.2 — tables BDD créées (ingredients_catalog + search_ingredients function)

## Blocked By
- Task 1.2

## Implementation Plan

### Step 1: Structure données — data/ingredients-catalog.json (extrait)

```json
[
  {
    "nom": "Beurre doux",
    "categorie": "laitage",
    "allergenes": ["lait"],
    "kcal_par_100g": 717,
    "unite_standard": "g"
  },
  {
    "nom": "Farine de blé T55",
    "categorie": "feculent",
    "allergenes": ["gluten"],
    "kcal_par_100g": 364,
    "unite_standard": "g"
  },
  {
    "nom": "Œufs frais (calibre M)",
    "categorie": "autre",
    "allergenes": ["oeufs"],
    "kcal_par_100g": 143,
    "unite_standard": "pièce"
  },
  {
    "nom": "Lait entier",
    "categorie": "laitage",
    "allergenes": ["lait"],
    "kcal_par_100g": 61,
    "unite_standard": "ml"
  },
  {
    "nom": "Crème fraîche épaisse 30%",
    "categorie": "laitage",
    "allergenes": ["lait"],
    "kcal_par_100g": 292,
    "unite_standard": "g"
  }
]
```

### Step 2: Catégories et allergènes utilisés

```typescript
// Catégories
type Categorie = 'viande' | 'poisson' | 'legume' | 'feculent' | 'sauce' | 'fromage' | 'laitage' | 'fruit' | 'epice' | 'autre'

// 14 allergènes EU
type Allergene = 'gluten' | 'crustaces' | 'oeufs' | 'poisson' | 'arachides' | 'soja' | 'lait' | 'fruits_a_coque' | 'celeri' | 'moutarde' | 'sesame' | 'so2_sulfites' | 'lupin' | 'mollusques'
```

### Step 3: scripts/seed-ingredients-catalog.ts

```typescript
// scripts/seed-ingredients-catalog.ts
import { createClient } from '@supabase/supabase-js'
import catalogData from '../data/ingredients-catalog.json'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

async function seedCatalog() {
  console.log(`Seeding ${catalogData.length} ingredients...`)

  // Insert en batch de 100
  const BATCH_SIZE = 100
  let inserted = 0

  for (let i = 0; i < catalogData.length; i += BATCH_SIZE) {
    const batch = catalogData.slice(i, i + BATCH_SIZE)

    const { error } = await supabase
      .from('ingredients_catalog')
      .upsert(batch, { onConflict: 'nom' })

    if (error) {
      console.error(`Batch ${i / BATCH_SIZE + 1} error:`, error)
    } else {
      inserted += batch.length
      console.log(`Inserted batch ${i / BATCH_SIZE + 1}: ${inserted}/${catalogData.length}`)
    }
  }

  // Vérifier le count
  const { count } = await supabase
    .from('ingredients_catalog')
    .select('*', { count: 'exact', head: true })

  console.log(`✅ Total in catalog: ${count}`)
}

seedCatalog().catch(console.error)
```

### Step 4: supabase/seed.sql — ingrédients (extrait représentatif)

```sql
-- supabase/seed.sql (ingrédients catalog — 500 lignes)
INSERT INTO ingredients_catalog (nom, categorie, allergenes, kcal_par_100g, unite_standard) VALUES

-- VIANDES (50)
('Poulet (blanc)', 'viande', '{}', 165, 'g'),
('Poulet (cuisse)', 'viande', '{}', 209, 'g'),
('Bœuf haché 5%MG', 'viande', '{}', 137, 'g'),
('Bœuf (entrecôte)', 'viande', '{}', 271, 'g'),
('Veau (escalope)', 'viande', '{}', 131, 'g'),
('Porc (filet)', 'viande', '{}', 143, 'g'),
('Canard (magret)', 'viande', '{}', 201, 'g'),
('Agneau (gigot)', 'viande', '{}', 282, 'g'),
('Lapin (râble)', 'viande', '{}', 136, 'g'),
('Dinde (blanc)', 'viande', '{}', 104, 'g'),

-- POISSONS & FRUITS DE MER (50)
('Saumon (filet)', 'poisson', '{"poisson"}', 208, 'g'),
('Cabillaud (filet)', 'poisson', '{"poisson"}', 82, 'g'),
('Thon rouge', 'poisson', '{"poisson"}', 144, 'g'),
('Crevettes roses', 'poisson', '{"crustaces"}', 85, 'g'),
('Moules', 'poisson', '{"mollusques"}', 86, 'g'),
('Sole (filet)', 'poisson', '{"poisson"}', 83, 'g'),
('Bar (loup de mer)', 'poisson', '{"poisson"}', 97, 'g'),
('Daurade royale', 'poisson', '{"poisson"}', 96, 'g'),
('Gambas', 'poisson', '{"crustaces"}', 90, 'g'),
('Saint-Jacques', 'poisson', '{"mollusques"}', 88, 'g'),

-- LÉGUMES (100)
('Tomates', 'legume', '{}', 18, 'g'),
('Oignons', 'legume', '{}', 40, 'g'),
('Ail', 'legume', '{}', 149, 'g'),
('Carottes', 'legume', '{}', 41, 'g'),
('Pommes de terre', 'legume', '{}', 77, 'g'),
('Champignons de Paris', 'legume', '{}', 22, 'g'),
('Épinards', 'legume', '{}', 23, 'g'),
('Courgettes', 'legume', '{}', 17, 'g'),
('Aubergines', 'legume', '{}', 25, 'g'),
('Poivrons rouges', 'legume', '{}', 31, 'g'),
('Poivrons verts', 'legume', '{}', 20, 'g'),
('Brocoli', 'legume', '{}', 34, 'g'),
('Chou-fleur', 'legume', '{}', 25, 'g'),
('Poireaux', 'legume', '{}', 31, 'g'),
('Céleri-rave', 'legume', '{"celeri"}', 42, 'g'),
('Fenouil', 'legume', '{}', 31, 'g'),
('Artichaut', 'legume', '{}', 53, 'g'),
('Asperges', 'legume', '{}', 20, 'g'),
('Haricots verts', 'legume', '{}', 31, 'g'),
('Petits pois', 'legume', '{}', 81, 'g'),

-- FÉCULENTS (50)
('Farine de blé T45', 'feculent', '{"gluten"}', 364, 'g'),
('Farine de blé T55', 'feculent', '{"gluten"}', 364, 'g'),
('Farine de blé T65', 'feculent', '{"gluten"}', 354, 'g'),
('Riz basmati', 'feculent', '{}', 351, 'g'),
('Riz arborio', 'feculent', '{}', 350, 'g'),
('Pâtes sèches (tagliatelles)', 'feculent', '{"gluten","oeufs"}', 352, 'g'),
('Pâtes sèches (linguines)', 'feculent', '{"gluten"}', 352, 'g'),
('Lentilles vertes', 'feculent', '{}', 353, 'g'),
('Quinoa', 'feculent', '{}', 368, 'g'),
('Pain de mie', 'feculent', '{"gluten"}', 266, 'g'),

-- LAITAGES (50)
('Beurre doux', 'laitage', '{"lait"}', 717, 'g'),
('Beurre demi-sel', 'laitage', '{"lait"}', 717, 'g'),
('Crème fraîche épaisse 30%', 'laitage', '{"lait"}', 292, 'g'),
('Crème liquide 35%', 'laitage', '{"lait"}', 345, 'g'),
('Lait entier', 'laitage', '{"lait"}', 61, 'ml'),
('Lait demi-écrémé', 'laitage', '{"lait"}', 45, 'ml'),
('Yaourt nature', 'laitage', '{"lait"}', 59, 'g'),
('Mozzarella', 'laitage', '{"lait"}', 280, 'g'),

-- FROMAGES (50)
('Parmesan (reggiano)', 'fromage', '{"lait"}', 431, 'g'),
('Gruyère', 'fromage', '{"lait"}', 413, 'g'),
('Comté 12 mois', 'fromage', '{"lait"}', 409, 'g'),
('Roquefort', 'fromage', '{"lait"}', 369, 'g'),
('Brie de Meaux', 'fromage', '{"lait"}', 334, 'g'),
('Camembert', 'fromage', '{"lait"}', 300, 'g'),
('Chèvre frais', 'fromage', '{"lait"}', 268, 'g'),
('Emmental', 'fromage', '{"lait"}', 380, 'g'),
('Ricotta', 'fromage', '{"lait"}', 174, 'g'),
('Mascarpone', 'fromage', '{"lait"}', 429, 'g'),

-- FRUITS (50)
('Citrons', 'fruit', '{}', 29, 'g'),
('Oranges', 'fruit', '{}', 47, 'g'),
('Pommes (golden)', 'fruit', '{}', 52, 'g'),
('Poires (conférence)', 'fruit', '{}', 57, 'g'),
('Framboises', 'fruit', '{}', 52, 'g'),
('Fraises', 'fruit', '{}', 32, 'g'),

-- ÉPICES & CONDIMENTS (50)
('Sel fin', 'epice', '{}', 0, 'g'),
('Poivre noir moulu', 'epice', '{}', 251, 'g'),
('Paprika doux', 'epice', '{}', 282, 'g'),
('Cumin moulu', 'epice', '{}', 375, 'g'),
('Thym séché', 'epice', '{}', 101, 'g'),
('Romarin séché', 'epice', '{}', 131, 'g'),
('Basilic frais', 'epice', '{}', 22, 'g'),
('Cerfeuil frais', 'epice', '{}', 26, 'g'),
('Moutarde de Dijon', 'epice', '{"moutarde"}', 66, 'g'),
('Huile d\'olive extra vierge', 'sauce', '{}', 884, 'ml'),

-- SAUCES & FONDS (50)
('Fond de veau', 'sauce', '{}', 18, 'ml'),
('Fond de volaille', 'sauce', '{}', 15, 'ml'),
('Vinaigre balsamique', 'sauce', '{"so2_sulfites"}', 88, 'ml'),
('Sauce soja', 'sauce', '{"gluten","soja"}', 53, 'ml'),
('Concentré de tomates', 'sauce', '{}', 82, 'g'),
('Coulis de tomates', 'sauce', '{}', 35, 'g')

ON CONFLICT (nom) DO NOTHING;
```

### Step 5: Vérification — fonction search_ingredients

```sql
-- La fonction search_ingredients() doit être créée en Task 1.2
-- Vérification post-seed:
SELECT count(*) FROM ingredients_catalog;
-- Attendu: ≥ 500

SELECT * FROM search_ingredients('beurre', NULL, 10);
-- Attendu: ≥ 3 résultats (beurre doux, beurre demi-sel, etc.)

SELECT * FROM search_ingredients('escalope', NULL, 10);
-- Attendu: ≥ 2 résultats

-- Vérifier allergènes pour lait entier
SELECT allergenes FROM ingredients_catalog WHERE nom ILIKE '%lait entier%';
-- Attendu: {"lait"}
```

### Step 6: Tests

```typescript
// tests/unit/ingredients-catalog.test.ts
import { describe, it, expect } from 'vitest'

describe('ingredients-catalog seed', () => {
  it('data file contains >= 500 entries', async () => {
    const data = await import('@/data/ingredients-catalog.json')
    expect(data.default.length).toBeGreaterThanOrEqual(500)
  })

  it('all entries have required fields', async () => {
    const data = await import('@/data/ingredients-catalog.json')
    for (const item of data.default) {
      expect(item.nom).toBeTruthy()
      expect(item.categorie).toBeTruthy()
      expect(Array.isArray(item.allergenes)).toBe(true)
      expect(typeof item.kcal_par_100g).toBe('number')
      expect(item.unite_standard).toBeTruthy()
    }
  })

  it('lait entier has lait allergen', async () => {
    const data = await import('@/data/ingredients-catalog.json')
    const lait = data.default.find((i: any) => i.nom === 'Lait entier')
    expect(lait).toBeDefined()
    expect(lait!.allergenes).toContain('lait')
  })
})
```

## Files to Create

- `data/ingredients-catalog.json` (500+ items)
- `scripts/seed-ingredients-catalog.ts`
- `tests/unit/ingredients-catalog.test.ts`

## Files to Modify

- `supabase/seed.sql` — ajouter INSERT INTO ingredients_catalog (500 lignes)

## Acceptance Criteria

- [ ] `supabase db reset` → 500+ ingrédients dans `ingredients_catalog`
- [ ] `SELECT * FROM search_ingredients('beurre', null, 10)` → ≥ 3 résultats
- [ ] `SELECT * FROM search_ingredients('escalope', null, 10)` → ≥ 2 résultats
- [ ] Allergènes corrects pour "lait entier" → `['lait']`
- [ ] Recherche "beurre" dans formulaire fiche technique → suggestions < 200ms

## Testing Protocol

### SQL direct
```bash
supabase db reset
psql $DATABASE_URL -c "SELECT count(*) FROM ingredients_catalog;"
psql $DATABASE_URL -c "SELECT nom FROM search_ingredients('beurre', NULL, 10);"
```

### Vitest
```bash
npm run test:unit -- ingredients-catalog
```

### Playwright
```bash
npx playwright test tests/e2e/dish-full-flow.spec.ts --project="iPhone 14 Safari"
# Vérifier: dans formulaire fiche → recherche "beurre" → suggestions apparaissent < 200ms
```

## Git

- Branch: `phase-6/finitions`
- Commit message prefix: `Task 6.4:`

## PROGRESS.md Update

Marquer Task 6.4 ✅ dans PROGRESS.md.
