# Contributor Onboarding — RMK Seminar Manager

Welcome! This guide walks you through getting a working local environment, a Supabase preview branch, and a Vercel preview deployment so you can contribute features without touching production.

**Golden rule:** all work happens on feature branches off `Improvements`. You will never push to `main` or deploy to production directly.

---

## 1. Prerequisites

Install these tools first:

| Tool | Version | Install |
|---|---|---|
| Node.js | ≥ 20 LTS | https://nodejs.org or `nvm install 20` |
| npm | ≥ 10 | bundled with Node |
| Git | latest | https://git-scm.com |
| GitHub CLI (`gh`) | latest | https://cli.github.com |
| Supabase CLI | latest | `brew install supabase/tap/supabase` or https://supabase.com/docs/guides/cli |

Accounts you will need (the project owner will invite you):
- GitHub account
- Supabase account (free tier is fine)

---

## 2. Get access (done by project owner)

The project owner performs these steps and sends you confirmation:

1. **GitHub** — adds you as a collaborator on `Akema1/RMK-FORMATION-IA` with **Write** access (not Admin).
2. **Supabase** — creates a preview branch named `dev-<yourname>` and sends you its connection details via a password manager share (1Password / Bitwarden). **Credentials never come through Slack, email, or chat.**

Wait for both confirmations before continuing.

---

## 3. Clone the repository

```bash
gh auth login                                   # one-time
gh repo clone Akema1/RMK-FORMATION-IA
cd RMK-FORMATION-IA
```

Check you are on the right base branch:

```bash
git checkout Improvements
git pull origin Improvements
```

---

## 4. Create your feature branch

Never commit directly to `Improvements` or `main`. Always branch:

```bash
git checkout -b feat/<short-description>
# examples:
#   feat/waitlist-form
#   fix/attestation-pdf-margin
#   chore/upgrade-react-router
```

Branch-naming convention:
- `feat/` new feature
- `fix/` bug fix
- `chore/` tooling / deps / non-user-facing
- `docs/` documentation only

---

## 5. Install dependencies

```bash
npm install
```

If you hit peer-dependency errors, run `npm install --legacy-peer-deps` once and flag it to the owner — do not commit a lockfile change without discussion.

---

## 6. Configure your local environment

### 6.1 Create `.env.local`

Copy the example file:

```bash
cp .env.example .env.local
```

### 6.2 Fill in credentials from the password manager share

The owner will share a vault item with these values. Paste them into `.env.local`:

| Variable | Source | Notes |
|---|---|---|
| `VITE_SUPABASE_URL` | Supabase preview branch | URL of **your** preview branch, not production |
| `VITE_SUPABASE_ANON_KEY` | Supabase preview branch | anon key of **your** preview branch |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase preview branch | service role for **your** preview branch only |
| `AI_GATEWAY_API_KEY` | Owner (from Vercel project env vars) | routes AI calls through Vercel AI Gateway to Claude Haiku |
| `RESEND_API_KEY` | Owner (optional) | test domain only; leave blank if not doing email work |
| `TWILIO_ACCOUNT_SID` / `TWILIO_AUTH_TOKEN` / `TWILIO_WHATSAPP_FROM` | Owner (optional) | test credentials; leave blank if not doing WhatsApp work |

`.env.local` is gitignored. **Never commit it.** If you ever accidentally stage it, stop and tell the owner — a secret rotation is required.

### 6.3 Verify everything with the setup script

A script checks every piece of your access end-to-end and prints a PASS/FAIL summary:

```bash
./scripts/verify-dev-setup.sh
```

It verifies: Node/npm/git/gh/supabase CLIs, GitHub repo permission, `.env.local` completeness, Supabase preview-branch connectivity (anon + service role), dev-server boot, and TypeScript type-check. Do not proceed until it shows all green.

---

## 7. Working with the Supabase preview branch

Your preview branch is an isolated copy of the production schema with no real user data. You can freely insert, update, delete, and run migrations.

### Link the Supabase CLI to your preview

```bash
supabase login
supabase link --project-ref <your-preview-ref>   # owner provides the ref
```

### Running migrations locally

If your feature needs a schema change:

```bash
supabase migration new <migration_name>
# edit the generated file in supabase/migrations/
supabase db push                                  # applies to your preview branch
```

Commit the migration file. **Do not** run `supabase db push` against production — only the owner does that, after PR review.

### Resetting your preview

If you corrupt your preview schema:

```bash
supabase db reset                                 # re-applies all migrations from scratch
```

Then re-seed if needed (ask owner for the seed file location).

---

## 8. Vercel preview deployments

You do **not** need a Vercel account. Every time you push a branch to GitHub and open a PR, Vercel's GitHub integration automatically builds a preview deployment and posts the URL as a status check on the PR:

```
✓  Preview deployment ready
   → https://rmk-formation-ia-git-feat-xyz-akemas-projects.vercel.app
```

No `vercel` CLI commands, no login, no configuration needed on your side. The owner manages all Vercel settings and production env vars. You just push code and Vercel does the rest.

---

## 9. Development workflow

### Daily loop

```bash
git checkout Improvements && git pull            # stay up to date
git checkout feat/your-branch
git rebase Improvements                           # integrate latest changes
# ... code ...
npm run lint                                      # before every commit
git add <specific files>                          # never `git add .`
git commit -m "feat(scope): short imperative description"
git push -u origin feat/your-branch
```

### Commit message convention

Follow Conventional Commits:

```
feat(landing): add waitlist opt-in
fix(admin): correct expense total calculation
chore(deps): bump react-router to 7.1
docs(contributing): clarify migration workflow
```

### Before opening a PR, run locally

```bash
npm run lint                                      # must pass
npm run build                                     # must succeed
npx playwright test                               # if you touched user-facing flows
```

---

## 10. Opening a pull request

```bash
gh pr create --base Improvements --title "feat(scope): ..." --body "..."
```

PR description must include:

```markdown
## Summary
- what changed in 1–3 bullets

## Why
- link to issue / motivation

## Test plan
- [ ] npm run lint passes
- [ ] npm run build passes
- [ ] manual test on Vercel preview URL: <paste after PR creation>
- [ ] any migration applied to preview branch successfully

## Screenshots (if UI)
- before / after
```

Always target `Improvements` as the base, **never** `main`.

Wait for:
1. Vercel preview URL to build green
2. Owner review + approval
3. Owner merges

The owner handles the `Improvements → main` promotion and the production deploy.

---

## 11. Things NOT to do

- Do not push to `main` or `Improvements` directly.
- Do not run migrations against the production Supabase project.
- Do not commit `.env*` files.
- Do not share your credentials with anyone, including other contributors.
- Do not use `git push --force` on shared branches.
- Do not use `git add .` — always list files explicitly to avoid committing secrets or junk.
- Do not run `vercel deploy` manually — let the GitHub integration handle it.
- Do not install new top-level dependencies without discussing with the owner first.

---

## 12. Getting help

- **Architecture questions** — read `CLAUDE.md` at the repo root.
- **Seminar data model** — see `src/data/seminars.ts` (single source of truth).
- **Database schema** — see `supabase/migrations/`.
- **Stuck?** — open a draft PR early and tag the owner for guidance.

---

## 13. Off-boarding (when engagement ends)

The owner will:
- Remove GitHub collaborator access
- Delete your Supabase preview branch
- Rotate the AI_GATEWAY_API_KEY if needed (shared key)
- Revoke Resend / Twilio test keys if issued

Please `git push` any in-progress work to a branch before your access is revoked.

---

*Last updated: 2026-04-19*
