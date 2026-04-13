---
name: supabase-rls-multitenant
description: Patterns RLS Supabase multi-tenant pour Mise en Place. Utilise quand tu crées une nouvelle table, une migration, ou des politiques de sécurité.
---

# Supabase RLS — Multi-tenant Mise en Place

## Règle absolue
**Chaque nouvelle table DOIT avoir :**
1. Une colonne `restaurant_id UUID REFERENCES restaurants(id)`
2. RLS activé (`ALTER TABLE x ENABLE ROW LEVEL SECURITY`)
3. Les 4 politiques (SELECT, INSERT, UPDATE, DELETE)

## Pattern standard (copier-coller pour chaque table)

```sql
-- Remplacer "ma_table" par le vrai nom
ALTER TABLE ma_table ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ma_table_select" ON ma_table
  FOR SELECT USING (restaurant_id = get_user_restaurant_id());

CREATE POLICY "ma_table_insert" ON ma_table
  FOR INSERT WITH CHECK (restaurant_id = get_user_restaurant_id());

CREATE POLICY "ma_table_update" ON ma_table
  FOR UPDATE USING (restaurant_id = get_user_restaurant_id())
  WITH CHECK (restaurant_id = get_user_restaurant_id());

CREATE POLICY "ma_table_delete" ON ma_table
  FOR DELETE USING (
    restaurant_id = get_user_restaurant_id() AND
    EXISTS (
      SELECT 1 FROM restaurant_users
      WHERE user_id = auth.uid()
      AND restaurant_id = ma_table.restaurant_id
      AND role IN ('owner', 'manager')
    )
  );
```

## Fonction helper (déjà créée en migration initiale)
```sql
CREATE OR REPLACE FUNCTION get_user_restaurant_id()
RETURNS UUID AS $$
  SELECT restaurant_id FROM restaurant_users
  WHERE user_id = auth.uid() LIMIT 1;
$$ LANGUAGE SQL SECURITY DEFINER STABLE;
```

## Cas spéciaux

### Tables immuables (PMS — temperature_logs, nettoyage_completions)
```sql
-- PAS de politique UPDATE ni DELETE — conformité légale
ALTER TABLE temperature_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "temp_select" ON temperature_logs FOR SELECT USING (restaurant_id = get_user_restaurant_id());
CREATE POLICY "temp_insert" ON temperature_logs FOR INSERT WITH CHECK (restaurant_id = get_user_restaurant_id());
-- Aucune politique UPDATE ou DELETE
```

### Catalogue global (ingredients_catalog)
```sql
-- Lecture publique, écriture service role uniquement
ALTER TABLE ingredients_catalog ENABLE ROW LEVEL SECURITY;
CREATE POLICY "catalog_read_all" ON ingredients_catalog FOR SELECT USING (true);
-- Pas de politique INSERT/UPDATE/DELETE pour les utilisateurs
```

## Trigger cascade prix (déjà en place)
Ne pas recréer. Voir research/database-multitenant-rls.md section 3.

## Test RLS local
```bash
supabase start
# Exécuter les tests pgTAP
psql $LOCAL_DB_URL -f supabase/tests/rls_restaurant_isolation.test.sql
```

## Pièges
- Oublier `SECURITY DEFINER` sur les fonctions helpers → accès refusé
- `get_user_restaurant_id()` retourne NULL si user non dans restaurant_users → gérer le cas
- Les vues héritent PAS automatiquement du RLS des tables sous-jacentes → tester séparément

## Références
- Schéma complet : research/database-multitenant-rls.md
- Tests pgTAP : research/cicd-devops-testing.md section 2
