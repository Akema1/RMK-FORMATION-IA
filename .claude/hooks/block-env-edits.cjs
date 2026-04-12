#!/usr/bin/env node
/**
 * PreToolUse hook — blocks Edit/Write on .env files.
 *
 * .env files hold secrets in plaintext. Edits should come from `vercel env pull`
 * or a deliberate manual action — not from Claude. This hook hard-blocks any
 * Edit/Write targeting a dotfile-style env file.
 *
 * Override: touch .claude/allow-env-edits (removes block until file is deleted).
 * Exit 0 = allow, exit 2 = block.
 */
const fs = require('fs');
const path = require('path');

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

const filePath = input?.tool_input?.file_path || '';
if (!filePath) process.exit(0);

const basename = path.basename(filePath);
// Match .env, .env.local, .env.production, .env.preview, etc.
const envPattern = /^\.env(\.|$)/;
if (!envPattern.test(basename)) process.exit(0);

// Override sentinel
const repoRoot = path.resolve(__dirname, '..', '..');
const overridePath = path.join(repoRoot, '.claude', 'allow-env-edits');
if (fs.existsSync(overridePath)) {
  process.exit(0);
}

console.error(
  `BLOCKED: Edit/Write to ${basename} is prohibited.\n\n` +
    `.env files hold secrets in plaintext. Do not modify them from Claude.\n` +
    `- To pull from Vercel: run 'vercel env pull' (user action)\n` +
    `- To edit manually: user opens the file directly\n` +
    `- To temporarily allow: 'touch .claude/allow-env-edits' then delete after.`
);
process.exit(2);
