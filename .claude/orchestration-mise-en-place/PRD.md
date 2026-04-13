# Mise en Place — Product Requirements Document

**Created**: 2026-04-12
**Status**: Draft — validé par discussion
**Source**: Cahier des charges v1.0 + sessions d'analyse architecture/devops

---

## 1. Vision

**Mise en Place** est un copilote opérationnel mobile (PWA) pour le restaurateur indépendant. Il transforme une simple photo de plat en système complet de gestion : fiche technique, calcul de coût de revient, bons de commande fournisseurs, tableau de bord de rentabilité — tout depuis le téléphone, sans formation, en moins de 2 minutes d'action.

Le vrai concurrent n'est pas un ERP ou Lightspeed. C'est **la tête du restaurateur + un carnet + WhatsApp + un coup de fil au fournisseur**. L'outil doit être plus simple que ce que le restaurateur fait déjà aujourd'hui.

Ajout stratégique pré-lancement : le **module PMS (Plan de Maîtrise Sanitaire)** — digitalisation de l'obligation légale HACCP. Relevés de température, checklists nettoyage, traçabilité fournisseurs, export DDPP. Ce module transforme l'outil d'un "nice-to-have" en outil indispensable avec coût de changement élevé.

**Phrase clé produit :** *"Tu sais enfin ce qui se passe vraiment dans ta cuisine — et ce que ça coûte vraiment."*

---

## 2. Core Features

### Pilier OPÉRER
- Détection ingrédients par photo (Gemini 2.0 Flash Vision + Claude texte enrichissement)
- Fiche technique assistée : validation, grammages, allergènes, valeurs nutritionnelles
- Calcul coût de revient automatique (cascade depuis mercuriale, asynchrone)
- Fiche de mise en place auto-générée depuis fiche technique
- Gestion allergènes temps réel (mise à jour cascade)
- Inventaire rapide terrain (saisie fin de service)
- Saisie vocale inventaire (Whisper API — V2)

### Pilier ACHETER
- Mercuriale intelligente (catalogue global Open Food Facts seedé + overrides restaurant)
- Association ingrédient/fournisseur avec fournisseur habituel par ligne de fiche
- Bon de commande automatique par fournisseur (depuis prévision de production)
- Export WhatsApp Business / email / PDF
- OCR factures fournisseurs → mise à jour mercuriale automatique
- Historique des prix fournisseurs
- Comparateur prix fournisseurs (V2)

### Pilier PILOTER
- Dashboard mobile : food cost %, masse salariale %, seuil de rentabilité
- Saisie ventes quotidienne (formulaire rapide — en attendant intégration POS)
- Intégration POS : Lightspeed, Zelty, Tiller (webhooks — phase commercialisation)
- Alertes trésorerie 15/30 jours (V2)
- Benchmarking vs marché (V2)
- Score santé global établissement (V3)
- Contrôle des écarts : inventaire théorique vs réel, détection anomalies (V2)

### Pilier DÉVELOPPER
- Menu engineering : Star / Vache à lait / Puzzle / Poids mort
- Carte anti-gaspi : suggestions recettes avec produits proches péremption
- Carte saisonnière auto
- Prévision météo → production (V3)

### Module PMS (Plan de Maîtrise Sanitaire)
- Relevés de température : push notification, saisie 2 taps, alerte hors-plage, historique graphique
- Offline-first : Background Sync pour saisies sans réseau (cuisine/chambre froide)
- Checklists nettoyage : pré-service, post-service, hebdo, mensuel
- Réception marchandises : OCR facture → n° lot, DLC, température réception, traçabilité
- HACCP auto-génération depuis les fiches techniques (points critiques par plat)
- Intégration RappelConso (API officielle gouv.fr) : alerte si produit du restaurant rappelé
- Export DDPP : PDF complet 12 mois pour contrôle sanitaire
- Suivi formations hygiène (date obtention, expiration, document)
- Mode contrôle sanitaire : vue inspecteur en 1 tap

---

## 3. User Flows

### Flow 1 : Onboarding progressif (3 jours, pas une session)
1. Jour 1 (2 min) : Création compte → type établissement → photo d'un plat → validation ingrédients détectés. C'est tout.
2. Jour 2 : Notification "Ajoutez vos prix pour voir votre food cost" → mercuriale → fournisseur
3. Jour 3 : Notification "Générez votre premier bon de commande" → prévision → bon auto

### Flow 2 : Usage quotidien opérationnel
- Matin : Dashboard — suis-je dans les clous ?
- Avant service : Prévision couverts → quantités à produire
- Commande : Bon de commande généré → envoyé WhatsApp au fournisseur en 1 tap
- Fin service : Saisie ventes (optionnel si POS connecté) + inventaire rapide

