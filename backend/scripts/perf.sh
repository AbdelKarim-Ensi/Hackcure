#!/usr/bin/env bash
# Script 3 : mesures de performance (vague 1 < 10 s, jauge < 2 s). Raccourci vers perf-t5-6.sh.
# Usage : bash backend/scripts/perf.sh     (API lancée)
set -euo pipefail
exec bash "$(dirname "$0")/perf-t5-6.sh" "$@"
