# `backend/src/anomaly/` : T14 (détection d'anomalies)

Repère les demandes de sang suspectes **avant** qu'elles ne déclenchent des alertes aux donneurs. Fonction pure `assessRequest` (dans `rules/anomaly.ts`) + service de lecture `AnomalyService`.

## Signaux

| Code | Déclencheur | Poids |
|---|---|---|
| `DEADLINE_PASSED` | échéance déjà dépassée | refus immédiat |
| `DUPLICATE_ACTIVE` | même groupe, demande encore active, moins de 30 min | 0,50 (0,85 si même quantité) |
| `BURST` | 4 demandes ou plus de la même institution en 1 h | 0,40 à 0,80 |
| `QUANTITY_ABSOLUTE` | plus de 15 unités (plus de 30 : très élevé) | 0,50 / 0,90 |
| `QUANTITY_OUTLIER` | quantité au moins 3 fois la médiane de l'institution (historique de 3 demandes minimum) | 0,30 à 0,70 |
| `URGENCY_DEADLINE_MISMATCH` | « critique » avec échéance > 48 h, ou « normale » avec échéance < 30 min | 0,30 / 0,20 |
| `NEW_INSTITUTION_LARGE` | première demande de l'institution, 8 unités ou plus | 0,35 |

Score = `1 − Π(1 − poids)` : un signal fort suffit, plusieurs signaux faibles se cumulent.

| Score | `level` | Décision |
|---|---|---|
| < 0,35 | `ok` | activer |
| 0,35 à 0,60 | `warn` | activer, signaler sur le tableau de bord |
| ≥ 0,60 | `review` | statut `en_revue` : validation manuelle avant toute alerte |
| (échéance passée) | `reject` | refuser (HTTP 422) |

Chaque signal est accompagné d'une explication en français (`flags[].message`).

## Intégration à la création d'une demande (T4.4)

```ts
const a = await this.anomaly.assess({
  institutionId, bloodGroup, quantity, urgency, deadline,
});

if (a.level === 'reject') throw new UnprocessableEntityException(a.flags);

request.anomalyScore = a.scoreForDb;                       // colonne numeric(4,3)
request.status = a.level === 'review' ? RequestStatus.EnRevue : RequestStatus.Active;
// consigner a.flags dans audit_log (action « request.anomaly »)
```

Une demande `en_revue` ne doit **pas** lancer de vague : `MatchingService.planWave` renvoie `inactive` tant que le statut n'est pas `active`. Il faut donc un endpoint d'administration pour valider ou rejeter une demande en revue, qui la passe en `active` ou `cloturee`, puis démarre la première vague.

## Limites assumées

- Seuils et poids = valeurs de départ (`ANOMALY` dans `rules/anomaly.ts`), à ajuster avec un hôpital réel.
- Règles transparentes plutôt que modèle appris : pas de données réelles en 48 h, et un relecteur doit pouvoir comprendre pourquoi une demande est signalée.
- La détection ne remplace pas l'authentification : seules les institutions validées peuvent créer une demande.
- Une urgence légitime peut dépasser un seuil : c'est pourquoi `review` n'est pas un refus, seulement une validation humaine rapide.
