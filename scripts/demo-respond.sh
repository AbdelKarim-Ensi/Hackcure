#!/usr/bin/env bash
# Démo : un donneur du seed répond « Je viens » à la demande active de l'hôpital de test.
# Usage : bash scripts/demo-respond.sh   (API sur :3000, base dans le conteneur hackcure-db-1)
set -euo pipefail
API="${API:-http://localhost:3000}"
PASS="${SEED_PASSWORD:-Damm2026!}"
HOSP_PHONE="+21600010001"

json() { node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{const j=JSON.parse(s);console.log(eval("j."+process.argv[1]))})' "$1"; }
login() {
  curl -sf -X POST "$API/auth/login" -H 'Content-Type: application/json' \
    -d "{\"phone\":\"$1\",\"password\":\"$PASS\"}" | json accessToken
}
sql() { docker exec hackcure-db-1 sh -c 'psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -tA -c "$0"' "$1"; }

HT=$(login "$HOSP_PHONE")
REQ=$(curl -sf "$API/requests?status=active" -H "Authorization: Bearer $HT" \
  | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{const a=JSON.parse(s);const r=Array.isArray(a)?a[0]:(a.items||[])[0];if(!r){process.exit(1)}console.log(r.id+" "+r.bloodGroup)})') \
  || { echo "Aucune demande active : crée-en une depuis le dashboard."; exit 1; }
RID=${REQ% *}; GROUP=${REQ#* }
[[ "$GROUP" =~ ^(A|B|AB|O)[+-]$ ]] || { echo "Groupe inattendu : $GROUP"; exit 1; }
echo "Demande $RID (groupe $GROUP)"

DPHONE=$(sql "select u.phone from donors d join users u on u.id=d.user_id
  where d.blood_group='$GROUP' and d.eligibility_status='eligible'
    and (d.next_donation_possible_date is null or d.next_donation_possible_date <= current_date)
    and not exists (select 1 from request_responses r where r.request_id='$RID' and r.donor_id=d.user_id)
  order by random() limit 1")
[ -n "$DPHONE" ] || { echo "Aucun donneur $GROUP disponible."; exit 1; }
echo "Donneur : $DPHONE"

DT=$(login "$DPHONE")
curl -s -w '\nHTTP %{http_code}\n' -X POST "$API/requests/$RID/respond" \
  -H "Authorization: Bearer $DT" -H 'Content-Type: application/json' -d '{"response":"je_viens"}'
