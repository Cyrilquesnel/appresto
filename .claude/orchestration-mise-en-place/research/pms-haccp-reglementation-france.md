# Recherche : PMS, HACCP & Réglementation France

**Date**: 2026-04-12
**Domaine**: Module PMS — Conformité légale restauration

---

## 1. Cadre légal du PMS en France

| Texte | Contenu |
|---|---|
| Règlement CE 852/2004 | Hygiène des denrées alimentaires — socle européen. Impose HACCP à tous les opérateurs. |
| Règlement CE 853/2004 | Règles spécifiques pour les denrées d'origine animale. |
| Règlement CE 178/2002 | Loi générale alimentaire — traçabilité, principe de précaution. |
| Arrêté du 21 décembre 2009 | Températures réglementaires françaises. |
| Arrêté du 8 octobre 2013 | Adaptation française "paquet hygiène" pour la restauration. |

**PMS = BPH + Plan HACCP + Traçabilité + Gestion non-conformités**

Obligatoire pour TOUS : restaurants, food trucks, dark kitchens, traiteurs, sans seuil minimum.

---

## 2. HACCP — 7 Principes & CCP typiques

### Les 7 principes
1. Analyse des dangers (biologiques, chimiques, physiques, allergènes)
2. Identification des CCP (cuisson, refroidissement, froid, décongélation)
3. Limites critiques (T° cœur ≥ 63°C ; frigo ≤ 4°C)
4. Surveillance (relevés quotidiens, sonde à cœur)
5. Actions correctives (jet, réchauffage, alerte fournisseur)
6. Vérification (étalonnage sondes, audits)
7. Documentation — **3 ans de conservation obligatoire**

### Températures à cœur à la cuisson

| Aliment | T° minimale |
|---|---|
| Volaille | **74°C** |
| Bœuf haché | **70°C** |
| Bœuf entier | **63°C** pendant 15 secondes |
| Porc, agneau, poissons | **63°C** |
| Œufs / crèmes cuites | **74°C** |

### Refroidissement rapide (règle des 2h)
- +63°C → +10°C en **moins de 2h**
- +10°C → +4°C en **moins de 2h** supplémentaires (4h total max)

---

## 3. Températures réglementaires (Arrêté 21/12/2009)

| Catégorie | Température |
|---|---|
| Froid positif — très périssables (viandes fraîches, poissons, laitages frais) | **0°C à +4°C** |
| Froid positif — autres réfrigérés | **≤ +8°C** |
| Surgelés / congelés | **≤ -18°C** |
| Chaud maintenu | **≥ +63°C** |

**Zones grises :**
- Fromages affinés durs (Comté, Gruyère) : tolérance jusqu'à +8°C
- Fromages frais : ≤ +4°C obligatoire
- Fruits/légumes entiers non découpés : pas de T° imposée

**Implémentation app :** configurer `temp_min` et `temp_max` par type d'équipement avec valeurs par défaut.

---

## 4. Fréquences de relevé recommandées

Pas de fréquence légale fixe — les GBPH (Guides de Bonnes Pratiques Hygiéniques) sectoriels font référence :

| Équipement | Fréquence minimale recommandée |
|---|---|
| Frigos +4°C | 1 fois/jour (ouverture) |
| Congélateurs -18°C | 1 fois/jour |
| Bain-marie / maintien chaud | À l'ouverture + toutes les 2h |
| T° cœur à la cuisson | À chaque cuisson/lot |
| Réception livraison | À chaque livraison |

Les DDPP considèrent **2 relevés/jour** (matin + fin de service) comme meilleure pratique.

**Implémentation app :** paramètre `frequence_releve` sur EQUIPEMENTS : `1x_jour | 2x_jour | chaque_service | chaque_cuisson`

---

## 5. Durée conservation des registres — 3 ans confirmé

