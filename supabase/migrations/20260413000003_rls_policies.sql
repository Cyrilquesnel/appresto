-- Fonction helper multi-tenant
CREATE OR REPLACE FUNCTION get_user_restaurant_id()
RETURNS UUID AS $$
  SELECT restaurant_id FROM restaurant_users
  WHERE user_id = auth.uid()
  LIMIT 1;
$$ LANGUAGE SQL SECURITY DEFINER STABLE;

-- Activer RLS sur toutes les tables
ALTER TABLE restaurants ENABLE ROW LEVEL SECURITY;
ALTER TABLE restaurant_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE ingredients_catalog ENABLE ROW LEVEL SECURITY;
ALTER TABLE restaurant_ingredients ENABLE ROW LEVEL SECURITY;
ALTER TABLE plats ENABLE ROW LEVEL SECURITY;
ALTER TABLE fiche_technique ENABLE ROW LEVEL SECURITY;
ALTER TABLE fiche_technique_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE fiche_mise_en_place ENABLE ROW LEVEL SECURITY;
ALTER TABLE fournisseurs ENABLE ROW LEVEL SECURITY;
ALTER TABLE mercuriale ENABLE ROW LEVEL SECURITY;
ALTER TABLE bons_de_commande ENABLE ROW LEVEL SECURITY;
ALTER TABLE bon_de_commande_lignes ENABLE ROW LEVEL SECURITY;
ALTER TABLE ventes ENABLE ROW LEVEL SECURITY;
ALTER TABLE charges ENABLE ROW LEVEL SECURITY;
ALTER TABLE masse_salariale ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventaire_reel ENABLE ROW LEVEL SECURITY;
ALTER TABLE push_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE events ENABLE ROW LEVEL SECURITY;
ALTER TABLE equipements ENABLE ROW LEVEL SECURITY;
ALTER TABLE temperature_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE nettoyage_checklists ENABLE ROW LEVEL SECURITY;
ALTER TABLE nettoyage_completions ENABLE ROW LEVEL SECURITY;
ALTER TABLE receptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE reception_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE haccp_points_critiques ENABLE ROW LEVEL SECURITY;
ALTER TABLE rappel_alerts ENABLE ROW LEVEL SECURITY;
ALTER TABLE formations_hygiene ENABLE ROW LEVEL SECURITY;
ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;

-- RESTAURANTS (owner uniquement)
CREATE POLICY "restaurants_select" ON restaurants FOR SELECT USING (owner_id = auth.uid() OR id = get_user_restaurant_id());
CREATE POLICY "restaurants_insert" ON restaurants FOR INSERT WITH CHECK (owner_id = auth.uid());
CREATE POLICY "restaurants_update" ON restaurants FOR UPDATE USING (owner_id = auth.uid());

-- RESTAURANT_USERS
CREATE POLICY "restaurant_users_select" ON restaurant_users FOR SELECT USING (user_id = auth.uid() OR restaurant_id = get_user_restaurant_id());
CREATE POLICY "restaurant_users_insert" ON restaurant_users FOR INSERT WITH CHECK (restaurant_id = get_user_restaurant_id() OR user_id = auth.uid());

-- INGREDIENTS CATALOG (lecture publique authentifiée)
CREATE POLICY "catalog_select" ON ingredients_catalog FOR SELECT TO authenticated USING (true);

-- RESTAURANT_INGREDIENTS
CREATE POLICY "ri_select" ON restaurant_ingredients FOR SELECT USING (restaurant_id = get_user_restaurant_id());
CREATE POLICY "ri_insert" ON restaurant_ingredients FOR INSERT WITH CHECK (restaurant_id = get_user_restaurant_id());
CREATE POLICY "ri_update" ON restaurant_ingredients FOR UPDATE USING (restaurant_id = get_user_restaurant_id());
CREATE POLICY "ri_delete" ON restaurant_ingredients FOR DELETE USING (restaurant_id = get_user_restaurant_id());

