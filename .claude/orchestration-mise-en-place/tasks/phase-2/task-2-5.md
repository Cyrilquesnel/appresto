# Task 2.5: Trigger Cascade Prix → Coûts (Edge Function)

## Objective
Trigger PostgreSQL sur `mercuriale` → Edge Function Deno `recalculate-costs` → mise à jour `plats.cout_de_revient` + snapshot version. Entièrement asynchrone (pg_net).

## Context
Quand un prix de la mercuriale change, tous les plats contenant cet ingrédient doivent avoir leur coût de revient recalculé. Ce calcul ne doit JAMAIS être synchrone dans une API route — il passe par un trigger → pg_net → Edge Function Deno. La règle d'or : la transaction mercuriale se termine immédiatement, le calcul se fait en arrière-plan.

## Dependencies
- Task 1.2 — tables créées, pg_net activé, Edge Function skeleton présent
- Task 2.3 — fiche_technique créée, plats.cout_de_revient existe

## Blocked By
- Tasks 1.2 + 2.3

## Implementation Plan

### Step 1: Edge Function recalculate-costs (Deno)

```typescript
// supabase/functions/recalculate-costs/index.ts
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

serve(async (req) => {
  // Vérification authorization
  const authHeader = req.headers.get('Authorization')
  if (authHeader !== `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`) {
    return new Response('Unauthorized', { status: 401 })
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  )

  const payload = await req.json() as { ingredient_id: string; nouveau_prix: number; unite: string }
  const { ingredient_id, nouveau_prix } = payload

  console.log(`[recalculate-costs] Recalcul pour ingrédient ${ingredient_id} à ${nouveau_prix}`)

  // Trouver toutes les fiches techniques utilisant cet ingrédient
  const { data: lignes, error: lignesError } = await supabase
    .from('fiche_technique')
    .select('plat_id, grammage, unite')
    .eq('ingredient_id', ingredient_id)

  if (lignesError || !lignes || lignes.length === 0) {
    console.log(`[recalculate-costs] Aucune fiche technique pour ingrédient ${ingredient_id}`)
    return new Response(JSON.stringify({ updated: 0 }), {
      headers: { 'Content-Type': 'application/json' },
    })
  }

  // Grouper par plat
  const platIds = [...new Set(lignes.map(l => l.plat_id))]
  let updatedCount = 0

  for (const platId of platIds) {
    // Récupérer toutes les lignes de ce plat avec leurs prix mercuriale
    const { data: allLignes } = await supabase
      .from('fiche_technique')
      .select(`
        grammage, unite,
        ingredient_id,
        mercuriale!inner(prix, unite, est_actif)
      `)
      .eq('plat_id', platId)
      .eq('mercuriale.est_actif', true)

    if (!allLignes) continue

    // Calculer le coût total du plat
    let coutTotal = 0
    let allPriced = true

    for (const ligne of allLignes) {
      const mercuriale = Array.isArray(ligne.mercuriale) 
        ? ligne.mercuriale[0] 
        : ligne.mercuriale

      if (!mercuriale?.prix) {
        allPriced = false
        continue
      }

      // Convertir tout en grammes (prix = €/kg par convention)
      const grammageEnG = ligne.grammage // assumé en g
      const prixParG = mercuriale.prix / 1000 // €/kg → €/g
      coutTotal += grammageEnG * prixParG
    }

    const coutDeRevient = allPriced && coutTotal > 0 ? Math.round(coutTotal * 100) / 100 : null

    // UPDATE plat
    const { error: updateError } = await supabase
      .from('plats')
      .update({ cout_de_revient: coutDeRevient, updated_at: new Date().toISOString() })
      .eq('id', platId)

    if (!updateError) {
      // Créer un snapshot de version
      const { count } = await supabase
        .from('fiche_technique_versions')
        .select('*', { count: 'exact', head: true })
        .eq('plat_id', platId)

      await supabase.from('fiche_technique_versions').insert({
        plat_id: platId,
        version: (count ?? 0) + 1,
        snapshot: { type: 'recalcul_prix', ingredient_id, nouveau_prix, cout_de_revient: coutDeRevient },
        auteur_id: null, // système
        restaurant_id: (await supabase.from('plats').select('restaurant_id').eq('id', platId).single()).data?.restaurant_id,
      })

      updatedCount++
    }
  }

  console.log(`[recalculate-costs] ${updatedCount} plats mis à jour`)
  return new Response(JSON.stringify({ updated: updatedCount }), {
    headers: { 'Content-Type': 'application/json' },
  })
})
```

### Step 2: Trigger PostgreSQL + pg_net

```sql
-- supabase/migrations/20260101000004_triggers_cascade.sql
-- (compléter/remplacer le placeholder de Task 1.2)

-- Activer pg_net si pas déjà fait
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Fonction trigger pour appeler Edge Function recalculate-costs
CREATE OR REPLACE FUNCTION trigger_recalculate_costs()
RETURNS TRIGGER AS $$
DECLARE
  v_url TEXT;
  v_service_key TEXT;
BEGIN
  v_url := current_setting('app.supabase_url', true) || '/functions/v1/recalculate-costs';
  v_service_key := current_setting('app.service_role_key', true);

  -- Appel asynchrone via pg_net — non-bloquant
  PERFORM net.http_post(
    url := v_url,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || v_service_key
    ),
    body := jsonb_build_object(
      'ingredient_id', NEW.ingredient_id,
      'nouveau_prix', NEW.prix,
      'unite', NEW.unite
    )::text
  );

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger sur mercuriale (INSERT ou UPDATE du prix)
DROP TRIGGER IF EXISTS after_mercuriale_price_change ON mercuriale;
CREATE TRIGGER after_mercuriale_price_change
  AFTER INSERT OR UPDATE OF prix ON mercuriale
  FOR EACH ROW
  WHEN (NEW.est_actif = TRUE)
  EXECUTE FUNCTION trigger_recalculate_costs();
```