| Document | Durée légale |
|---|---|
| Relevés de température | **3 ans** |
| Traçabilité fournisseurs | **3 ans** |
| Registres nettoyage | **3 ans** |
| Fiches non-conformités | **3 ans** |
| Traçabilité viande bovine | **5 ans** (règlement CE 1760/2000) |

**Format digital pleinement accepté** si :
- Horodaté automatiquement
- Non modifiable a posteriori (pas d'édition d'un relevé passé)
- Exportable PDF pour les inspecteurs

**Implémentation app :**
- Champs `created_at` immutables (jamais de UPDATE sur relevés)
- Archivage automatique après 3 ans vers Supabase Storage
- Export PDF complet sur demande

---

## 6. Contrôles DDPP — Ce qu'ils demandent exactement

**Documents systématiquement demandés :**
1. PMS complet (classeur ou digital)
2. Relevés de température des **3 derniers mois minimum**
3. Fiches traçabilité réceptions (bons de livraison, étiquettes lots)
4. Plan nettoyage + fiches de réalisation signées
5. Attestation formation hygiène (au moins 1 personne)
6. Diagramme de flux + plan HACCP
7. Fiches non-conformités avec actions correctives

**Points d'inspection terrain :**
- Températures mesurées sur place (sonde DDPP)
- Cohérence entre relevés registrés et températures actuelles
- DLC des stocks (date limite sur chaque produit)
- Séparation propre/sale
- Hygiène du personnel (tenues, bijoux, plaies)
- État des locaux (fissures, moisissures, nuisibles)

**Alim'confiance** (obligatoire depuis 2023) : résultat d'inspection publié sur alim-confiance.gouv.fr — 4 niveaux : Très satisfaisant / Satisfaisant / À améliorer / À corriger de toute urgence.

---

## 7. API RappelConso

**Base URL :** `https://rappelconso.beta.gouv.fr/api/public/`

### Endpoints

```
GET /rappels
  ?q={terme_recherche}
  &category_id={id}
  &date_publication_debut={YYYY-MM-DD}
  &date_publication_fin={YYYY-MM-DD}
  &page={n}
  &limit={n}

GET /rappels/{id}
GET /categories
```

### Structure d'un rappel (champs clés)

```json
{
  "id": "uuid",
  "reference_fiche": "2026-01-15-001",
  "date_publication": "2026-01-15",
  "categorie_produit": "Viandes et produits à base de viandes",
  "sous_categorie_produit": "Viandes hachées",
  "nom_produit_rappele": "Steak haché 15% MG Marque X",
  "nom_marque_produit": "Marque X",
  "identification_des_lots": "Lot A123, A124",
  "date_limite_consommation_dlc": "2026-01-20",
  "temperature_conservation": "0 à +4°C",
  "marques_de_salubrite": "FR 75.XXX.XXX CE",
  "motif_rappel": "Présence de Listeria monocytogenes",
  "risques_encourus_par_le_consommateur": "Listériose",
  "conduites_a_tenir_par_le_consommateur": "Ne pas consommer, rapporter en magasin ou jeter",
  "liens_vers_les_images": ["https://..."]
}
```

### Stratégie de matching avec la mercuriale

```typescript
// Matching fuzzy : nom produit rappelé vs RESTAURANT_INGREDIENTS
// 1. Exact match sur nom_produit_rappele
// 2. Match sur nom_marque_produit
// 3. Match sur categorie_produit (alerte élargie)
// Si match → INSERT RAPPEL_ALERTS + push notification
```

**Fréquence update :** quotidienne (20h environ). Cron recommandé : 21h00.
**Volume :** ~300-500 rappels/an France, ~1-2 par jour.

---

## 8. Allergènes obligatoires (Règlement UE 1169/2011)

**14 allergènes majeurs :**

