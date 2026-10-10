#!/usr/bin/env bash
# Script 2 : tous les donneurs du seed alertés répondent « je viens » (jusqu'à couverture de la demande).
# Usage : bash backend/scripts/demo-respond-all.sh
#         GROUP=AB+ bash backend/scripts/demo-respond-all.sh
#         REQ_ID=<uuid> MAX=5 bash backend/scripts/demo-respond-all.sh   (MAX = plafond de réponses)
# S'arrête dès que la demande n'est plus active (couverte) : au-delà, l'API refuse les réponses.
set -euo pipefail
source "$(dirname "$0")/lib.sh"

HT=$(login "$HOSP_PHONE")
ID="${REQ_ID:-$(active_request "${GROUP:-}")}"
[ -n "$ID" ] || { echo "Aucune demande active ${GROUP:-}. Est-elle encore en revue ?"; exit 1; }
echo "Demande $ID"
echo "Départ : $(gauge "$ID")"

OK=0; REFUSED=0
for p in $(alerted "$ID"); do
  st=$(request_status "$ID")
  [ "$st" = "active" ] || { echo "Demande $st : arrêt."; break; }
  [ "$OK" -lt "${MAX:-1000000}" ] || { echo "Plafond MAX atteint."; break; }
  code=$(respond "$ID" "$p")
  echo "   $p -> je_viens ($code)"
  if [ "$code" = "200" ]; then OK=$((OK+1)); else REFUSED=$((REFUSED+1)); fi
done

echo "Bilan : $OK accepté(s), $REFUSED refusé(s) (déjà répondu ou non éligible)"
echo "Arrivée : $(gauge "$ID")"
[ "$OK" -gt 0 ] || exit 1
