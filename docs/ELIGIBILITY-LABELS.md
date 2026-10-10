# Textes FR/AR du formulaire d'éligibilité (alignés sur le DTO de M1)

`docs/eligibility-form-labels.v1.json` contient les libellés français et arabe (arabe standard moderne) pour les champs de `EligibilityFormDto`. Les clés `field` sont celles du DTO : le contrat d'API **ne change pas**.

- `type` : `number`, `date` ou `boolean` (Oui / Non, libellés dans `labels`).
- `required` reprend le DTO ; `pregnantOrBreastfeeding` n'est affiché que si le profil est `femme` (`showIfProfile`).
- `sensitive: true` : afficher `sensitiveNotice` sous la question.
- `recentHelp` : texte d'aide à afficher sous les questions « récemment » (le donneur n'a pas à connaître les délais).
- Interface arabe en RTL.

## Points ouverts
- Les textes ne contiennent aucune durée (mois, jours) : les délais ne sont pas validés. Une fois confirmés avec le CNTS, on pourra préciser « dans les X derniers mois » dans l'aide.
- Le DTO ne demande plus la consommation de drogues par injection (présente dans notre premier schéma) : à confirmer avec le CNTS.
- Relecture du texte arabe par un arabophone et un professionnel de santé avant la démo.
