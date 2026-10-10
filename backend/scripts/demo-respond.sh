#!/usr/bin/env bash
# Script 1 : un donneur du seed alerté répond « je viens » à une demande active.
# Usage : bash backend/scripts/demo-respond.sh             (première demande active de la liste)
#         GROUP=AB+ bash backend/scripts/demo-respond.sh   (filtre par groupe)
#         REQ_ID=<uuid> bash backend/scripts/demo-respond.sh
# Prérequis : API sur :3000, demande active (validée si elle était en revue), vague 1 partie.
set -euo pipefail
source "$(dirname "$0")/lib.sh"

HT=$(login "$HOSP_PHONE")
ID="${REQ_ID:-$(active_request "${GROUP:-}")}"
[ -n "$ID" ] || { echo "Aucune demande active ${GROUP:-}. Est-elle encore en revue ?"; exit 1; }
echo "Demande $ID"

for p in $(alerted "$ID"); do
  code=$(respond "$ID" "$p")
  echo "   $p -> je_viens ($code)"
  if [ "$code" = "200" ]; then echo "Jauge : $(gauge "$ID")"; exit 0; fi
done
echo "Aucun donneur du seed n'a pu répondre (déjà répondu, non éligible, ou personne d'alerté)."
exit 1