-- PLATS
CREATE POLICY "plats_select" ON plats FOR SELECT USING (restaurant_id = get_user_restaurant_id());
CREATE POLICY "plats_insert" ON plats FOR INSERT WITH CHECK (restaurant_id = get_user_restaurant_id());
CREATE POLICY "plats_update" ON plats FOR UPDATE USING (restaurant_id = get_user_restaurant_id()) WITH CHECK (restaurant_id = get_user_restaurant_id());
CREATE POLICY "plats_delete" ON plats FOR DELETE USING (restaurant_id = get_user_restaurant_id());

-- FICHE_TECHNIQUE (via plat)
CREATE POLICY "fiche_technique_select" ON fiche_technique FOR SELECT USING (plat_id IN (SELECT id FROM plats WHERE restaurant_id = get_user_restaurant_id()));
CREATE POLICY "fiche_technique_insert" ON fiche_technique FOR INSERT WITH CHECK (plat_id IN (SELECT id FROM plats WHERE restaurant_id = get_user_restaurant_id()));
CREATE POLICY "fiche_technique_update" ON fiche_technique FOR UPDATE USING (plat_id IN (SELECT id FROM plats WHERE restaurant_id = get_user_restaurant_id()));
CREATE POLICY "fiche_technique_delete" ON fiche_technique FOR DELETE USING (plat_id IN (SELECT id FROM plats WHERE restaurant_id = get_user_restaurant_id()));

-- FICHE_TECHNIQUE_VERSIONS (SELECT + INSERT seulement)
CREATE POLICY "fiche_versions_select" ON fiche_technique_versions FOR SELECT USING (plat_id IN (SELECT id FROM plats WHERE restaurant_id = get_user_restaurant_id()));
CREATE POLICY "fiche_versions_insert" ON fiche_technique_versions FOR INSERT WITH CHECK (plat_id IN (SELECT id FROM plats WHERE restaurant_id = get_user_restaurant_id()));

-- FICHE_MISE_EN_PLACE
CREATE POLICY "fiche_mep_select" ON fiche_mise_en_place FOR SELECT USING (plat_id IN (SELECT id FROM plats WHERE restaurant_id = get_user_restaurant_id()));
CREATE POLICY "fiche_mep_insert" ON fiche_mise_en_place FOR INSERT WITH CHECK (plat_id IN (SELECT id FROM plats WHERE restaurant_id = get_user_restaurant_id()));
CREATE POLICY "fiche_mep_update" ON fiche_mise_en_place FOR UPDATE USING (plat_id IN (SELECT id FROM plats WHERE restaurant_id = get_user_restaurant_id()));

-- FOURNISSEURS
CREATE POLICY "fournisseurs_select" ON fournisseurs FOR SELECT USING (restaurant_id = get_user_restaurant_id());
CREATE POLICY "fournisseurs_insert" ON fournisseurs FOR INSERT WITH CHECK (restaurant_id = get_user_restaurant_id());
CREATE POLICY "fournisseurs_update" ON fournisseurs FOR UPDATE USING (restaurant_id = get_user_restaurant_id());
CREATE POLICY "fournisseurs_delete" ON fournisseurs FOR DELETE USING (restaurant_id = get_user_restaurant_id());

-- MERCURIALE
CREATE POLICY "mercuriale_select" ON mercuriale FOR SELECT USING (ingredient_id IN (SELECT id FROM restaurant_ingredients WHERE restaurant_id = get_user_restaurant_id()));
CREATE POLICY "mercuriale_insert" ON mercuriale FOR INSERT WITH CHECK (ingredient_id IN (SELECT id FROM restaurant_ingredients WHERE restaurant_id = get_user_restaurant_id()));
CREATE POLICY "mercuriale_update" ON mercuriale FOR UPDATE USING (ingredient_id IN (SELECT id FROM restaurant_ingredients WHERE restaurant_id = get_user_restaurant_id()));

-- BONS DE COMMANDE
CREATE POLICY "bons_select" ON bons_de_commande FOR SELECT USING (restaurant_id = get_user_restaurant_id());
CREATE POLICY "bons_insert" ON bons_de_commande FOR INSERT WITH CHECK (restaurant_id = get_user_restaurant_id());
CREATE POLICY "bons_update" ON bons_de_commande FOR UPDATE USING (restaurant_id = get_user_restaurant_id());
CREATE POLICY "bons_delete" ON bons_de_commande FOR DELETE USING (restaurant_id = get_user_restaurant_id());