### Step 3: Configuration des settings PostgreSQL pour le trigger

```sql
-- Dans supabase/migrations ou seed.sql :
-- Ces settings permettent au trigger de lire l'URL et la clé service

-- ATTENTION: en production, utiliser vault ou un autre mécanisme sécurisé
-- En dev local: ces valeurs correspondent au Supabase local
ALTER DATABASE postgres SET app.supabase_url = 'http://localhost:54321';
-- La service_role_key doit être injectée via un autre mécanisme
-- Alternative: lire depuis une table de config ou un secret Supabase Vault
```

**Note pour l'agent**: Le passage de la service_role_key au trigger est délicat. Deux approches :
1. Vault Supabase (recommandé prod) : stocker dans `vault.secrets`, lire dans le trigger
2. Env var PostgreSQL via ALTER DATABASE (dev) — ne PAS commiter la vraie clé
3. Alternative simple : utiliser une fonction RPC anon_key + vérification dans Edge Function

Pour la dev locale, utiliser la clé de dev (non-sensible) directement. Pour la prod, utiliser Vault.

### Step 4: Tests

```typescript
// tests/unit/recalculate-costs.test.ts
import { describe, it, expect } from 'vitest'

describe('calcul cout_de_revient', () => {
  it('calcule correctement le coût pour un plat simple', () => {
    // Formule: grammage(g) × prix(€/kg) / 1000
    const grammage = 200 // g
    const prixParKg = 15.00 // €/kg
    const cout = (grammage * prixParKg) / 1000
    expect(cout).toBe(3.00) // 200g de produit à 15€/kg = 3€
  })

  it('retourne null si tous les ingrédients ne sont pas pricés', () => {
    const lignesAvecPrix = [
      { grammage: 200, prix: 15.00, has_price: true },
      { grammage: 100, prix: null, has_price: false }, // pas de prix
    ]
    const allPriced = lignesAvecPrix.every(l => l.has_price)
    expect(allPriced).toBe(false)
    // cout_de_revient = null si pas tous pricés
  })

  it('arrondit à 2 décimales', () => {
    const grammage = 333 // g
    const prixParKg = 10.00
    const cout = Math.round((grammage * prixParKg / 1000) * 100) / 100
    expect(cout).toBe(3.33)
  })
})
```

### Step 5: Test d'intégration SQL

```sql
-- À exécuter après supabase start pour vérifier le trigger
-- tests/integration/cascade.sql (ou dans le test runner)

-- 1. Créer un plat avec ingrédient et mercuriale
-- 2. INSERT mercuriale → vérifier que le trigger s'exécute
-- 3. Attendre 5s → vérifier cout_de_revient mis à jour

-- Vérifier les logs pg_net
SELECT * FROM net._http_response ORDER BY created DESC LIMIT 5;
```

## Files to Create

- `supabase/functions/recalculate-costs/index.ts` (Edge Function Deno)
- `tests/unit/recalculate-costs.test.ts`

## Files to Modify

- `supabase/migrations/20260101000004_triggers_cascade.sql` — trigger complet avec pg_net
- `supabase/functions/recalculate-costs/index.ts` — remplacer placeholder de Task 1.2

## Contracts

### Provides (pour tâches suivantes)
- Trigger automatique: UPDATE mercuriale → recalcul cout_de_revient dans les 5s
- Nouveau snapshot fiche_technique_versions après recalcul
- `plats.cout_de_revient` toujours à jour (null si prix manquants)

### Consumes (de Tasks 1.2 + 2.3)
- Tables: mercuriale, fiche_technique, plats, fiche_technique_versions
- pg_net activé (Task 1.2)
- Edge Function skeleton (Task 1.2)

## Acceptance Criteria

- [ ] INSERT prix dans mercuriale → plats.cout_de_revient mis à jour (dans les 5s)
- [ ] UPDATE prix d'un ingrédient → tous les plats contenant cet ingrédient recalculés
- [ ] Nouveau snapshot fiche_technique_versions créé après recalcul
- [ ] Transaction mercuriale se termine immédiatement (appel Edge Function non-bloquant)
- [ ] Log Edge Function visible dans Supabase dashboard (Function logs)
- [ ] Si certains ingrédients sans prix → cout_de_revient = null (pas d'erreur)

## Testing Protocol

### SQL direct
```sql
-- Insérer un prix
INSERT INTO mercuriale (restaurant_id, ingredient_id, fournisseur_id, prix, unite, est_actif)
VALUES ('...', '...', '...', 15.00, 'kg', true);

-- Attendre 5s
SELECT pg_sleep(5);

-- Vérifier recalcul
SELECT id, nom, cout_de_revient FROM plats WHERE restaurant_id = '...';
```

### Log Supabase
- Aller dans Supabase dashboard → Edge Functions → recalculate-costs → Logs
- Vérifier message `[recalculate-costs] X plats mis à jour`

### Vitest
```bash
npm run test:unit -- recalculate-costs
```

## Git

- Branch: `phase-2/operer`
- Commit message prefix: `Task 2.5:`

## PROGRESS.md Update

Marquer Task 2.5 ✅ dans PROGRESS.md.
