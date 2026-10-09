#!/usr/bin/env bash
# Remise à zéro de la démo : base propre, migrations, seed. HARD=1 pour un drop complet du schéma.
set -euo pipefail
cd "$(dirname "$0")/.."

if [ "${NODE_ENV:-}" = "production" ]; then echo "Refusé en production"; exit 1; fi

echo "[1/4] Services (Postgres, Redis)"
(cd .. && docker compose up -d) >/dev/null

echo "[2/4] Attente de la base"
until (cd .. && docker compose exec -T db pg_isready >/dev/null 2>&1) \
   || (cd .. && docker compose exec -T db pg_isready >/dev/null 2>&1); do sleep 2; done

if [ "${HARD:-0}" = "1" ]; then
  echo "[3/4] Drop du schéma + migrations"
  npm run typeorm -- schema:drop
else
  echo "[3/4] Migrations"
fi
npm run migration:run

echo "[4/4] Seed + vidage Redis"
npm run seed
(cd .. && docker compose exec -T redis redis-cli FLUSHALL >/dev/null 2>&1) || true

echo "Démo prête."
