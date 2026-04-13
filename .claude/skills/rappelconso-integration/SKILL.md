---
name: rappelconso-integration
description: Intégration API RappelConso (data.gouv.fr) pour alertes rappels produits. Utilise quand tu implémentes le cron de vérification ou les alertes rappel.
---

# RappelConso — API officielle France

## Endpoint
```
GET https://data.economie.gouv.fr/api/explore/v2.1/catalog/datasets/rappelconso0/records
  ?where=date_de_publication>="YYYY-MM-DD"
  &refine=categorie_de_produit:"Alimentation"
  &order_by=date_de_publication DESC
  &limit=100
```
API publique, gratuite, aucune clé requise.

## Cron schedule
```json
{ "path": "/api/cron/rappelconso", "schedule": "0 21 * * *" }
```
Vérification auth : `Authorization: Bearer ${CRON_SECRET}`.
Heartbeat BetterUptime obligatoire en fin d'exécution.

## Matching avec la mercuriale
1. `nom_produit_rappele` ILIKE `%ingredient_nom%`
2. `nom_marque_produit` ILIKE `%ingredient_nom%`
3. Déduplication via `UNIQUE(restaurant_id, rappelconso_id)`

## Actions en cas de match
1. INSERT dans `rappel_alerts` (statut: 'nouveau')
2. Push notification + email au restaurateur
3. Loguer dans `events` (type: 'rappel_produit_detecte')

## Pièges
- L'API peut être indisponible → ne pas faire crasher le cron, logger et continuer
- Matching trop large → préférer la précision sur le rappel (mieux manquer un rappel peu probable que spammer)
- Cache Redis 24h pour éviter re-fetch inutile

## Références
- Code cron complet : research/integrations-externes.md section 5
- Réglementation : research/pms-haccp-reglementation-france.md
