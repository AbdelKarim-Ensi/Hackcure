#!/usr/bin/env bash
# Crée une demande de l'hôpital de test (approuvée par l'admin si elle est retenue en revue).
# Usage : GROUP=O+ QTY=6 URGENCY=urgente bash backend/scripts/demo-request.sh
# QTY plus grand que le nombre de donneurs alertés : la demande reste active (utile pour demo-respond*.sh).
set -euo pipefail
source "$(dirname "$0")/lib.sh"

GROUP="${GROUP:-O+}"; QTY="${QTY:-6}"; URGENCY="${URGENCY:-urgente}"
HT=$(login "$HOSP_PHONE")
DEADLINE=$(date -u -d '+2 hours' +%Y-%m-%dT%H:%M:%S.000Z)
REQ=$(curl -s -X POST "$API/requests" -H "Authorization: Bearer $HT" -H 'Content-Type: application/json' \
  -d "{\"bloodGroup\":\"$GROUP\",\"quantity\":$QTY,\"urgency\":\"$URGENCY\",\"deadline\":\"$DEADLINE\",\"initialRadiusKm\":5}")
ID=$(echo "$REQ" | json id); [ -n "$ID" ] || { echo "Création échouée : $REQ"; exit 1; }
if [ "$(echo "$REQ" | json status)" = "en_revue" ]; then
  AT=$(login "+21600010100")
  curl -s -o /dev/null -X PATCH "$API/requests/$ID/review" -H "Authorization: Bearer $AT" \
    -H 'Content-Type: application/json' -d '{"decision":"approve"}'
  echo "En revue -> approuvée par l'admin"
fi
echo "Demande $ID ($GROUP x$QTY, $URGENCY)"
for _ in $(seq 1 10); do [ -n "$(alerted "$ID")" ] && break; sleep 1; done
echo "Donneurs du seed alertés : $(alerted "$ID" | wc -l)"
echo "Jauge : $(gauge "$ID")"
