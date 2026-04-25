// Crockford base32 alphabet minus U — excludes 0/O, 1/I, L, U so refs typed
// from a screenshot or read aloud over the phone are unambiguous.
const ALPHABET = "23456789ABCDEFGHJKMNPQRSTVWXYZ";

// 5-char suffix → 30^5 = 24.3M buckets. At 1k refs/year, P(collision) ≈ 0.002%
// (birthday paradox). Earlier 4-char version was ~46% collision — practically
// guaranteed retries. /api/register still catches the remaining 23505 unique
// constraint violations and re-issues with a fresh UUID, but that path is now
// genuinely rare instead of the normal path.
const SUFFIX_LENGTH = 5;

function hashUuid(uuid: string): number {
  // FNV-1a over the UUID hex. Deterministic, no crypto.subtle needed.
  const hex = uuid.replace(/-/g, "");
  let hash = 0x811c9dc5;
  for (let i = 0; i < hex.length; i++) {
    hash ^= hex.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash >>> 0;
}

export function generatePaymentReference(uuid: string): string {
  const year = new Date().getUTCFullYear();
  let n = hashUuid(uuid);
  let code = "";
  for (let i = 0; i < SUFFIX_LENGTH; i++) {
    code = ALPHABET[n % ALPHABET.length] + code;
    n = Math.floor(n / ALPHABET.length);
  }
  return `RMK-${year}-${code}`;
}