### Flow 3 : Usage quotidien PMS
- 7h : Notification → relevé température frigo/congélateur (2 taps)
- Avant service : Checklist nettoyage pré-service (60 secondes)
- À la livraison : Photo facture fournisseur → réception enregistrée + mercuriale mise à jour
- Fin de semaine : Checklist hebdomadaire
- Alerte immédiate si rappel produit (RappelConso)

### Flow 4 : Contrôle sanitaire inopiné
1. Inspecteur arrive
2. Restaurateur ouvre app → "Mode contrôle"
3. PDF généré : relevés T°, checklists, réceptions, plan HACCP — 12 mois
4. Export en 10 secondes

### Flow 5 : Mise à jour prix fournisseur → impact marges
1. Réception facture → OCR → prix beurre mis à jour dans mercuriale
2. Trigger PostgreSQL → Edge Function asynchrone
3. Tous les coûts de revient des plats contenant du beurre recalculés
4. Dashboard mis à jour → alerte si food cost dépasse cible

---

## 4. Technical Signals

- **Stack** : Next.js 14 App Router + Tailwind CSS (PWA mobile-first)
- **Backend/BDD** : Supabase (PostgreSQL + RLS + Auth + Storage + Realtime + Edge Functions)
- **AI Vision** : Gemini 2.0 Flash (image analysis — rapide, pas cher, excellent food)
- **AI Reasoning** : Claude Haiku 4.5 texte (enrichissement allergènes, HACCP) + Claude claude-sonnet-4-6 (menu engineering, suggestions complexes)
- **API layer** : tRPC (type safety end-to-end)
- **State client** : TanStack Query + Zustand
- **Déploiement** : Vercel (frontend + API routes + cron jobs)
- **Rate limiting** : Upstash Redis
- **Notifications** : Push Web PWA + Resend email
- **WhatsApp** : Meta WhatsApp Business API (bons de commande)
- **Voice** : OpenAI Whisper API (saisie inventaire vocale — V2)
- **PDF** : @react-pdf/renderer (export DDPP, bons de commande)
- **Analytics** : PostHog (RGPD-friendly)
- **Monitoring** : Sentry + BetterUptime + Vercel Analytics
- **POS integrations** : Lightspeed, Zelty, Tiller (webhooks — phase commercialisation)
- **Données seed** : Open Food Facts (catalogue ingrédients 500+ items)
- **Rappels produits** : API RappelConso data.gouv.fr
- **Offline** : Service Worker + Background Sync (critique pour PMS)

---

## 5. Open Questions

- Saisie ventes manuelle : quel est le formulaire exact le plus rapide avant intégration POS ?
- Onboarding PMS : le plan HACCP est-il généré automatiquement dès la création ou sur demande ?
- Multi-établissement : même compte = plusieurs restaurants ou comptes séparés ?
- Langues : français uniquement pour le MVP ?
- Export comptable : format exact attendu (FEC, CSV, autre) ?
- Intégration WhatsApp : numéro dédié par restaurant ou numéro Mise en Place partagé ?
- RGPD : données PMS hébergées EU — quelle région Supabase (Frankfurt) ?

---

## 6. Explicit Constraints

**MVP strict (S1–S6) :**
- Pas de benchmarking marché (nécessite base de données externe)
- Pas de menu engineering (V2)
- Pas de prévision météo (V3)
- Pas d'intégration POS (saisie manuelle des ventes au MVP)
- Pas de tunnel contenu réseaux sociaux
- Pas de comparateur prix fournisseurs (V2)

**Règles de conception non négociables :**
1. Mobile-first — tout fonctionne parfaitement sur iPhone en cuisine
2. Zéro formation — comprendre sans qu'on explique
3. Résultat en 2 minutes — chaque action produit un bénéfice visible immédiatement
4. Données imparfaites OK — fonctionne même si données incomplètes
5. Action avant analyse — l'outil dit quoi faire, pas juste quoi observer

**Contraintes techniques :**
- Cascade prix → coûts : toujours asynchrone (Edge Function), jamais synchrone
- RLS sur toutes les tables dès J1, sans exception
- restaurant_id sur toutes les tables dès J1 (multi-tenant natif)
- PMS offline-first : Background Sync obligatoire
- Rate limit AI : max 20 analyses photo/jour/restaurant
- Données PMS : rétention 3 ans (obligation légale France)

---

## 7. Success Criteria

**Beta (S6) :**
- 7/10 testeurs actifs en semaine 2
- NPS > 30
- 5/10 prêts à payer
- 0 bug bloquant
- Feature la plus utilisée identifiée

**Lancement (M6) :**
- 50 clients payants
- Churn mensuel < 5%
- ARR run rate : 35 000€

**An 1 :**
- 200 clients payants
- ARR ~120 000€
- CAC < 150€

**Technique :**
- Uptime 99.9%
- Analyse photo < 3s (Gemini Flash)
- Dashboard chargement < 1s
- Export DDPP PDF < 5s
- 0 incident de fuite de données inter-restaurant (RLS)
