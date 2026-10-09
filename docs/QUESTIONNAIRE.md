# Questionnaire d'éligibilité (F1) : guide pour M3 (mobile) et M1 (API)

Source unique : `backend/src/rules/questionnaire.ts`. Copie prête à l'emploi pour le mobile : `docs/questionnaire.v1.json` (générée depuis le TypeScript, ne pas l'éditer à la main).

Langues : **français** et **arabe standard moderne** (`fr`, `ar`). Le darija est réservé au chatbot. L'interface arabe doit être en **RTL**.

## Structure du JSON

```json
{ "version": 1, "intro": {fr, ar}, "sensitiveNotice": {fr, ar},
  "labels": { "yes": {...}, "no": {...}, "none": {...} },
  "questions": [ { "id", "field", "type", "required", "label", "help?", ... } ] }
```

## Types de questions

| `type` | Affichage | Réponse envoyée |
|---|---|---|
| `boolean` | Boutons Oui / Non | `true` ou `false` |
| `number` | Champ numérique (+ `unit`, `min`, `max`) | un nombre |
| `date` | Sélecteur de date | `"AAAA-MM-JJ"` |
| `date_or_none` | Sélecteur de date **avec** un choix « Non concerné » (`labels.none`) | `"AAAA-MM-JJ"`, ou **ne pas envoyer le champ** |

## Règles d'affichage

- `showIfProfile: { field: "sex", equals: "femme" }` : n'afficher que si le profil du donneur est `femme` (grossesse, accouchement).
- `showIf: { field, equals }` : n'afficher que si la réponse à `field` vaut `equals` (ex. date de guérison seulement si fièvre = Oui).
- `sensitive: true` : afficher `sensitiveNotice` sous la question.
- `allowFuture: true` : la date peut être dans le futur (fin d'un traitement en cours). Sinon, bloquer les dates futures dans le sélecteur.
- Afficher `intro` en tête de formulaire, avec le consentement explicite avant l'envoi.

## Envoi (T4.2)

`POST /donors/:id/eligibility-form` avec un objet dont les clés sont les `field` :

```json
{ "birthDate": "1995-06-15", "weightKg": 72, "feverInfectionRecent": false,
  "tattooPiercingDate": "2026-08-04", "infectiousHistory": false,
  "injectedDrugUseEver": false, "chronicDisease": false, "regularMedication": false }
```

## Côté backend (M1)

```ts
import { validateAnswers, evaluateEligibility } from '../rules';

const check = validateAnswers(dto, { sex: donor.sex });   // ignore les questions non applicables
if (!check.ok) throw new BadRequestException(check.errors); // [{ field, code }]
const result = evaluateEligibility(check.answers);          // { status, reevalDate, firedRules, requiresMedicalReview }
// écrire result.status dans Donor.eligibilityStatus et result.reevalDate dans Donor.reevalDate
```

Codes d'erreur : `required`, `invalid_type`, `out_of_range`, `invalid_date`, `future_date` (à traduire côté mobile).

Pour que le mobile récupère le schéma depuis l'API plutôt que d'embarquer le JSON, M1 peut exposer `GET /donors/eligibility-form/schema` qui renvoie `QUESTIONNAIRE`. Toute modification du contrat passe par une PR sur `docs/openapi.json` (convention de `BACKEND.md`).

## Points de vigilance

- Les réponses de santé doivent être **chiffrées** au repos (T7.1) et jamais journalisées en clair.
- Les durées de blocage (mois, jours) ne figurent **pas** dans les textes : elles vivent dans `eligibility.ts` et restent à valider avec le CNTS.
- **Relecture obligatoire** : le texte arabe doit être relu par un arabophone et un professionnel de santé avant la démo.
- En changeant une question : incrémenter `QUESTIONNAIRE_VERSION`, régénérer le JSON, et stocker la version dans `EligibilityForm` pour savoir à quelle version chaque réponse correspond.
