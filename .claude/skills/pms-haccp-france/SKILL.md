---
name: pms-haccp-france
description: Module PMS (Plan de Maîtrise Sanitaire) — réglementation HACCP France. Utilise quand tu implémentes les features températures, checklists, réceptions, HACCP, RappelConso ou export DDPP.
---

# PMS HACCP — Réglementation France

## Températures réglementaires par défaut

| Type équipement | temp_min | temp_max |
|---|---|---|
| frigo | 0°C | +4°C |
| congelateur | -25°C | -18°C |
| bain_marie | +63°C | +85°C |
| chambre_froide | 0°C | +4°C |

## Règle d'immutabilité (CRITIQUE)
Les relevés de température et les checklists NE PEUVENT PAS être modifiés ou supprimés.
**Jamais de UPDATE ni DELETE sur temperature_logs et nettoyage_completions.**
Si erreur : créer un nouveau relevé avec `action_corrective = "Correction de l'entrée précédente [ID]"`.

## Rétention des données
3 ans minimum pour tous les registres PMS (obligation légale France).
Archivage automatique via pg_cron (déjà configuré).
Viande bovine : 5 ans.

## 14 Allergènes obligatoires (EU 1169/2011)
```typescript
export const ALLERGENES_EU = [
  'gluten', 'crustaces', 'oeufs', 'poisson', 'arachides',
  'soja', 'lait', 'fruits_a_coque', 'celeri', 'moutarde',
  'sesame', 'sulfites', 'lupin', 'mollusques'
] as const
```

## HACCP auto-génération
Déclenché uniquement à la demande du restaurateur (bouton "Générer mon plan HACCP").
Utilise Claude Haiku pour analyser les fiches techniques et identifier les CCP.
Températures à cœur obligatoires : volaille 74°C, bœuf haché 70°C, bœuf entier 63°C.

## RappelConso
- Cron 21h quotidien
- API : `https://data.economie.gouv.fr/api/explore/v2.1/catalog/datasets/rappelconso0/records`
- Matching : nom ingrédient + marque dans mercuriale
- Heartbeat BetterUptime après chaque exécution

## Export DDPP
- PDF généré via @react-pdf/renderer (runtime Node.js, PAS Edge)
- Contenu : 12 mois de relevés T°, checklists, réceptions, rappels, plan HACCP
- Généré à la demande depuis `/pms/export`

## Offline-first (Background Sync)
Les saisies de relevés doivent fonctionner sans réseau (chambres froides sans WiFi).
Service Worker queue → sync automatique au retour du réseau.
Voir research/next-js-pwa-supabase.md section 2.

## Références
- Réglementation complète : research/pms-haccp-reglementation-france.md
- Schéma tables PMS : research/database-multitenant-rls.md (section tables PMS)
- RappelConso API : research/integrations-externes.md section 5
