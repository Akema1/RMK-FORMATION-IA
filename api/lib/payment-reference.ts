// Crockford base32 alphabet minus U — excludes 0/O, 1/I, U so refs typed
// from a screenshot or read aloud over the phone are unambiguous.
const ALPHABET = "23456789ABCDEFGHJKMNPQRSTVWXYZ";

function hashUuid(uuid: string): number {
  // FNV-1a over the UUID hex. Deterministic, no crypto.subtle needed,
  // 32-bit so we can index into a 30-char alphabet four times without
  // running out of entropy (30^4 = 810k buckets, enough for a year of
  // refs with the retry loop in /api/register handling collisions).
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
  for (let i = 0; i < 4; i++) {
    code = ALPHABET[n % ALPHABET.length] + code;
    n = Math.floor(n / ALPHABET.length);
  }
  return `RMK-${year}-${code}`;
}