-- BON LIGNES (via bon)
CREATE POLICY "bon_lignes_select" ON bon_de_commande_lignes FOR SELECT USING (bon_id IN (SELECT id FROM bons_de_commande WHERE restaurant_id = get_user_restaurant_id()));
CREATE POLICY "bon_lignes_insert" ON bon_de_commande_lignes FOR INSERT WITH CHECK (bon_id IN (SELECT id FROM bons_de_commande WHERE restaurant_id = get_user_restaurant_id()));
CREATE POLICY "bon_lignes_update" ON bon_de_commande_lignes FOR UPDATE USING (bon_id IN (SELECT id FROM bons_de_commande WHERE restaurant_id = get_user_restaurant_id()));
CREATE POLICY "bon_lignes_delete" ON bon_de_commande_lignes FOR DELETE USING (bon_id IN (SELECT id FROM bons_de_commande WHERE restaurant_id = get_user_restaurant_id()));

-- VENTES
CREATE POLICY "ventes_select" ON ventes FOR SELECT USING (restaurant_id = get_user_restaurant_id());
CREATE POLICY "ventes_insert" ON ventes FOR INSERT WITH CHECK (restaurant_id = get_user_restaurant_id());
CREATE POLICY "ventes_update" ON ventes FOR UPDATE USING (restaurant_id = get_user_restaurant_id());
CREATE POLICY "ventes_delete" ON ventes FOR DELETE USING (restaurant_id = get_user_restaurant_id());

-- CHARGES
CREATE POLICY "charges_select" ON charges FOR SELECT USING (restaurant_id = get_user_restaurant_id());
CREATE POLICY "charges_insert" ON charges FOR INSERT WITH CHECK (restaurant_id = get_user_restaurant_id());
CREATE POLICY "charges_update" ON charges FOR UPDATE USING (restaurant_id = get_user_restaurant_id());
CREATE POLICY "charges_delete" ON charges FOR DELETE USING (restaurant_id = get_user_restaurant_id());

-- MASSE SALARIALE
CREATE POLICY "masse_select" ON masse_salariale FOR SELECT USING (restaurant_id = get_user_restaurant_id());
CREATE POLICY "masse_insert" ON masse_salariale FOR INSERT WITH CHECK (restaurant_id = get_user_restaurant_id());
CREATE POLICY "masse_update" ON masse_salariale FOR UPDATE USING (restaurant_id = get_user_restaurant_id());

-- INVENTAIRE REEL
CREATE POLICY "inventaire_select" ON inventaire_reel FOR SELECT USING (restaurant_id = get_user_restaurant_id());
CREATE POLICY "inventaire_insert" ON inventaire_reel FOR INSERT WITH CHECK (restaurant_id = get_user_restaurant_id());

-- PUSH SUBSCRIPTIONS
CREATE POLICY "push_sub_select" ON push_subscriptions FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "push_sub_insert" ON push_subscriptions FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY "push_sub_update" ON push_subscriptions FOR UPDATE USING (user_id = auth.uid());
CREATE POLICY "push_sub_delete" ON push_subscriptions FOR DELETE USING (user_id = auth.uid());

-- EVENTS
CREATE POLICY "events_select" ON events FOR SELECT USING (restaurant_id = get_user_restaurant_id());
CREATE POLICY "events_insert" ON events FOR INSERT WITH CHECK (restaurant_id = get_user_restaurant_id());

-- EQUIPEMENTS
CREATE POLICY "equipements_select" ON equipements FOR SELECT USING (restaurant_id = get_user_restaurant_id());
CREATE POLICY "equipements_insert" ON equipements FOR INSERT WITH CHECK (restaurant_id = get_user_restaurant_id());
CREATE POLICY "equipements_update" ON equipements FOR UPDATE USING (restaurant_id = get_user_restaurant_id());
CREATE POLICY "equipements_delete" ON equipements FOR DELETE USING (restaurant_id = get_user_restaurant_id());

