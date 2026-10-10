#!/usr/bin/env bash
# Fonctions communes aux scripts de démo. À sourcer : source "$(dirname "$0")/lib.sh"
API="${API:-http://localhost:3000}"
PASS="${SEED_PASSWORD:-Damm2026!}"
SEED_PREFIX="${SEED_PREFIX:-+2160000}"      # donneurs du seed (les autres comptes ont un autre mot de passe)
HOSP_PHONE="${HOSP_PHONE:-+21600010001}"    # Hôpital Charles Nicolle (seed)
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"

json() { # lit un champ (a.b.c) sur stdin
  node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{let o=JSON.parse(s);for(const k of process.argv[1].split("."))o=o?.[k];console.log(o??"")})' "$1"
}

login() { # téléphone -> jeton (réessaie si le throttler refuse)
  local r t
  for _ in 1 2 3 4 5 6 7 8; do
    r=$(curl -s -X POST "$API/auth/login" -H 'Content-Type: application/json' \
      -d "{\"phone\":\"$1\",\"password\":\"$PASS\"}")
    case "$r" in *Throttler*|*"Too Many"*) echo "   (limite de débit, attente 10 s)" >&2; sleep 10 ;; *) break ;; esac
  done
  for k in accessToken access_token token; do
    t=$(echo "$r" | json "$k" 2>/dev/null || true)
    [ -n "$t" ] && { echo "$t"; return; }
  done
  echo "Login échoué pour $1 : $r" >&2
  return 1
}

sql() { (cd "$ROOT" && docker compose exec -T db sh -c 'psql -U "${POSTGRES_USER:-postgres}" -d "${POSTGRES_DB:-postgres}" -At -c "$0"' "$1"); }

# Les fonctions ci-dessous utilisent le jeton de l'hôpital dans $HT (HT=$(login "$HOSP_PHONE")).
active_request() { # [groupe] -> id de la première demande active de la liste
  curl -s "$API/requests" -H "Authorization: Bearer $HT" | GROUP="${1:-}" node -e '
    let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{
      const g=process.env.GROUP;
      const r=JSON.parse(s).filter(x=>x.status==="active"&&(!g||x.bloodGroup===g));
      console.log(r[0]?.id??"")})'
}

request_status() { curl -s "$API/requests/$1" -H "Authorization: Bearer $HT" | json status; }

alerted() { # id -> téléphones des donneurs du seed alertés, dans l'ordre d'alerte
  sql "SELECT u.phone FROM notifications n JOIN users u ON u.id=n.user_id
       WHERE n.request_id='$1' AND n.type='urgence' AND u.phone LIKE '${SEED_PREFIX}%'
       ORDER BY n.created_at, u.phone"
}

respond() { # id téléphone -> code HTTP de « je viens »
  local t; t=$(login "$2")
  curl -s -o /dev/null -w '%{http_code}' -X POST "$API/requests/$1/respond" \
    -H "Authorization: Bearer $t" -H 'Content-Type: application/json' -d '{"response":"je_viens"}'
}

gauge() { # id -> « 3/7 (43%) · 2 vague(s) · statut active »
  curl -s "$API/requests/$1/live" -H "Authorization: Bearer $HT" | node -e '
    let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{const j=JSON.parse(s);
      console.log(`${j.gauge.accepted}/${j.gauge.needed} (${j.gauge.percent}%) · ${j.waves.length} vague(s) · statut ${j.status}`)})'
}
