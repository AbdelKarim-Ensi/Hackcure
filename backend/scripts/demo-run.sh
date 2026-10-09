#!/usr/bin/env bash
# Scénario de démo : demande, vague 1, couverture partielle, vague 2, couverture complète.
# Prérequis : API lancée avec WAVE_DELAY_SECONDS=15 et base seedée (demo-reset.sh).
# Les donneurs qui répondent sont ceux réellement alertés (table notifications).
set -euo pipefail
cd "$(dirname "$0")/.."
API="${API:-http://localhost:3000}"
PASS="${SEED_PASSWORD:-Damm2026!}"
TIMEOUT="${WAVE_TIMEOUT:-45}"           # attente max de la vague 2 (WAVE_DELAY_SECONDS + marge)
HOSP="+21600010001"                     # Hôpital Charles Nicolle (seed)

json() { node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{let o=JSON.parse(s);for(const k of process.argv[1].split("."))o=o?.[k];console.log(o??"")})' "$1"; }
token() {
  local r v
  r=$(curl -s -X POST "$API/auth/login" -H 'Content-Type: application/json' -d "{\"phone\":\"$1\",\"password\":\"$PASS\"}")
  for k in accessToken access_token token; do v=$(echo "$r" | json "$k" 2>/dev/null || true); [ -n "$v" ] && { echo "$v"; return; }; done
  echo "Login échoué pour $1 : $r" >&2; exit 1
}
sql() { (cd .. && docker compose exec -T db sh -c 'psql -U "${POSTGRES_USER:-postgres}" -d "${POSTGRES_DB:-postgres}" -At -c "$0"' "$1"); }
alerted() { # id : téléphones des donneurs alertés, dans l'ordre d'alerte
  sql "SELECT u.phone FROM notifications n JOIN users u ON u.id=n.user_id
       WHERE n.request_id='$1' AND n.type='urgence' ORDER BY n.created_at, u.phone"
}
respond() { # id téléphone
  local t code; t=$(token "$2")
  code=$(curl -s -o /dev/null -w '%{http_code}' -X POST "$API/requests/$1/respond" \
    -H "Authorization: Bearer $t" -H 'Content-Type: application/json' -d '{"response":"je_viens"}')
  echo "   $2 -> je_viens ($code)"
}
live_raw() { curl -s "$API/requests/$1/live" -H "Authorization: Bearer $HT"; }
nwaves() { live_raw "$1" | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{try{console.log(JSON.parse(s).waves.length)}catch(e){console.log(0)}})'; }
live() { live_raw "$1" | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>console.log(JSON.stringify(JSON.parse(s),null,1)))'; }

HT=$(token "$HOSP")
DEADLINE=$(date -u -d '+2 hours' +%Y-%m-%dT%H:%M:%S.000Z)

echo "== 1. Demande : 4 poches O+, rayon 5 km"
REQ=$(curl -s -X POST "$API/requests" -H "Authorization: Bearer $HT" -H 'Content-Type: application/json' \
  -d "{\"bloodGroup\":\"O+\",\"quantity\":4,\"urgency\":\"urgente\",\"deadline\":\"$DEADLINE\",\"initialRadiusKm\":5}")
ID=$(echo "$REQ" | json id); [ -n "$ID" ] || { echo "Création échouée : $REQ"; exit 1; }
echo "   id=$ID statut=$(echo "$REQ" | json status)"

for i in $(seq 1 10); do W1=$(alerted "$ID"); [ -n "$W1" ] && break; sleep 1; done
[ -n "${W1:-}" ] || { echo "Aucun donneur alerté pour la vague 1 : voir /tmp/api.log"; exit 1; }
echo "   $(echo "$W1" | wc -l) donneur(s) alerté(s) en vague 1"

echo "== 2. Vague 1 : 2 donneurs alertés répondent (couverture partielle)"
for p in $(echo "$W1" | head -n 2); do respond "$ID" "$p"; done
live "$ID"

echo "== 3. Attente de la vague 2 (max ${TIMEOUT}s)"
START=$SECONDS
until [ "$(nwaves "$ID")" -ge 2 ]; do
  [ $((SECONDS-START)) -lt "$TIMEOUT" ] || { echo "Vague 2 non déclenchée après ${TIMEOUT}s : voir /tmp/api.log"; exit 1; }
  sleep 1
done
echo "   vague 2 détectée après $((SECONDS-START))s"
sleep 1

echo "== 4. Vague 2 : 2 donneurs nouvellement alertés répondent"
ALL=$(alerted "$ID")
NEW=$(comm -13 <(echo "$W1" | sort) <(echo "$ALL" | sort) | head -n 2)
[ -n "$NEW" ] || { echo "Aucun nouveau donneur alerté en vague 2"; exit 1; }
for p in $NEW; do respond "$ID" "$p"; done
sleep 2
live "$ID"
echo "== Scénario terminé"
