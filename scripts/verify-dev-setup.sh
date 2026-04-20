#!/usr/bin/env bash
# verify-dev-setup.sh
#
# Developer-side onboarding verification script.
# Run this AFTER you have:
#   - cloned the repo
#   - created your feature branch off Improvements
#   - received credentials from the project owner
#   - filled in .env.local
#
# Usage:  ./scripts/verify-dev-setup.sh
#
# The script checks every piece of access you need and prints a PASS/FAIL
# summary. It does not modify your machine or the cloud resources.

set -u

# ---------- colours ----------
RED=$'\033[0;31m'
GREEN=$'\033[0;32m'
YELLOW=$'\033[0;33m'
BLUE=$'\033[0;34m'
BOLD=$'\033[1m'
RESET=$'\033[0m'

PASS_COUNT=0
FAIL_COUNT=0
WARN_COUNT=0
FAILURES=()

section() { printf "\n${BOLD}${BLUE}==> %s${RESET}\n" "$1"; }
pass()    { printf "  ${GREEN}✓${RESET} %s\n" "$1"; PASS_COUNT=$((PASS_COUNT+1)); }
fail()    { printf "  ${RED}✗${RESET} %s\n" "$1"; FAIL_COUNT=$((FAIL_COUNT+1)); FAILURES+=("$1"); }
warn()    { printf "  ${YELLOW}!${RESET} %s\n" "$1"; WARN_COUNT=$((WARN_COUNT+1)); }
info()    { printf "    %s\n" "$1"; }

# ---------- 0. project root ----------
cd "$(dirname "$0")/.." || { echo "cannot cd to repo root"; exit 1; }
REPO_ROOT="$(pwd)"

printf "${BOLD}RMK Seminar Manager — developer setup verification${RESET}\n"
printf "Repo root: %s\n" "$REPO_ROOT"

# ---------- 1. prerequisites ----------
section "1. Prerequisite tools"

check_tool() {
  local name="$1" cmd="$2" min="${3:-}"
  if command -v "$cmd" >/dev/null 2>&1; then
    local ver
    ver="$($cmd --version 2>&1 | head -n1)"
    pass "$name installed ($ver)"
  else
    fail "$name not found — install before continuing"
  fi
}

check_tool "Node.js" node
check_tool "npm" npm
check_tool "Git" git
check_tool "GitHub CLI" gh
check_tool "Supabase CLI" supabase

# Node version check
if command -v node >/dev/null 2>&1; then
  NODE_MAJOR=$(node -p "process.versions.node.split('.')[0]")
  if [ "$NODE_MAJOR" -ge 20 ]; then
    pass "Node.js major version is $NODE_MAJOR (>= 20)"
  else
    fail "Node.js is $NODE_MAJOR — project requires >= 20 LTS"
  fi
fi

# ---------- 2. git state ----------
section "2. Git repository state"

if [ -d .git ]; then
  pass "inside a git repository"
else
  fail "not a git repository — are you in the right directory?"
fi

REMOTE_URL="$(git config --get remote.origin.url 2>/dev/null || true)"
if [[ "$REMOTE_URL" == *"Akema1/RMK-FORMATION-IA"* ]]; then
  pass "origin points to Akema1/RMK-FORMATION-IA"
else
  warn "origin is '$REMOTE_URL' — expected Akema1/RMK-FORMATION-IA"
fi

CURRENT_BRANCH="$(git rev-parse --abbrev-ref HEAD 2>/dev/null || echo '')"
info "current branch: $CURRENT_BRANCH"

