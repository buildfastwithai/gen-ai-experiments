#!/usr/bin/env bash
# Environment check for <PROJECT>. Read-only: this script changes nothing.
# Usage: ./scripts/doctor.sh
#
# EDIT ONLY THE CHECKS BLOCK BELOW. The runner beneath it is complete.

set -u

# ---------------------------------------------------------------------------
# CHECKS
# ---------------------------------------------------------------------------
# check <severity> <label> <fix hint> <<'TEST'
#   shell commands; exit status is the result
# TEST
#
# severity: required | optional

checks() {
# --- CHECKS-START --- (eazyr regenerates between these markers; edit freely)

  check required "Node.js >= 20" "Install Node 20+: https://nodejs.org (or: nvm install 20)" <<'TEST'
    command -v node >/dev/null && version_at_least "$(node -v | tr -d v)" 20.0.0
TEST

  check required "pnpm installed" "corepack enable && corepack prepare pnpm@latest --activate" <<'TEST'
    command -v pnpm >/dev/null
TEST

  check required ".env exists" "cp .env.example .env" <<'TEST'
    [ -f .env ]
TEST

  check required "DATABASE_URL set" "Set DATABASE_URL in .env (see .env.example for the local default)" <<'TEST'
    [ -f .env ] && grep -qE '^DATABASE_URL=.+' .env
TEST

  check required "port 3000 free" "Stop whatever holds it: lsof -ti:3000 | xargs kill" <<'TEST'
    ! port_in_use 3000
TEST

  check optional "Docker running" "Start Docker Desktop — needed only for integration tests" <<'TEST'
    docker info >/dev/null 2>&1
TEST

# --- CHECKS-END ---
}

# ---------------------------------------------------------------------------
# RUNNER — no edits needed below this line
# ---------------------------------------------------------------------------

if [ -t 1 ] && [ -z "${NO_COLOR:-}" ]; then
  GREEN=$'\033[32m'; RED=$'\033[31m'; YELLOW=$'\033[33m'; DIM=$'\033[2m'; RESET=$'\033[0m'
else
  GREEN=''; RED=''; YELLOW=''; DIM=''; RESET=''
fi

failed=0
warned=0

# version_at_least CURRENT MINIMUM — numeric, segment by segment.
# Tolerates prerelease suffixes: 20.1.0-rc.1 compares as 20.1.0.
version_at_least() {
  # Strip a leading v and any prerelease suffix, then pad so a short version
  # ("20") still yields zeros for the segments it omits.
  current=$(printf '%s' "${1:-0}" | sed 's/^[vV]//; s/[^0-9.].*$//').0.0.0
  minimum=$(printf '%s' "${2:-0}" | sed 's/^[vV]//; s/[^0-9.].*$//').0.0.0
  i=1
  while [ "$i" -le 4 ]; do
    c=$(printf '%s' "$current" | cut -d. -f"$i"); c=${c:-0}
    m=$(printf '%s' "$minimum" | cut -d. -f"$i"); m=${m:-0}
    case $c in ''|*[!0-9]*) c=0 ;; esac
    case $m in ''|*[!0-9]*) m=0 ;; esac
    [ "$c" -gt "$m" ] && return 0
    [ "$c" -lt "$m" ] && return 1
    i=$((i + 1))
  done
  return 0
}

# port_in_use PORT — true when something is listening.
port_in_use() {
  if command -v lsof >/dev/null 2>&1; then
    lsof -iTCP:"$1" -sTCP:LISTEN -t >/dev/null 2>&1
  elif command -v ss >/dev/null 2>&1; then
    ss -ltn 2>/dev/null | grep -q ":$1[[:space:]]"
  elif command -v netstat >/dev/null 2>&1; then
    netstat -an 2>/dev/null | grep -q "[.:]$1[[:space:]].*LISTEN"
  else
    return 1  # can't tell; don't fail the run over it
  fi
}

check() {
  severity=$1
  label=$2
  fix=$3
  body=$(cat)

  if ( eval "$body" ) >/dev/null 2>&1; then
    printf '%s✔%s  %s\n' "$GREEN" "$RESET" "$label"
  elif [ "$severity" = optional ]; then
    warned=$((warned + 1))
    printf '%s!%s  %s %s(optional)%s\n' "$YELLOW" "$RESET" "$label" "$DIM" "$RESET"
    [ -n "$fix" ] && printf '   %s→ %s%s\n' "$DIM" "$fix" "$RESET"
  else
    failed=$((failed + 1))
    printf '%s✖%s  %s\n' "$RED" "$RESET" "$label"
    [ -n "$fix" ] && printf '   %s→ %s%s\n' "$DIM" "$fix" "$RESET"
  fi
}

cd "$(dirname "$0")/.." || exit 1

printf '\nChecking your environment...\n\n'
checks
printf '\n'

if [ "$failed" -gt 0 ]; then
  printf '%s%d required check(s) failed.%s Fix the items above, then run this again.\n\n' \
    "$RED" "$failed" "$RESET"
  exit 1
fi

if [ "$warned" -gt 0 ]; then
  printf '%sReady%s — with %d optional item(s) unavailable.\n\n' "$GREEN" "$RESET" "$warned"
else
  printf '%sReady.%s\n\n' "$GREEN" "$RESET"
fi
exit 0
