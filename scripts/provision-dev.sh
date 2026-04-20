#!/usr/bin/env bash
# provision-dev.sh
#
# Owner-side script to provision a new developer.
# Creates a Supabase preview branch, collects credentials, and prints a
# credentials bundle you can paste into a password manager (1Password,
# Bitwarden) to share with the developer.
#
# Usage:  ./scripts/provision-dev.sh <dev-handle>
# Example: ./scripts/provision-dev.sh alice
#
# Prerequisites:
#   - supabase CLI logged in and linked to the production project
#   - gh CLI logged in as repo admin
#   - you are on your local machine, not CI

set -euo pipefail

DEV="${1:-}"
if [ -z "$DEV" ]; then
  echo "Usage: $0 <dev-handle>"
  echo "Example: $0 alice"
  exit 1
fi

# sanitize
DEV="$(echo "$DEV" | tr '[:upper:]' '[:lower:]' | tr -cd 'a-z0-9-')"
BRANCH_NAME="dev-${DEV}"
GH_REPO="Akema1/RMK-FORMATION-IA"

RED=$'\033[0;31m'
GREEN=$'\033[0;32m'
YELLOW=$'\033[0;33m'
BLUE=$'\033[0;34m'
BOLD=$'\033[1m'
RESET=$'\033[0m'

section() { printf "\n${BOLD}${BLUE}==> %s${RESET}\n" "$1"; }
ok()      { printf "  ${GREEN}✓${RESET} %s\n" "$1"; }
warn()    { printf "  ${YELLOW}!${RESET} %s\n" "$1"; }
err()     { printf "  ${RED}✗${RESET} %s\n" "$1"; }

printf "${BOLD}Provisioning developer: %s${RESET}\n" "$DEV"
printf "Supabase preview branch will be: %s\n" "$BRANCH_NAME"
printf "\nPress enter to continue, or Ctrl-C to abort..."
read -r

# ---------- 1. preflight ----------
section "1. Preflight checks"

command -v supabase >/dev/null || { err "supabase CLI missing"; exit 1; }
command -v gh       >/dev/null || { err "gh CLI missing"; exit 1; }
command -v jq       >/dev/null || { err "jq missing (brew install jq)"; exit 1; }

if ! supabase projects list >/dev/null 2>&1; then
  err "supabase CLI not logged in — run: supabase login"
  exit 1
fi
ok "supabase logged in"

if ! gh auth status >/dev/null 2>&1; then
  err "gh CLI not logged in — run: gh auth login"
  exit 1
fi
ok "gh logged in"

if [ ! -f supabase/config.toml ]; then
  err "supabase/config.toml not found — run this from repo root with Supabase linked"
  exit 1
fi
ok "supabase config present"

# ---------- 2. collect GitHub handle ----------
section "2. GitHub collaborator"

printf "GitHub username to invite as collaborator (leave blank to skip): "
read -r GH_USER

if [ -n "$GH_USER" ]; then
  if gh api "repos/${GH_REPO}/collaborators/${GH_USER}" >/dev/null 2>&1; then
    ok "${GH_USER} already has access to ${GH_REPO}"
  else
    if gh api -X PUT "repos/${GH_REPO}/collaborators/${GH_USER}" -f permission=push >/dev/null 2>&1; then
      ok "invited ${GH_USER} with Write permission — they must accept the invite via email"
    else
      err "failed to invite ${GH_USER} — check you have admin on the repo"
    fi
  fi
else
  warn "skipped GitHub invite"
fi

# ---------- 3. create Supabase preview branch ----------
section "3. Supabase preview branch"

# check if branch already exists (parse JSON list, not text)
if supabase branches list -o json 2>/dev/null | jq -e --arg n "$BRANCH_NAME" '.[] | select(.name == $n)' >/dev/null; then
  warn "preview branch ${BRANCH_NAME} already exists — reusing"
else
  printf "Creating preview branch (takes 1-2 minutes)...\n"
  if supabase branches create "$BRANCH_NAME" 2>&1 | tee /tmp/sb-create.log; then
    ok "preview branch ${BRANCH_NAME} created"
  else
    err "branch creation failed — see /tmp/sb-create.log"
    exit 1
  fi
fi

# fetch branch credentials
# NOTE: `branches get -o json` returns env-var-shaped keys:
#   SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY,
#   SUPABASE_DEFAULT_KEY, SUPABASE_JWT_SECRET,
#   POSTGRES_URL, POSTGRES_URL_NON_POOLING
printf "Fetching branch credentials...\n"
BRANCH_JSON="$(supabase branches get "$BRANCH_NAME" -o json 2>/dev/null || true)"
if [ -z "$BRANCH_JSON" ]; then
  err "could not fetch branch details — check: supabase branches list"
  exit 1
fi

BRANCH_URL="$(echo      "$BRANCH_JSON" | jq -r '.SUPABASE_URL              // empty')"
BRANCH_ANON="$(echo     "$BRANCH_JSON" | jq -r '.SUPABASE_ANON_KEY         // empty')"
BRANCH_SERVICE="$(echo  "$BRANCH_JSON" | jq -r '.SUPABASE_SERVICE_ROLE_KEY // empty')"
BRANCH_PGURL="$(echo    "$BRANCH_JSON" | jq -r '.POSTGRES_URL              // empty')"