-- TEMPERATURE LOGS : INSERT SEULEMENT (immuabilité légale HACCP)
CREATE POLICY "temp_logs_select" ON temperature_logs FOR SELECT USING (restaurant_id = get_user_restaurant_id());
CREATE POLICY "temp_logs_insert" ON temperature_logs FOR INSERT WITH CHECK (restaurant_id = get_user_restaurant_id());
-- PAS de UPDATE ni DELETE

-- NETTOYAGE CHECKLISTS
CREATE POLICY "nettoyage_checklists_select" ON nettoyage_checklists FOR SELECT USING (restaurant_id = get_user_restaurant_id());
CREATE POLICY "nettoyage_checklists_insert" ON nettoyage_checklists FOR INSERT WITH CHECK (restaurant_id = get_user_restaurant_id());
CREATE POLICY "nettoyage_checklists_update" ON nettoyage_checklists FOR UPDATE USING (restaurant_id = get_user_restaurant_id());

-- NETTOYAGE COMPLETIONS : INSERT SEULEMENT (immuabilité légale)
CREATE POLICY "nettoyage_completions_select" ON nettoyage_completions FOR SELECT USING (restaurant_id = get_user_restaurant_id());
CREATE POLICY "nettoyage_completions_insert" ON nettoyage_completions FOR INSERT WITH CHECK (restaurant_id = get_user_restaurant_id());
-- PAS de UPDATE ni DELETE

-- RECEPTIONS
CREATE POLICY "receptions_select" ON receptions FOR SELECT USING (restaurant_id = get_user_restaurant_id());
CREATE POLICY "receptions_insert" ON receptions FOR INSERT WITH CHECK (restaurant_id = get_user_restaurant_id());
CREATE POLICY "receptions_update" ON receptions FOR UPDATE USING (restaurant_id = get_user_restaurant_id());

-- RECEPTION ITEMS (via reception)
CREATE POLICY "reception_items_select" ON reception_items FOR SELECT USING (reception_id IN (SELECT id FROM receptions WHERE restaurant_id = get_user_restaurant_id()));
CREATE POLICY "reception_items_insert" ON reception_items FOR INSERT WITH CHECK (reception_id IN (SELECT id FROM receptions WHERE restaurant_id = get_user_restaurant_id()));

-- HACCP
CREATE POLICY "haccp_select" ON haccp_points_critiques FOR SELECT USING (restaurant_id = get_user_restaurant_id());
CREATE POLICY "haccp_insert" ON haccp_points_critiques FOR INSERT WITH CHECK (restaurant_id = get_user_restaurant_id());
CREATE POLICY "haccp_update" ON haccp_points_critiques FOR UPDATE USING (restaurant_id = get_user_restaurant_id());
CREATE POLICY "haccp_delete" ON haccp_points_critiques FOR DELETE USING (restaurant_id = get_user_restaurant_id());

-- RAPPEL ALERTS
CREATE POLICY "rappel_select" ON rappel_alerts FOR SELECT USING (restaurant_id = get_user_restaurant_id());
CREATE POLICY "rappel_insert" ON rappel_alerts FOR INSERT WITH CHECK (restaurant_id = get_user_restaurant_id());
CREATE POLICY "rappel_update" ON rappel_alerts FOR UPDATE USING (restaurant_id = get_user_restaurant_id());

-- FORMATIONS HYGIENE
CREATE POLICY "formations_select" ON formations_hygiene FOR SELECT USING (restaurant_id = get_user_restaurant_id());
CREATE POLICY "formations_insert" ON formations_hygiene FOR INSERT WITH CHECK (restaurant_id = get_user_restaurant_id());
CREATE POLICY "formations_update" ON formations_hygiene FOR UPDATE USING (restaurant_id = get_user_restaurant_id());

-- SUBSCRIPTIONS
CREATE POLICY "sub_select" ON subscriptions FOR SELECT USING (restaurant_id = get_user_restaurant_id());
CREATE POLICY "sub_insert" ON subscriptions FOR INSERT WITH CHECK (restaurant_id = get_user_restaurant_id());
CREATE POLICY "sub_update" ON subscriptions FOR UPDATE USING (restaurant_id = get_user_restaurant_id());
