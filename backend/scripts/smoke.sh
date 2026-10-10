#!/usr/bin/env bash
# Smoke test API : statuts attendus sans jeton. Usage : API=http://localhost:3000 ./scripts/smoke.sh
API="${API:-http://localhost:3000}"
FAIL=0

check() { # methode chemin regex_statuts_attendus
  local code
  code=$(curl -s -o /dev/null -w '%{http_code}' -X "$1" -H 'Content-Type: application/json' -d '{}' "$API$2")
  if [[ "$code" =~ ^($3)$ ]]; then echo "OK   $1 $2 -> $code"
  else echo "FAIL $1 $2 -> $code (attendu $3)"; FAIL=1; fi
}

check GET  /                     "200"
check GET  /users/me             "401"
check GET  /donors/me            "401"
check GET  /notifications/me     "401"
check GET  /stocks               "401|403"
check GET  /requests             "401|403"
check POST /requests             "401|403"
check POST /donations/confirm    "401|403"
check GET  /events               "200|401"
check POST /auth/login           "400|401"
check POST /auth/register        "400"
check POST /auth/otp/send        "400|401"
check POST /auth/refresh         "400|401"

[ $FAIL -eq 0 ] && echo "Smoke test OK" || { echo "Smoke test en echec"; exit 1; }
