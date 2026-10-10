#!/usr/bin/env bash
# Remise à zéro de la démo : base propre, migrations, seed, tokens push factices, Redis vidé.
# HARD=1 pour un drop complet du schéma. À lancer API ARRÊTÉE (le FLUSHALL casse les files de l'API en marche).
set -euo pipefail
cd "$(dirname "$0")/.."

if [ "${NODE_ENV:-}" = "production" ]; then echo "Refusé en production"; exit 1; fi
if ss -ltn 2>/dev/null | grep -q ':3000 '; then echo "ATTENTION : une API écoute sur :3000. Arrête-la avant le reset, puis relance-la après."; fi

psql_db() { (cd .. && docker compose exec -T db sh -c 'psql -U "${POSTGRES_USER:-postgres}" -d "${POSTGRES_DB:-postgres}" -At -c "$0"' "$1"); }

echo "[1/5] Services (Postgres, Redis)"
(cd .. && docker compose up -d) >/dev/null

echo "[2/5] Attente de la base"
until (cd .. && docker compose exec -T db pg_isready >/dev/null 2>&1); do sleep 2; done

if [ "${HARD:-0}" = "1" ]; then
  echo "[3/5] Drop du schéma + migrations"
  npm run typeorm -- schema:drop
else
  echo "[3/5] Migrations"
fi
npm run migration:run

echo "[4/5] Seed + tokens push factices"
npm run seed
psql_db "TRUNCATE notifications" >/dev/null
psql_db "UPDATE users SET fcm_token = 'demo-token-' || id WHERE fcm_token IS NULL" >/dev/null

echo "[5/5] Vidage Redis"
(cd .. && docker compose exec -T redis redis-cli FLUSHALL) >/dev/null

echo "Contrôle : $(psql_db "SELECT count(*) FROM users WHERE fcm_token IS NOT NULL") utilisateurs avec token, $(cd .. && docker compose exec -T redis redis-cli dbsize) clé(s) Redis"
echo "Démo prête."
