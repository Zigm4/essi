/**
 * Seed pack import (maps spec §9). The bundled seed manifest ships sha256/bytes
 * PLACEHOLDERS; the importer loads each file from the web `public/` bundle,
 * recomputes sha256 locally (the seed is authenticated as a same-origin static
 * asset, not wire-verified) and patches the manifest before validating. Never
 * throws — returns a result the UI turns into a real empty/failure state.
 */

import { db, type MapPackFileRow } from '../../../../data/db';
import { validateDocument, validateManifest } from './parse';
import { hashBytes, writeTrustedBlob } from './blobStore';
import { getSeedImportedVersion, setSeedImportedVersion } from './prefs';

export const kMapSeedTag = 'seed';

interface SeedFileRef {
  path: string;
  sha256: string;
  bytes: number;
  kind?: string;
  pixelSize?: [number, number];
}
interface SeedMap {
  id: string;
  draft?: boolean;
  document: SeedFileRef;
  assets?: SeedFileRef[];
}
interface SeedManifest {
  contentVersion: string;
  maps: SeedMap[];
  [key: string]: unknown;
}

export type SeedImportResult =
  | { kind: 'imported'; mapCount: number }
  | { kind: 'skipped'; reason: 'alreadyImported' | 'contentAlreadyInstalled' }
  | { kind: 'failed'; error: unknown; diskFull: boolean };

/** Translate a bundled Flutter asset path to a web `public/` URL. */
function seedAssetUrl(assetPath: string): string {
  const base = import.meta.env.BASE_URL; // ends with '/'
  if (assetPath.startsWith('assets/maps_seed/')) {
    return base + 'maps-seed/' + assetPath.slice('assets/maps_seed/'.length);
  }
  if (assetPath.startsWith('assets/knowledge/')) {
    return base + 'knowledge/' + assetPath.slice('assets/knowledge/'.length);
  }
  return base + assetPath.replace(/^assets\//, '');
}

async function fetchSeedBytes(url: string): Promise<Uint8Array> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`seed asset ${url}: HTTP ${res.status}`);
  return new Uint8Array(await res.arrayBuffer());
}

function isQuotaExceeded(e: unknown): boolean {
  return (
    e instanceof DOMException &&
    (e.name === 'QuotaExceededError' || e.code === 22 || e.name === 'NS_ERROR_DOM_QUOTA_REACHED')
  );
}

export async function ensureSeedImported(): Promise<SeedImportResult> {
  try {
    const manifestUrl = import.meta.env.BASE_URL + 'maps-seed/manifest.json';
    const manifestText = await (await fetch(manifestUrl)).text();
    const raw = JSON.parse(manifestText) as SeedManifest;
    const bundledVersion = raw.contentVersion;

    // 1. Guard: the bundled contentVersion IS the import guard.
    if (getSeedImportedVersion() === bundledVersion) {
      return { kind: 'skipped', reason: 'alreadyImported' };
    }

    // 2. Real content installed (any non-seed pack) covers the baseline.
    const packs = await db.mapPacks.toArray();
    if (packs.some((p) => p.tag !== kMapSeedTag)) {
      setSeedImportedVersion(bundledVersion);
      return { kind: 'skipped', reason: 'contentAlreadyInstalled' };
    }

    // 3. Load bytes, recompute hashes, patch the manifest in place.
    const bytesBySha = new Map<string, Uint8Array>();
    for (const map of raw.maps) {
      if (map.draft === true) continue;
      const docBytes = await fetchSeedBytes(seedAssetUrl(map.document.path));
      const docSha = await hashBytes(docBytes);
      map.document.sha256 = docSha;
      map.document.bytes = docBytes.byteLength;
      bytesBySha.set(docSha, docBytes);
      for (const asset of map.assets ?? []) {
        const aBytes = await fetchSeedBytes(seedAssetUrl(asset.path));
        const aSha = await hashBytes(aBytes);
        asset.sha256 = aSha;
        asset.bytes = aBytes.byteLength;
        bytesBySha.set(aSha, aBytes);
      }
    }

    // Re-encode + validate the patched manifest.
    const manifestBytes = new TextEncoder().encode(JSON.stringify(raw));
    const manifestSha = await hashBytes(manifestBytes);
    const manRes = validateManifest(raw, manifestBytes.byteLength);
    if (!manRes.ok) {
      return { kind: 'failed', error: new Error(`seed manifest invalid: ${manRes.message}`), diskFull: false };
    }
    const manifest = manRes.value;

    // Validate every non-draft document.
    const fileRows: MapPackFileRow[] = [
      {
        contentVersion: manifest.contentVersion,
        logicalPath: 'manifest.json',
        sha256: manifestSha,
        bytes: manifestBytes.byteLength,
        kind: 'manifest',
      },
    ];
    for (const descriptor of manifest.maps) {
      if (descriptor.draft) continue;
      const docBytes = bytesBySha.get(descriptor.document.sha256);
      if (docBytes === undefined) {
        return { kind: 'failed', error: new Error(`seed doc bytes missing for ${descriptor.id}`), diskFull: false };
      }
      const docRes = validateDocument(JSON.parse(new TextDecoder().decode(docBytes)), docBytes.byteLength);
      if (!docRes.ok) {
        return { kind: 'failed', error: new Error(`seed doc ${descriptor.id} invalid: ${docRes.message}`), diskFull: false };
      }
      fileRows.push({
        contentVersion: manifest.contentVersion,
        logicalPath: descriptor.document.path,
        sha256: descriptor.document.sha256,
        bytes: descriptor.document.bytes,
        kind: 'document',
      });
      for (const asset of descriptor.assets) {
        fileRows.push({
          contentVersion: manifest.contentVersion,
          logicalPath: asset.path,
          sha256: asset.sha256,
          bytes: asset.bytes,
          kind: asset.kind ?? 'asset',
        });
      }
    }

    // Write all blobs (seed is trusted — no re-verify).
    await writeTrustedBlob(manifestBytes, manifestSha);
    for (const [sha, bytes] of bytesBySha) await writeTrustedBlob(bytes, sha);

    // One transaction: drop older seed packs, upsert the new pack + file rows.
    await db.transaction('rw', db.mapPacks, db.mapPackFiles, async () => {
      const olderSeed = await db.mapPacks.toArray();
      for (const p of olderSeed) {
        if (p.tag === kMapSeedTag && p.contentVersion !== manifest.contentVersion) {
          await db.mapPackFiles.where('contentVersion').equals(p.contentVersion).delete();
          await db.mapPacks.delete(p.contentVersion);
        }
      }
      await db.mapPacks.put({
        contentVersion: manifest.contentVersion,
        tag: kMapSeedTag,
        manifestSha256: manifestSha,
        installedAt: Date.now(),
        state: 'installed',
      });
      await db.mapPackFiles.where('contentVersion').equals(manifest.contentVersion).delete();
      await db.mapPackFiles.bulkPut(fileRows);
    });

    // 4. Record the imported version.
    setSeedImportedVersion(manifest.contentVersion);
    const mapCount = manifest.maps.filter((m) => !m.draft).length;
    return { kind: 'imported', mapCount };
  } catch (error) {
    // The guard is NOT set on failure, so a retry re-runs the import.
    return { kind: 'failed', error, diskFull: isQuotaExceeded(error) };
  }
}
