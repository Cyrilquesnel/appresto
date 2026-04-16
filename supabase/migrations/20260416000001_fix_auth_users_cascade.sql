-- Fix: ajouter ON DELETE SET NULL sur toutes les FK vers auth.users sans CASCADE
-- Ces colonnes sont des "auteur/modifié par" — on veut conserver la donnée mais nullifier le lien
-- quand un user est supprimé (contrairement aux tables d'appartenance qui ont déjà ON DELETE CASCADE)

-- fiche_technique_versions.modifie_par
ALTER TABLE fiche_technique_versions
  DROP CONSTRAINT IF EXISTS fiche_technique_versions_modifie_par_fkey,
  ADD CONSTRAINT fiche_technique_versions_modifie_par_fkey
    FOREIGN KEY (modifie_par) REFERENCES auth.users(id) ON DELETE SET NULL;

-- inventaire_reel.auteur_id
ALTER TABLE inventaire_reel
  DROP CONSTRAINT IF EXISTS inventaire_reel_auteur_id_fkey,
  ADD CONSTRAINT inventaire_reel_auteur_id_fkey
    FOREIGN KEY (auteur_id) REFERENCES auth.users(id) ON DELETE SET NULL;

-- events.user_id
ALTER TABLE events
  DROP CONSTRAINT IF EXISTS events_user_id_fkey,
  ADD CONSTRAINT events_user_id_fkey
    FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE SET NULL;

-- temperature_logs.auteur_id
ALTER TABLE temperature_logs
  DROP CONSTRAINT IF EXISTS temperature_logs_auteur_id_fkey,
  ADD CONSTRAINT temperature_logs_auteur_id_fkey
    FOREIGN KEY (auteur_id) REFERENCES auth.users(id) ON DELETE SET NULL;

-- nettoyage_completions.auteur_id
ALTER TABLE nettoyage_completions
  DROP CONSTRAINT IF EXISTS nettoyage_completions_auteur_id_fkey,
  ADD CONSTRAINT nettoyage_completions_auteur_id_fkey
    FOREIGN KEY (auteur_id) REFERENCES auth.users(id) ON DELETE SET NULL;

-- formations_hygiene.user_id
ALTER TABLE formations_hygiene
  DROP CONSTRAINT IF EXISTS formations_hygiene_user_id_fkey,
  ADD CONSTRAINT formations_hygiene_user_id_fkey
    FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE SET NULL;

-- ingredient_merge_log.merged_by
ALTER TABLE ingredient_merge_log
  DROP CONSTRAINT IF EXISTS ingredient_merge_log_merged_by_fkey,
  ADD CONSTRAINT ingredient_merge_log_merged_by_fkey
    FOREIGN KEY (merged_by) REFERENCES auth.users(id) ON DELETE SET NULL;

-- ingredient_supplier_mappings.confirmed_by
ALTER TABLE ingredient_supplier_mappings
  DROP CONSTRAINT IF EXISTS ingredient_supplier_mappings_confirmed_by_fkey,
  ADD CONSTRAINT ingredient_supplier_mappings_confirmed_by_fkey
    FOREIGN KEY (confirmed_by) REFERENCES auth.users(id) ON DELETE SET NULL;
