# `backend/src/matching/` : T13 (géociblage et vagues)

Branche la logique pure de `rules/` sur la base. **Lecture seule** : ce module ne notifie personne et n'écrit rien.

## Utilisation (T5)

```ts
// dans le module qui orchestre les vagues
imports: [MatchingModule]

const plan = await this.matching.planWave(requestId);

switch (plan.decision.action) {
  case 'launch':    // notifier plan.donorIds, puis insérer une ligne request_waves
  case 'wait':      // replanifier à plan.decision.nextCheckAt
  case 'covered':   // clôturer (statut `couverte`)
  case 'exhausted': // rayon max atteint sans couverture : prévenir l'hôpital
  case 'expired':   // échéance dépassée (statut `expiree`)
  case 'inactive':  // la demande n'est plus `active`
}
```

`plan.ranked` contient le classement complet avec scores et explications (pour le tableau de bord).

## Ce que M1 doit faire après `launch`

1. Créer une `AppNotification` (type `urgence`, `requestId`, `userId` = donneur) pour chaque `donorId` : c'est ce qui alimente « déjà alerté », l'historique et le quota hebdomadaire.
2. Insérer une ligne `RequestWave` (`waveNumber = plan.decision.waveNumber`, `radiusKm = plan.decision.radiusKm`, `sentTo`) : le planificateur s'en sert pour compter les vagues et mesurer le délai d'attente.
3. Ne jamais mettre d'identité de patient dans le `payload` (R4).

Sans ces deux écritures, le planificateur relancerait la même vague en boucle.

## Hypothèses à vérifier

- `Institution.position` existe et est un `geography(Point, 4326)` (même type que `Donor.position`).
- `AppNotification.userId` = `Donor.userId` (clé primaire du donneur).
- `RequestResponse.donorId` et `Donation.donorId` = `Donor.userId`.
- Les présences (`showedUp`) sont approximées par les dons confirmés de source `urgence`.
- `urgente` utilise les poids « normal » ; seul `critique` utilise les poids « critical ».

## Vérifier dans le projet

```bash
cd backend
npx tsc --noEmit -p tsconfig.json
npm test -- rules
```

Les requêtes n'ont pas été exécutées contre une vraie base : après le seed, appelez `planWave` sur une demande de test et contrôlez que les distances et les donneurs retenus sont plausibles.
