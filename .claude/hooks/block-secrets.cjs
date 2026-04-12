#!/usr/bin/env node
/**
 * PreToolUse hook — blocks Bash calls that would commit secrets or force-push to main.
 *
 * Reads the tool input from stdin (Claude Code hook protocol) and checks:
 *   1. `git commit` — scans staged diff for known secret patterns
 *   2. `git push --force` / `git push -f` to main or master — hard block
 *
 * Exit 0 = allow, exit 2 = block (stderr becomes the reason shown to Claude).
 */
const fs = require('fs');
const { execFileSync } = require('child_process');

let payload = '';
try {
  payload = fs.readFileSync(0, 'utf8');
} catch {
  process.exit(0);
}

let input;
try {
  input = JSON.parse(payload);
} catch {
  process.exit(0);
}

const cmd = input?.tool_input?.command || '';
if (!cmd) process.exit(0);

// ── 1. Force-push to main/master ──────────────────────────────────────────
const forcePushMain = /git\s+push.*(--force|--force-with-lease|\s-f\b).*\b(main|master)\b/;
const forcePushMainAlt = /git\s+push.*\b(main|master)\b.*(--force|--force-with-lease|\s-f\b)/;
if (forcePushMain.test(cmd) || forcePushMainAlt.test(cmd)) {
  console.error('BLOCKED: force-push to main/master is prohibited. Use a PR instead.');
  process.exit(2);
}

// ── 2. Scan staged diff on git commit ─────────────────────────────────────
const isCommit = /\bgit\s+commit\b/.test(cmd);
if (!isCommit) process.exit(0);

let diff = '';
try {
  diff = execFileSync('git', ['diff', '--staged'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });
} catch {
  process.exit(0);
}
if (!diff) process.exit(0);

// Only scan ADDED lines (ignore removals and context)
const added = diff
  .split('\n')
  .filter((l) => l.startsWith('+') && !l.startsWith('+++'))
  .join('\n');

const patterns = [
  { name: 'Generic API key assignment', re: /(api[_-]?key|apikey|secret|token|password|passwd|pwd)\s*[:=]\s*['"][A-Za-z0-9_\-]{20,}['"]/i },
  { name: 'Anthropic key',              re: /sk-ant-[A-Za-z0-9_\-]{20,}/ },
  { name: 'OpenAI key',                 re: /sk-[A-Za-z0-9]{32,}/ },
  { name: 'OpenRouter key',             re: /sk-or-[A-Za-z0-9_\-]{20,}/ },
  { name: 'Google API key',             re: /AIza[0-9A-Za-z_\-]{35}/ },
  { name: 'Supabase service role',      re: /SUPABASE_SERVICE_ROLE[^=\n]*=\s*['"]?eyJ[A-Za-z0-9_\-]{20,}/ },
  { name: 'Supabase JWT',               re: /eyJhbGciOi[A-Za-z0-9_\-]{20,}\.[A-Za-z0-9_\-]{20,}\.[A-Za-z0-9_\-]{20,}/ },
  { name: 'AWS access key',             re: /AKIA[0-9A-Z]{16}/ },
  { name: 'Twilio auth token assign',   re: /TWILIO_AUTH_TOKEN[^=\n]*=\s*['"]?[a-f0-9]{32}/i },
  { name: 'Webhook secret assign',      re: /WEBHOOK_SECRET[^=\n]*=\s*['"][^'"\n]{16,}/ },
  { name: 'Private key header',         re: /-----BEGIN (RSA |EC |OPENSSH |DSA )?PRIVATE KEY-----/ },
  { name: 'AI Gateway key assign',      re: /AI_GATEWAY_API_KEY[^=\n]*=\s*['"][^'"\n]{16,}/ },
];

const hits = [];
for (const { name, re } of patterns) {
  if (re.test(added)) hits.push(name);
}

if (hits.length) {
  console.error(
    `BLOCKED: potential secrets in staged diff:\n  - ${hits.join('\n  - ')}\n\nReview with: git diff --staged\nIf this is a false positive, unstage the file, sanitize it, and re-stage.`
  );
  process.exit(2);
}

process.exit(0);