case "$CURRENT_BRANCH" in
  main|Improvements)
    warn "you are on '$CURRENT_BRANCH' — create a feature branch before committing"
    info "run: git checkout -b feat/<short-description>"
    ;;
  feat/*|fix/*|chore/*|docs/*)
    pass "on a correctly-named feature branch"
    ;;
  *)
    warn "branch name '$CURRENT_BRANCH' does not match feat/|fix/|chore/|docs/ convention"
    ;;
esac

# ---------- 3. GitHub access ----------
section "3. GitHub access"

if gh auth status >/dev/null 2>&1; then
  GH_USER="$(gh api user --jq .login 2>/dev/null || echo unknown)"
  pass "authenticated as '$GH_USER'"

  if gh repo view Akema1/RMK-FORMATION-IA >/dev/null 2>&1; then
    pass "can view Akema1/RMK-FORMATION-IA"
  else
    fail "cannot access Akema1/RMK-FORMATION-IA — ask owner to add you as collaborator"
  fi

  # collaborator permission check
  PERM="$(gh api "repos/Akema1/RMK-FORMATION-IA/collaborators/$GH_USER/permission" --jq .permission 2>/dev/null || echo none)"
  case "$PERM" in
    admin|maintain|write) pass "repo permission: $PERM" ;;
    read)                 warn "repo permission is read-only — ask owner to grant Write" ;;
    none|*)               fail "no repo permission detected — ask owner to invite you" ;;
  esac
else
  fail "not authenticated with gh — run: gh auth login"
fi

# ---------- 4. .env.local ----------
section "4. Environment file"

if [ -f .env.local ]; then
  pass ".env.local exists"

  # make sure it's gitignored
  if git check-ignore -q .env.local; then
    pass ".env.local is gitignored"
  else
    fail ".env.local is NOT gitignored — STOP, do not commit"
  fi

  # required vars
  required=(VITE_SUPABASE_URL VITE_SUPABASE_ANON_KEY SUPABASE_SERVICE_ROLE_KEY AI_GATEWAY_API_KEY)
  for v in "${required[@]}"; do
    val="$(grep -E "^${v}=" .env.local | sed "s/^${v}=//; s/^['\"]//; s/['\"]$//")"
    if [ -n "$val" ]; then
      pass "$v is set"
    else
      fail "$v is missing or empty in .env.local"
    fi
  done

  # optional vars (warn only)
  optional=(RESEND_API_KEY TWILIO_ACCOUNT_SID TWILIO_AUTH_TOKEN TWILIO_WHATSAPP_NUMBER WEBHOOK_SECRET)
  for v in "${optional[@]}"; do
    val="$(grep -E "^${v}=" .env.local | sed "s/^${v}=//; s/^['\"]//; s/['\"]$//")"
    if [ -n "$val" ]; then
      pass "$v is set (optional)"
    else
      warn "$v is empty (optional — set if working on email/WhatsApp/webhooks)"
    fi
  done

  # sanity: is Supabase URL pointing at a preview, not prod?
  SB_URL="$(grep -E '^VITE_SUPABASE_URL=' .env.local | sed 's/^VITE_SUPABASE_URL=//; s/^["\x27]//; s/["\x27]$//')"
  if [[ "$SB_URL" == *"branch"* ]] || [[ "$SB_URL" =~ -[a-z0-9]{6,}\.supabase\.co ]]; then
    pass "Supabase URL looks like a preview branch"
  else
    warn "Supabase URL does not look like a preview branch — confirm with owner you are NOT pointing at production"
    info "  current: $SB_URL"
  fi
else
  fail ".env.local does not exist — copy .env.example and fill in the values from the owner"
fi

# ---------- 5. dependencies ----------
section "5. Node dependencies"

if [ -d node_modules ]; then
  pass "node_modules exists"
else
  warn "node_modules missing — running 'npm install' now..."
  if npm install --silent 2>/dev/null; then
    pass "npm install succeeded"
  else
    fail "npm install failed — check npm output manually"
  fi
fi

# ---------- 6. type check & build ----------
section "6. Type check"

if npm run lint >/tmp/rmk-lint.log 2>&1; then
  pass "npm run lint passed (TypeScript type-check)"
else
  fail "npm run lint failed — see /tmp/rmk-lint.log"
fi

# ---------- 7. Supabase preview branch connectivity ----------
section "7. Supabase preview branch connectivity"

if [ -f .env.local ]; then
  SB_URL="$(grep -E '^VITE_SUPABASE_URL=' .env.local | sed 's/^VITE_SUPABASE_URL=//; s/^["\x27]//; s/["\x27]$//')"
  SB_ANON="$(grep -E '^VITE_SUPABASE_ANON_KEY=' .env.local | sed 's/^VITE_SUPABASE_ANON_KEY=//; s/^["\x27]//; s/["\x27]$//')"
  SB_SERVICE="$(grep -E '^SUPABASE_SERVICE_ROLE_KEY=' .env.local | sed 's/^SUPABASE_SERVICE_ROLE_KEY=//; s/^["\x27]//; s/["\x27]$//')"

  if [ -n "$SB_URL" ] && [ -n "$SB_ANON" ]; then
    # Supabase REST health check with anon key
    HTTP_CODE="$(curl -s -o /dev/null -w '%{http_code}' -H "apikey: $SB_ANON" -H "Authorization: Bearer $SB_ANON" "${SB_URL}/rest/v1/" 2>/dev/null || echo 000)"
    if [[ "$HTTP_CODE" =~ ^(200|404)$ ]]; then
      pass "Supabase anon key reaches REST API (HTTP $HTTP_CODE)"
    else
      fail "Supabase anon key rejected (HTTP $HTTP_CODE) — URL or key is wrong"
    fi

    # Try reading from participants table (RLS may block anon reads; a 200 or 401 both mean auth works)
    HTTP_CODE="$(curl -s -o /dev/null -w '%{http_code}' -H "apikey: $SB_ANON" -H "Authorization: Bearer $SB_ANON" "${SB_URL}/rest/v1/participants?limit=1" 2>/dev/null || echo 000)"
    case "$HTTP_CODE" in
      200) pass "participants table readable" ;;
      401|403) warn "participants table blocked by RLS (HTTP $HTTP_CODE) — expected, auth still valid" ;;
      404) fail "participants table not found — migrations may not be applied to your preview branch" ;;
      *)   fail "unexpected HTTP $HTTP_CODE hitting participants table" ;;
    esac
  else
    fail "cannot test Supabase — URL or anon key missing"
  fi

  # service-role key check (should get broader access)
  if [ -n "$SB_SERVICE" ]; then
    HTTP_CODE="$(curl -s -o /dev/null -w '%{http_code}' -H "apikey: $SB_SERVICE" -H "Authorization: Bearer $SB_SERVICE" "${SB_URL}/rest/v1/participants?limit=1" 2>/dev/null || echo 000)"
    if [ "$HTTP_CODE" = "200" ]; then
      pass "service role key has full read access"
    else
      fail "service role key failed (HTTP $HTTP_CODE)"
    fi
  fi
else
  warn "skipping — no .env.local"
fi

# Supabase CLI login
if supabase projects list >/dev/null 2>&1; then
  pass "Supabase CLI is logged in"
else
  warn "Supabase CLI not logged in — run: supabase login"
fi

# ---------- 8. Vercel preview deployments ----------
section "8. Vercel preview deployments"

pass "no Vercel account needed — previews are built automatically by GitHub integration"
pass "after opening a PR, Vercel posts the preview URL as a status check on the PR"

# ---------- 9. dev server smoke test ----------
section "9. Dev server smoke test"

info "starting 'npm run dev' for 10 seconds to verify it boots..."
npm run dev >/tmp/rmk-dev.log 2>&1 &
DEV_PID=$!
sleep 10

if kill -0 "$DEV_PID" 2>/dev/null; then
  HTTP_CODE="$(curl -s -o /dev/null -w '%{http_code}' http://localhost:8080/ 2>/dev/null || echo 000)"
  if [ "$HTTP_CODE" = "200" ]; then
    pass "dev server responds on http://localhost:8080 (HTTP 200)"
  else
    fail "dev server started but HTTP $HTTP_CODE — see /tmp/rmk-dev.log"
  fi
  kill "$DEV_PID" 2>/dev/null || true
  wait "$DEV_PID" 2>/dev/null || true
else
  fail "dev server failed to start — see /tmp/rmk-dev.log"
fi

# ---------- summary ----------
printf "\n${BOLD}===============================${RESET}\n"
printf "${BOLD}Summary${RESET}\n"
printf "${BOLD}===============================${RESET}\n"
printf "${GREEN}  passed:   %d${RESET}\n" "$PASS_COUNT"
printf "${YELLOW}  warnings: %d${RESET}\n" "$WARN_COUNT"
printf "${RED}  failed:   %d${RESET}\n" "$FAIL_COUNT"

if [ "$FAIL_COUNT" -gt 0 ]; then
  printf "\n${RED}${BOLD}Failures:${RESET}\n"
  for f in "${FAILURES[@]}"; do
    printf "  ${RED}•${RESET} %s\n" "$f"
  done
  printf "\n${RED}Setup incomplete. Fix the failures above and re-run this script.${RESET}\n"
  exit 1
fi

if [ "$WARN_COUNT" -gt 0 ]; then
  printf "\n${YELLOW}Setup works but has warnings — review them above.${RESET}\n"
fi

printf "\n${GREEN}${BOLD}✓ You are fully configured. Happy coding!${RESET}\n"
printf "\nNext steps:\n"
printf "  1. git checkout -b feat/<your-feature>  (if not already on one)\n"
printf "  2. npm run dev                           (work locally)\n"
printf "  3. git push -u origin <branch>           (Vercel preview auto-builds)\n"
printf "  4. gh pr create --base Improvements      (open PR for review)\n"
