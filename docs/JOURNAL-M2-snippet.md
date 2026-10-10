#### M2 : règles métier (T9 à T12), à coller dans « Points à annoncer à l'équipe »

- Nouveau module `backend/src/rules/` : fonctions pures prêtes pour **T4.2** (`evaluateEligibility`), **T4.3 / T4.5** (`nextDonationDate`, `canDonateOn`) et **T5** (`rankDonors`, `selectWave`, `radiusForWave`). 31 tests Jest.
- Les statuts renvoyés sont ceux de l'enum de la base : `eligible`, `temporaire`, `definitif`, `en_attente` (avis médical requis).
- M1 doit fournir la distance (`distanceKm` via PostGIS) et l'historique d'alertes dans chaque `Candidate`. Voir `backend/src/rules/README.md`.
- Délais entre dons et durées de blocage : **placeholders à valider** avec le CNTS (`config.ts`).
- Dette : `Donor` doit exposer le sexe pour le délai (sinon 120 jours par prudence), et une date `eligibilityReevalDate`.
