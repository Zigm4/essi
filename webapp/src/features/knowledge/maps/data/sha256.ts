/**
 * sha256 integrity primitives (maps spec §4.3). Uses Web Crypto
 * (`crypto.subtle.digest('SHA-256', …)`). `verifyBytes` is length-checked and
 * constant-time over the digest (XOR-accumulate the hex code units).
 */

const HEX = '0123456789abcdef';

export async function sha256Hex(bytes: BufferSource): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  const view = new Uint8Array(digest);
  let out = '';
  for (let i = 0; i < view.length; i++) {
    const b = view[i];
    out += HEX[(b >> 4) & 0xf] + HEX[b & 0xf];
  }
  return out;
}

/** Constant-time compare of sha256(bytes) against a pinned hex hash. */
export async function verifyBytes(bytes: BufferSource, expectedHex: string): Promise<boolean> {
  const expected = expectedHex.trim().toLowerCase();
  const actual = await sha256Hex(bytes);
  if (actual.length !== expected.length) return false;
  let diff = 0;
  for (let i = 0; i < actual.length; i++) {
    diff |= actual.charCodeAt(i) ^ expected.charCodeAt(i);
  }
  return diff === 0;
}
