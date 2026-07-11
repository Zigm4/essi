/**
 * Content-addressed blob store (maps spec §8.1), backed by the Dexie
 * `mapBlobs` table (the web mirror of the filesystem blob store). The key IS
 * the lowercase sha256 hex; an already-present blob is trusted by its address
 * and skipped. `gc` deletes any blob not in the keep set.
 */

import { db, type MapBlobRow } from '../../../../data/db';
import { sha256Hex, verifyBytes } from './sha256';

export class BlobIntegrityException extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'BlobIntegrityException';
  }
}

/**
 * TS 5.7 tightened `BufferSource`/`BlobPart` so a `Uint8Array<ArrayBufferLike>`
 * (potentially `SharedArrayBuffer`-backed) is no longer accepted where a plain
 * `ArrayBuffer` view is required. Every blob we handle is genuinely
 * `ArrayBuffer`-backed, so re-assert the buffer type. This is a compile-time
 * no-op — the runtime object (and its byteOffset/byteLength) is untouched, so
 * `crypto.subtle.digest` and `new Blob(...)` see exactly the same bytes.
 */
function asArrayBufferView(bytes: Uint8Array): Uint8Array<ArrayBuffer> {
  return bytes as Uint8Array<ArrayBuffer>;
}

/** Verify the hash, then store (idempotent by content address). */
export async function writeBlob(bytes: Uint8Array, expectedSha256: string): Promise<void> {
  const view = asArrayBufferView(bytes);
  const ok = await verifyBytes(view, expectedSha256);
  if (!ok) throw new BlobIntegrityException(`blob hash mismatch (expected ${expectedSha256})`);
  const key = expectedSha256.trim().toLowerCase();
  if (await db.mapBlobs.get(key)) return;
  await db.mapBlobs.put({ sha256: key, data: new Blob([view]) });
}

/** Store without re-verify — only for the bundled seed hashed in-process. */
export async function writeTrustedBlob(bytes: Uint8Array, sha256: string): Promise<void> {
  const key = sha256.trim().toLowerCase();
  await db.mapBlobs.put({ sha256: key, data: new Blob([asArrayBufferView(bytes)]) });
}

export async function readBlobBytes(sha256: string): Promise<Uint8Array | null> {
  const row = await db.mapBlobs.get(sha256.trim().toLowerCase());
  if (row === undefined) return null;
  return new Uint8Array(await row.data.arrayBuffer());
}

export async function readBlob(sha256: string): Promise<Blob | null> {
  const row = await db.mapBlobs.get(sha256.trim().toLowerCase());
  return row === undefined ? null : row.data;
}

export async function blobExists(sha256: string): Promise<boolean> {
  return (await db.mapBlobs.get(sha256.trim().toLowerCase())) !== undefined;
}

/** Compute the content address of some bytes (used by the seed importer). */
export async function hashBytes(bytes: Uint8Array): Promise<string> {
  return sha256Hex(asArrayBufferView(bytes));
}

/** Delete every blob whose sha256 ∉ keep; returns the count deleted. */
export async function gcBlobs(keep: Iterable<string>): Promise<number> {
  const keepSet = new Set<string>();
  for (const k of keep) keepSet.add(k.trim().toLowerCase());
  let deleted = 0;
  const doomed: string[] = [];
  await db.mapBlobs.each((row: MapBlobRow) => {
    if (!keepSet.has(row.sha256)) doomed.push(row.sha256);
  });
  if (doomed.length > 0) {
    await db.mapBlobs.bulkDelete(doomed);
    deleted = doomed.length;
  }
  return deleted;
}

export async function totalBlobBytes(): Promise<number> {
  let total = 0;
  await db.mapBlobs.each((row: MapBlobRow) => {
    total += row.data.size;
  });
  return total;
}
