

## Performances (T5.6)
Mesure automatisée : `cd backend && npm run perf` (re-seed, build, démarrage de l'API, 10 exécutions, verdict).
Conditions : seed de 200 donneurs, vague 1 de 8 destinataires à 10 km, machine locale.

| Mesure | p50 | max observé | Cible |
|---|---|---|---|
| Vague 1 après `POST /requests` | 808 ms | 1825 ms | < 10 s |
| Réponse donneur → `gauge` reçu | 117 ms | 195 ms | < 2 s |
| `POST /requests` (réponse HTTP) | 55 ms | 568 ms | n/a |

Le premier run est plus lent (démarrage à froid). Options : `RUNS=20`, `NO_SEED=1` (ne pas re-seeder), `KEEP_API=1` (laisser l'API tourner). Attention : le seed fait un `TRUNCATE`, à ne jamais lancer sur une base à conserver.
