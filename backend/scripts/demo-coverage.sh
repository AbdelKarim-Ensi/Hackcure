#!/usr/bin/env bash
# Vérifie qu'une demande entièrement couverte arrête les vagues (automatique et manuel).
# Prérequis : API lancée avec WAVE_DELAY_SECONDS=15, base seedée.
# Usage : bash backend/scripts/demo-coverage.sh   (QTY=2 WAIT=25 par défaut)
set -euo pipefail
cd "$(dirname "$0")/.."
API="${API:-http://localhost:3000}"
PASS="${SEED_PASSWORD:-Damm2026!}"
SEED_PREFIX="${SEED_PREFIX:-+2160000}"
QTY="${QTY:-2}"
WAIT="${WAIT:-25}"                      # doit dépasser WAVE_DELAY_SECONDS
HOSP="+21600010001"
ADMIN="+21600010100"

json() { node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{let o=JSON.parse(s);for(const k of process.argv[1].split("."))o=o?.[k];console.log(o??"")})' "$1"; }
token() {
  local r v
  for _try in 1 2 3 4 5 6 7 8; do
    r=$(curl -s -X POST "$API/auth/login" -H 'Content-Type: application/json' -d "{\"phone\":\"$1\",\"password\":\"$PASS\"}")
    case "$r" in *Throttler*|*"Too Many"*) echo "   (limite de débit, attente 10 s)" >&2; sleep 10 ;; *) break ;; esac
  done
  for k in accessToken access_token token; do v=$(echo "$r" | json "$k" 2>/dev/null || true); [ -n "$v" ] && { echo "$v"; return; }; done
  echo "Login échoué pour $1 : $r" >&2; exit 1
}
sql() { (cd .. && docker compose exec -T db sh -c 'psql -U "${POSTGRES_USER:-postgres}" -d "${POSTGRES_DB:-postgres}" -At -c "$0"' "$1"); }
alerted() {
  sql "SELECT u.phone FROM notifications n JOIN users u ON u.id=n.user_id
       WHERE n.request_id='$1' AND n.type='urgence' AND u.phone LIKE '${SEED_PREFIX}%'
       ORDER BY n.created_at, u.phone"
}
respond() { # id téléphone -> code HTTP
  local t; t=$(token "$2")
  curl -s -o /dev/null -w '%{http_code}' -X POST "$API/requests/$1/respond" \
    -H "Authorization: Bearer $t" -H 'Content-Type: application/json' -d '{"response":"je_viens"}'
}
status_of() { curl -s "$API/requests/$1" -H "Authorization: Bearer $HT" | json status; }
nwaves() { curl -s "$API/requests/$1/live" -H "Authorization: Bearer $HT" | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{try{console.log(JSON.parse(s).waves.length)}catch(e){console.log(0)}})'; }

HT=$(token "$HOSP")
DEADLINE=$(date -u -d '+2 hours' +%Y-%m-%dT%H:%M:%S.000Z)

echo "== 1. Demande : $QTY poches O+ (urgente)"
REQ=$(curl -s -X POST "$API/requests" -H "Authorization: Bearer $HT" -H 'Content-Type: application/json' \
  -d "{\"bloodGroup\":\"O+\",\"quantity\":$QTY,\"urgency\":\"urgente\",\"deadline\":\"$DEADLINE\",\"initialRadiusKm\":5}")
ID=$(echo "$REQ" | json id); [ -n "$ID" ] || { echo "Création échouée : $REQ"; exit 1; }
if [ "$(echo "$REQ" | json status)" = "en_revue" ]; then
  AT=$(token "$ADMIN")
  curl -s -o /dev/null -X PATCH "$API/requests/$ID/review" -H "Authorization: Bearer $AT" \
    -H 'Content-Type: application/json' -d '{"decision":"approve"}'
  echo "   en revue -> validée par l'admin"
fi
for i in $(seq 1 10); do W1=$(alerted "$ID"); [ -n "$W1" ] && break; sleep 1; done
[ -n "${W1:-}" ] || { echo "Aucun donneur du seed alerté : voir les logs de l'API"; exit 1; }
echo "   id=$ID, $(echo "$W1" | wc -l) donneur(s) du seed alerté(s)"

echo "== 2. Couverture complète : $QTY donneurs répondent"
OK=0
for p in $W1; do
  [ "$OK" -ge "$QTY" ] && break
  code=$(respond "$ID" "$p"); echo "   $p -> je_viens ($code)"
  [ "$code" = "200" ] && OK=$((OK+1))
done
[ "$OK" -ge "$QTY" ] || { echo "Seulement $OK/$QTY réponses acceptées : relance (quota/éligibilité)"; exit 1; }
W_BEFORE=$(nwaves "$ID")
echo "   statut juste après : $(status_of "$ID") ; vagues : $W_BEFORE"

echo "== 3. Attente de ${WAIT}s (une vague auto serait partie sinon)"
sleep "$WAIT"
W_AFTER=$(nwaves "$ID"); S_AFTER=$(status_of "$ID")
echo "   statut : $S_AFTER ; vagues : $W_AFTER"

echo "== 4. Lancement manuel sur la demande couverte"
LCODE=$(curl -s -o /tmp/launch.out -w '%{http_code}' -X POST "$API/requests/$ID/waves/launch" -H "Authorization: Bearer $HT")
echo "   HTTP $LCODE : $(cat /tmp/launch.out)"

echo "== Verdict"
if [ "$S_AFTER" != "active" ] && [ "$W_AFTER" = "$W_BEFORE" ] && [ "$LCODE" != "200" ]; then
  echo "OK : la couverture complète stoppe les vagues (statut=$S_AFTER, aucune vague en plus, manuel refusé)"
else
  echo "ECHEC : statut=$S_AFTER, vagues $W_BEFORE -> $W_AFTER, manuel HTTP $LCODE"; exit 1
fi
