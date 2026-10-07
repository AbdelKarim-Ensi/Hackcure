#!/usr/bin/env bash
# T5.6 : mesure automatique (vague 1 < 10 s, gauge < 2 s). Usage : npm run perf
# Options : RUNS=10  NO_SEED=1 (ne pas re-seeder)  KEEP_API=1 (laisser l'API tourner)
set -euo pipefail
cd "$(dirname "$0")/.."
ROOT="$(cd .. && pwd)"
set -a; source "$ROOT/.env"; set +a

PASS="${SEED_PASSWORD:-Damm2026!}"
RUNS="${RUNS:-10}"
HOSP_PHONE="${HOSPITAL_PHONE:-+21600010001}"
LOG=/tmp/damm-api.log
OUT=/tmp/perf-t5-6.out
DC="docker compose -f $ROOT/docker-compose.yml"

sql() { $DC exec -T db sh -c 'psql -tA -U "$POSTGRES_USER" -d damm -c "$1"' _ "$1"; }
stop_api() { local p; p=$(lsof -t -i :3000 2>/dev/null || true); [ -n "$p" ] && kill $p 2>/dev/null || true; for _ in $(seq 1 20); do lsof -t -i :3000 >/dev/null 2>&1 || break; sleep 0.5; done; }
cleanup() { [ "${KEEP_API:-0}" = "1" ] || stop_api; }
trap cleanup EXIT

echo "==> 1/6 Docker (db, redis)"
$DC up -d db redis >/dev/null
for i in $(seq 1 30); do sql "select 1" >/dev/null 2>&1 && break; sleep 1; done
sql "select 1" >/dev/null || { echo "db injoignable"; exit 1; }
for i in $(seq 1 15); do $DC exec -T redis redis-cli ping 2>/dev/null | grep -q PONG && break; sleep 1; done

echo "==> 2/6 Migrations et seed"
npm run -s migration:run >/dev/null 2>&1 || true
[ "${NO_SEED:-0}" = "1" ] || SEED_PASSWORD="$PASS" npm run -s seed

echo "==> 3/6 Build et démarrage API"
npm run -s build
stop_api; sleep 1
npm run -s start:prod >"$LOG" 2>&1 &
up() { [ "$(curl -s -o /dev/null -w "%{http_code}" localhost:3000/ 2>/dev/null)" != "000" ]; }
for i in $(seq 1 40); do up && break; sleep 1; done
up || { echo "API KO, voir $LOG"; tail -20 "$LOG"; exit 1; }

echo "==> 4/6 Choix du donneur (éligible, O-/O+, le plus proche)"
DONOR_PHONE=$(sql "SELECT u.phone FROM donors d JOIN users u ON u.id=d.user_id
  JOIN institutions i ON i.id=(SELECT institution_id FROM users WHERE phone='$HOSP_PHONE')
  WHERE d.eligibility_status='eligible' AND d.available=true
  AND (d.next_donation_possible_date IS NULL OR d.next_donation_possible_date<=CURRENT_DATE)
  AND d.blood_group IN ('O+','O-') ORDER BY ST_Distance(d.position,i.position) LIMIT 1;")
[ -n "$DONOR_PHONE" ] || { echo "aucun donneur éligible"; exit 1; }
echo "    donneur : $DONOR_PHONE"

echo "==> 5/6 Mesure ($RUNS runs)"
HOSPITAL_PHONE="$HOSP_PHONE" HOSPITAL_PASSWORD="$PASS" \
DONOR_PHONE="$DONOR_PHONE" DONOR_PASSWORD="$PASS" \
REQ_BODY='{"bloodGroup":"O+","quantity":3,"urgency":"critique","initialRadiusKm":10}' \
RESPOND_BODY='{"response":"je_viens"}' RUNS="$RUNS" \
node scripts/perf-t5-6.mjs | tee "$OUT"

echo "==> 6/6 Verdict"
V=$(grep 'Vague 1' "$OUT" | grep -oE 'max: [0-9]+' | grep -oE '[0-9]+')
G=$(grep 'Gauge' "$OUT" | grep -oE 'max: [0-9]+' | grep -oE '[0-9]+')
[ "$V" -lt 10000 ] && echo "OK  vague 1 max ${V} ms < 10 s" || echo "ECHEC vague 1 max ${V} ms"
[ "$G" -lt 2000 ]  && echo "OK  gauge max ${G} ms < 2 s"   || echo "ECHEC gauge max ${G} ms"
[ "$V" -lt 10000 ] && [ "$G" -lt 2000 ]
