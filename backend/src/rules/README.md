# `backend/src/rules/` : règles métier de Damm (M2, T9 à T12)

Fonctions **pures et déterministes** (aucune dépendance NestJS, base de données ou Redis, aucun LLM). Elles se testent seules et s'appellent depuis les services de M1.

Les valeurs marquées *à valider* (`config.ts`, `eligibility.ts`) sont des **placeholders** à confirmer avec le CNTS ou un professionnel de santé. L'éligibilité finale est toujours confirmée par le personnel médical.

## Fichiers

| Fichier | Contenu |
|---|---|
| `config.ts` | Tous les paramètres : matrice de compatibilité, délais entre dons, poids du score, vagues |
| `compatibility.ts` | `isCompatible(donorGroup, requestGroup, exactMatchOnly)` |
| `interval.ts` | `nextDonationDate`, `canDonateOn`, `latestDonationDate` (F2) |
| `eligibility.ts` | `evaluateEligibility(answers, now)` (F1) |
| `scoring.ts` | `filterCandidates`, `rankDonors`, `selectWave`, `radiusForWave` |
| `rules.spec.ts` | 31 tests Jest |
| `index.ts` | Point d'entrée : `import { ... } from '../rules/index.js'` |

## Correspondance avec les tâches de M1

| Tâche M1 | Fonction à appeler |
|---|---|
| **T4.2** formulaire d'éligibilité | `evaluateEligibility(dto)` puis écrire `status` dans `Donor.eligibilityStatus` et `reevalDate` dans la base |
| **T4.3** prochain don | `nextDonationDate(latestDonationDate(confirmed, selfDeclared), type, sex)` |
| **T4.5** réponse du donneur | `canDonateOn(last, new Date(), type, sex)` (contrôle n°3 sur 3) |
| **T5** vagues | `rankDonors` puis `selectWave`, rayon via `radiusForWave(k, r0)`, délai via `waveTimeoutMinutes` |
| **T6** événements CRT | `canDonateOn(last, event.date, type, sex)` : on évalue **à la date de l'événement** (R5) |

## Correspondance des statuts

La sortie de `evaluateEligibility` utilise **les valeurs de l'enum de la base** :

| Résultat | Sens |
|---|---|
| `eligible` | Aucun blocage. Seul statut qui reçoit des alertes |
| `temporaire` | Bloqué jusqu'à `reevalDate` (peut être `null` : le donneur doit redéclarer) |
| `definitif` | Exclusion définitive |
| `en_attente` | Avis médical requis (`requiresMedicalReview = true`) |

Priorité : `definitif` > `en_attente` > `temporaire` > `eligible`. Plusieurs blocages temporaires : la date la plus tardive est retenue.

## Ce que M1 doit fournir

Pour classer, M1 construit une liste de `Candidate` (une requête PostGIS) :

```ts
{
  donorId, bloodGroup, sex?, eligibilityStatus, lastDonationDate,
  distanceKm,                     // ST_Distance(donor.position, hospital.position) / 1000
  availability: 'now' | 'window' | 'none',
  alertsReceived, alertsAccepted, showedUp,   // historique du donneur
  alreadyAlertedForRequest?, urgentAlertsThisWeek?
}
```

- Si `sex` est absent, le délai le plus long est appliqué (prudence).
- Un candidat rejeté ressort dans `rejected` avec un code : `incompatible`, `non_eligible`, `delai_entre_dons`, `hors_rayon`, `deja_alerte`, `quota_hebdo`.
- `rankDonors` renvoie pour chaque donneur un `score` (0 à 100), un `rank`, des `components` et des `reasons` en français pour le tableau de bord. **Aucune donnée de santé** n'y figure (R4).

## Exemple d'utilisation

```ts
import { evaluateEligibility, rankDonors, selectWave, radiusForWave } from '../rules/index.js';

// T4.2
const result = evaluateEligibility(dto);          // { status, reevalDate, firedRules, requiresMedicalReview }

// T5 : vague k
const radius = radiusForWave(k, request.radiusKm);
const { ranked, rejected } = rankDonors(
  { bloodGroup: request.bloodGroup, urgency: request.urgency, exactMatchOnly: request.exactMatchOnly },
  candidates, radius,
);
const wave = selectWave(ranked, unitsRemaining, request.urgency);   // wave.donorIds à notifier
```

## Tests

```
cd backend && npm test -- rules
```

Les imports relatifs utilisent le suffixe `.js` (compatible ESM). Si votre config Jest ne le résout pas, ajouter `moduleNameMapper: { '^(\\.{1,2}/.*)\\.js$': '$1' }`.