# derive ref from URL (https://<ref>.supabase.co)
BRANCH_REF="$(echo "$BRANCH_URL" | sed -E 's#https?://([^.]+)\.supabase\.co.*#\1#')"

if [ -z "$BRANCH_URL" ] || [ -z "$BRANCH_ANON" ]; then
  warn "could not auto-extract keys from CLI output — fetch manually:"
  warn "  Supabase Dashboard → Branches → ${BRANCH_NAME} → Settings → API"
else
  ok "branch ref:  ${BRANCH_REF}"
  ok "branch URL:  ${BRANCH_URL}"
  ok "anon key:    extracted (${#BRANCH_ANON} chars)"
  ok "service key: extracted (${#BRANCH_SERVICE} chars)"
fi

# ---------- 4. reminders for manual steps ----------
section "4. Manual steps (owner must do these)"

cat <<EOF
  ${YELLOW}a.${RESET} Vercel: invite developer at https://vercel.com/<team>/settings/members
     Role: ${BOLD}Developer${RESET} (NOT Admin). Email: ask the developer.

  ${YELLOW}b.${RESET} AI Gateway key: share the AI_GATEWAY_API_KEY from your Vercel project env vars.
     The app routes all AI calls through Vercel AI Gateway — no per-developer key needed.
     Share the same key you use (it's already in your Vercel preview env).

  ${YELLOW}c.${RESET} Resend / Twilio: only if developer needs email or WhatsApp work.
     Create test-scoped keys, NOT production keys.

  ${YELLOW}d.${RESET} Confirm GitHub branch protection on ${BOLD}main${RESET} is enabled:
     https://github.com/${GH_REPO}/settings/branches
     Require: pull request, 1 approval, status checks, no force push.
EOF

# ---------- 5. credentials bundle ----------
section "5. Credentials bundle (paste into 1Password / Bitwarden)"

BUNDLE_FILE="/tmp/rmk-creds-${DEV}.txt"
cat > "$BUNDLE_FILE" <<EOF
=========================================================
RMK Seminar Manager — developer credentials for: ${DEV}
Generated: $(date -u +"%Y-%m-%dT%H:%M:%SZ")
=========================================================

# .env.local values — paste into RMK-FORMATION-IA/.env.local

VITE_SUPABASE_URL=${BRANCH_URL}
VITE_SUPABASE_ANON_KEY=${BRANCH_ANON:-<PASTE FROM SUPABASE DASHBOARD>}
SUPABASE_SERVICE_ROLE_KEY=${BRANCH_SERVICE:-<PASTE FROM SUPABASE DASHBOARD>}

# Direct Postgres connection (for psql, supabase db push, etc.)
# Do NOT put this in .env.local — use it only for CLI commands.
# POSTGRES_URL=${BRANCH_PGURL:-<fetch from dashboard>}

AI_GATEWAY_API_KEY=<PASTE FROM YOUR VERCEL PROJECT ENV VARS>

WEBHOOK_SECRET=<OPTIONAL — only if working on /webhook/* endpoints>

RESEND_API_KEY=<OPTIONAL — leave empty unless doing email work>
TWILIO_ACCOUNT_SID=<OPTIONAL>
TWILIO_AUTH_TOKEN=<OPTIONAL>
TWILIO_WHATSAPP_NUMBER=<OPTIONAL>

=========================================================
First-run instructions for the developer:
=========================================================
1. Accept the GitHub collaborator invite (check email).
2. Accept the Vercel team invite (check email).
3. Clone:    gh repo clone ${GH_REPO}
4. cd       RMK-FORMATION-IA
5. git checkout Improvements && git pull
6. git checkout -b feat/<your-feature>
7. cp .env.example .env.local
8. Paste the values above into .env.local
9. npm install
10. ./scripts/verify-dev-setup.sh   ← must show all green
11. npm run dev                     → http://localhost:8080

Read docs/CONTRIBUTOR_ONBOARDING.md for full workflow & rules.

=========================================================
Security reminders:
=========================================================
- Never commit .env.local
- Never share these credentials with anyone
- Never point at the production Supabase project
- All PRs target 'Improvements', never 'main'
- The owner handles production deploys
EOF

chmod 600 "$BUNDLE_FILE"
ok "credentials bundle written to: ${BUNDLE_FILE}"
warn "copy this into 1Password / Bitwarden and share the vault item with the developer."
warn "then ${BOLD}delete${RESET} the local file: rm ${BUNDLE_FILE}"

# ---------- done ----------
printf "\n${GREEN}${BOLD}✓ Provisioning complete for '${DEV}'.${RESET}\n"
printf "\nTo de-provision later:\n"
printf "  supabase branches delete ${BRANCH_NAME}\n"
printf "  gh api -X DELETE repos/${GH_REPO}/collaborators/${GH_USER:-<handle>}\n"
printf "  Vercel dashboard → Members → remove\n"
printf "  Revoke the Gemini/Resend/Twilio keys you issued\n"
