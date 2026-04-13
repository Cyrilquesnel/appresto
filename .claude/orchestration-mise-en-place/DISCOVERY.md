# DISCOVERY.md — Mise en Place
## Document d'autorité — Toutes les décisions produit et technique

**Date**: 2026-04-12
**Statut**: Complété — Phase 3 M2C1

> Ce document fait autorité sur toutes les décisions d'implémentation.
> En cas de contradiction avec d'autres documents, DISCOVERY.md prime.

---

## BLOC A — Équipe & Contexte

**D1. Équipe**
Solo founder. Travaille seul.
→ Implémentation : 1 seul compte GitHub, 1 seul Vercel team, branches simples (main/develop), pas de code review multi-dev.

**D2. Comptes disponibles**
- GitHub ✅
- Google AI Studio (Gemini) ✅
- Anthropic (forfait Max Claude Code) ✅
- Meta WhatsApp Business ✅
- Supabase : à créer
- Vercel : à créer
- Domaine : à choisir et acheter (pas encore)

**D3. Clés API pour l'APP en production**
Point important à distinguer :
- **Forfait Max Claude Code** = Claude Code CLI gratuit pour le développement. Ne couvre PAS les appels API de l'application.
- **GEMINI_API_KEY** (Google AI Studio) : FREE TIER = 1 500 req/jour. Suffisant pour beta (3-4 testeurs). Post-beta → passer en pay-as-you-go.
- **ANTHROPIC_API_KEY** : nécessaire pour les features Claude côté app. Coût ~$2/mois pour beta, facturable aux restaurateurs ensuite.
→ **Décision** : utiliser le free tier Gemini pour la beta. Ajouter `ANTHROPIC_API_KEY` payante dès S3 (feature enrichissement). Budget estimé beta : < $5/mois.

**D4. Beta testeurs**
3-4 testeurs disponibles. Gratuit (pas de paiement pendant la beta).
→ Volume d'appels IA très faible → free tier Gemini suffit largement.

---

## BLOC B — Produit & Scope

**D5. Multi-établissement**
Uniquement pour la commercialisation publique (pas dans le MVP ni V2).
→ La table `restaurant_users` et le champ `restaurant_id` sont créés dès J1 pour faciliter l'ajout ultérieur, mais l'UI multi-restaurant n'est pas construite avant la phase commercialisation.

**D6. Saisie des ventes avant intégration POS**
Les deux options selon le restaurateur :
- Option simple : nb de couverts + panier moyen → calcul automatique CA estimé
- Option détaillée : saisie plat par plat (pour les restaurateurs qui veulent le food cost précis)
→ Implémentation : onboarding demande la préférence. Option simple = défaut. Possible de switcher.

**D7. Plan HACCP**
Généré à la demande du restaurateur (bouton "Générer mon plan HACCP"), pas automatiquement.
→ UX : bouton dans section PMS "Créer mon plan HACCP" → génération Claude depuis les fiches techniques existantes.

**D8. Langues**
Français uniquement pour le MVP et V2.
Anglais et espagnol : hors scope jusqu'à la commercialisation internationale (non planifiée pour l'instant).
→ i18n pas nécessaire pour les 6 premiers mois.

---

## BLOC C — Technique

**D9. Domaine**
À choisir et acheter. Options probables : `miseenplace.app`, `mise-en-place.fr`, `miseenplace.fr`.
→ Action : acheter avant S5 (needed for Vercel custom domain + Resend DNS).

**D10. Export bons de commande — priorité**
1. WhatsApp Business (canal naturel des fournisseurs FR)
2. Email (Resend)
3. PDF téléchargeable
→ Tous les trois dans le MVP. WhatsApp en premier dans l'UI.

**D11. POS beta testeurs**
Non spécifié → supposer pas de POS dans les 3-4 beta testeurs.
→ Saisie ventes manuelle obligatoire pour le MVP. Intégration POS : phase commercialisation uniquement.

**D12. Stack confirmé**
Next.js 14 App Router + Supabase + Vercel + tRPC + Gemini Flash + Claude Haiku texte.

---

## BLOC D — Business & Paiement

**D13. Freemium / CB**
CB non requise au départ. Freemium 14 jours sans carte.
Switch possible vers CB requise si abus constatés (décision post-beta).
→ Implémentation : Stripe Checkout sans `payment_method_required` au départ. Feature flag pour switcher.

**D14. Structure légale**
SAS "La Fabrique Alimentaire" ✅
→ Facturation Stripe au nom de La Fabrique Alimentaire. TVA française applicable.

**D15. Stripe**
Compte Stripe existant ✅
→ Utiliser ce compte. Créer les produits Stripe (Starter €29, Pro €59, Multi €99) dès la phase commercialisation.
→ Pour la beta : pas de Stripe nécessaire (gratuit).