| # | Allergène | Code app |
|---|---|---|
| 1 | Céréales contenant du gluten (blé, seigle, orge, avoine, épeautre) | `gluten` |
| 2 | Crustacés | `crustaces` |
| 3 | Œufs | `oeufs` |
| 4 | Poissons | `poisson` |
| 5 | Arachides | `arachides` |
| 6 | Soja | `soja` |
| 7 | Lait | `lait` |
| 8 | Fruits à coque (amandes, noisettes, noix, cajou, pistaches, macadamia) | `fruits_a_coque` |
| 9 | Céleri | `celeri` |
| 10 | Moutarde | `moutarde` |
| 11 | Graines de sésame | `sesame` |
| 12 | Dioxyde de soufre et sulfites (> 10 mg/kg) | `sulfites` |
| 13 | Lupin | `lupin` |
| 14 | Mollusques | `mollusques` |

**Obligations d'affichage (depuis 01/07/2015) :**
- Mention **écrite** obligatoire, accessible sans demande
- Format accepté : carte, ardoise, classeur, affichage mural, QR code (food trucks)
- Sanction : jusqu'à **3 750 €** d'amende

**Opportunité produit :** QR code allergènes auto-généré depuis les fiches techniques → valeur ajoutée immédiate, conformité légale, visible sur les tables.

---

## 9. Traçabilité fournisseurs

### DLC vs DDM
- **DLC** ("À consommer avant le...") = interdit de servir après dépassement → élimination + fiche NC obligatoire
- **DDM / DLUO** ("À consommer de préférence avant le...") = qualité dégradée, pas de danger immédiat, utilisation possible avec précaution

### Obligations par catégorie

| Produit | Traçabilité requise | Durée |
|---|---|---|
| Viande bovine | Lot + origine (naissance/élevage/abattage) | 5 ans |
| Poissons | Zone de pêche/pays + méthode + lot | 3 ans |
| Volailles | Lot + marque sanitaire | 3 ans |
| Fruits/légumes | Fournisseur + date réception | 3 ans |
| Tous produits | Fournisseur + date réception + DLC | 3 ans |

### Bonne pratique réception (FIFO)
1. Mesurer T° livraison
2. Vérifier intégrité emballage
3. Vérifier DLC
4. Enregistrer (fournisseur + lot + DLC + T°)
5. Ranger en FIFO (First In, First Out)

---

## 10. Formation hygiène alimentaire

**Base légale :** Arrêté du 5 octobre 2011 + Décret n°2011-731 du 24 juin 2011

| Critère | Règle |
|---|---|
| Qui | Au minimum **1 personne par établissement** |
| Durée | **14 heures minimum** (2 jours) |
| Organismes | OF déclarés (CCI, CMA, organismes privés CHR) |
| Renouvellement | **Aucun renouvellement légalement obligatoire** — formation valable à vie |
| Équivalences | CAP/BEP alimentaire ou 3 ans d'expérience en gestion |

**Implémentation app :** FORMATIONS_HYGIENE table avec `date_expiration` null (pas de renouvellement) + alerte si aucune formation enregistrée pour l'établissement.

---

## 11. Non-conformités — Gestion et traçabilité

Toute non-conformité doit être :
1. Enregistrée (produit, date, nature du problème)
2. Corrigée (action prise : jetée, retournée, réchauffée)
3. Analysée (cause racine)
4. Archivée (3 ans)

**Types courants :**
- T° hors plage → action corrective immédiate
- DLC dépassée → élimination
- Réception non-conforme → refus livraison + fiche
- Rappel produit → élimination + déclaration si intoxication

---

## Sources officielles

- Règlement CE 852/2004 : eur-lex.europa.eu/legal-content/FR/TXT/?uri=CELEX:32004R0852
- Règlement UE 1169/2011 : eur-lex.europa.eu/legal-content/FR/TXT/?uri=CELEX:32011R1169
- Arrêté 21/12/2009 : legifrance.gouv.fr/loda/id/JORFTEXT000021536618
- Arrêté 05/10/2011 (formation) : legifrance.gouv.fr/loda/id/JORFTEXT000024254363
- Alim'confiance : alim-confiance.gouv.fr
- API RappelConso : data.gouv.fr/fr/datasets/rappels-de-produits-alimentaires-et-non-alimentaires/