**D16. Pricing beta testeurs**
Entièrement gratuit. 3-4 testeurs.
→ Pas de Stripe en MVP. Activer uniquement pour la commercialisation (Phase 3).

---

## BLOC E — PMS & Conformité (décisions supplémentaires)

**D17. Températures réglementaires par défaut**
Pré-configurer selon la réglementation française :
- Frigo : 0°C à +4°C
- Congélateur : -25°C à -18°C
- Bain-marie : +63°C à +85°C
- Chambre froide : 0°C à +4°C
→ Le restaurateur peut ajuster les seuils dans les paramètres équipement.

**D18. Immutabilité des relevés PMS**
Les relevés de température et les checklists PMS ne sont JAMAIS modifiables après création (conformité légale).
→ Pas de politique UPDATE ni DELETE sur `temperature_logs` et `nettoyage_completions`.
→ Si erreur : créer un nouveau relevé avec note "correction de l'entrée précédente".

**D19. Export DDPP**
PDF généré à la demande. Couvre 12 mois glissants par défaut (paramétrable).
Contenu : relevés T°, checklists, réceptions, rappels traités, plan HACCP.

**D20. RappelConso**
Cron quotidien à 21h. Matching sur nom ingrédient + marque dans la mercuriale.
Alert push + email si match trouvé.

---

## BLOC F — Architecture technique (décisions finales)

**D21. Cascade prix → coûts**
Toujours asynchrone via trigger PostgreSQL + pg_net + Edge Function Deno.
Jamais synchrone dans une API route.

**D22. Catalogue ingrédients**
Pattern hybride : `ingredients_catalog` global (seedé Open Food Facts, 500 items) + `restaurant_ingredients` par restaurant.
Recherche full-text PostgreSQL (ts_vector français).

**D23. Versioning fiches techniques**
JSONB snapshots dans `fiche_technique_versions`. Triggered automatiquement à chaque modification de fiche ou changement de prix.

**D24. Saisie vocale inventaire**
V2 — pas dans le MVP. Whisper API, bouton microphone dans l'écran inventaire.

**D25. Event log**
Table `events` créée dès J1. Tous les événements métier importants logués (prix modifié, fiche créée, bon envoyé, relevé T° hors plage, rappel produit).

**D26. Offline PWA**
Service Worker + Background Sync pour les saisies PMS (temperatures, checklists). Critique pour zones sans WiFi (chambres froides).
Les autres fonctionnalités : online-only acceptable pour MVP.

**D27. Push notifications**
Web Push VAPID. Fallback email si iOS non installé.
Prompt "Installer l'app" affiché aux utilisateurs iOS pour activer les notifications PMS.

---

## BLOC G — Onboarding (décision UX finale)

**D28. Onboarding progressif — 3 jours**
- Jour 1 (2 min) : compte → type établissement → photo d'un plat → validation IA. C'est tout.
- Jour 2 : notification "Ajoutez vos prix pour voir votre food cost"
- Jour 3 : notification "Générez votre premier bon de commande"
→ L'app fonctionne avec données incomplètes. Enrichissement guidé progressivement.

**D29. PMS onboarding**
Débloqué après que le restaurateur a créé au moins 3 plats.
Premier écran PMS : setup équipements (2-3 frigos max par défaut).
HACCP : généré à la demande uniquement.

---

## Checklist de complétude (auto-audit Phase 3c)

| Catégorie | Statut | Notes |
|---|---|---|
| Data model | ✅ | Schéma complet dans research/database-multitenant-rls.md |
| Services externes | ✅ | Gemini, Claude, WhatsApp, Resend, Stripe, RappelConso |
| Format contenu/output | ✅ | PDF bons de commande, export DDPP, QR code allergènes |
| Gestion erreurs | ✅ | Retry Gemini, fallback email push, queue offline |
| Sécurité | ✅ | RLS toutes tables, VAPID, HMAC webhooks |
| Stratégie tests | ✅ | Vitest unit, pgTAP RLS, Playwright E2E mobile |
| Edge cases | ✅ | Offline PMS, iOS push, CB non requise |
| Performance | ✅ | < 3s analyse photo, < 1s dashboard, cascade async |
| Workflow utilisateur | ✅ | Onboarding 3 jours, usage quotidien défini |
| Déploiement | ✅ | Vercel + Supabase Cloud EU |
| Contraintes légales | ✅ | HACCP, 3 ans rétention PMS, allergènes 14 EU |
| Assets existants | ✅ | SAS La Fabrique Alimentaire, compte Stripe, comptes AI |

**Réponse à la question d'autorité :** "Si un agent d'exécution lisait uniquement DISCOVERY.md, pourrait-il prendre toutes les décisions d'implémentation sans deviner ?" → **OUI**
