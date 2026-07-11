/**
 * Content repository — update lifecycle, install, offline reads and clear
 * (maps spec §10). All render-time reads come from the local blob store;
 * never the network. `checkForUpdate` never throws (failures → CheckFailed).
 *
 * Web note: there is no separate SQLite FTS5 table — the zone search index is
 * rebuilt in-memory from the installed docs at load (see data/search.ts), so
 * install/clear only manage `mapPacks` + `mapPackFiles` + the blob store.
 */

import { db, type MapPackFileRow } from '../../../../data/db';
import { compareContentVersions } from '../model/version';
import type { MapDescriptor, MapDocument, MapPointer, MapsManifest } from '../model/types';
import { MapLimits } from '../model/limits';
import {
  blobExists,
  gcBlobs,
  readBlobBytes,
  writeBlob,
} from './blobStore';
import { mapsJsDelivrUrl, mapsRawUrl } from './endpoints';
import { fetchPointer, fetchVerified } from './fetcher';
import { validateDocument, validateManifest, validatePointer } from './parse';
import {
  getLastCheckAt,
  getPointerEtag,
  removeLastCheckAt,
  removePointerEtag,
  setLastCheckAt,
  setPointerEtag,
} from './prefs';

export const CHECK_INTERVAL_MS = 24 * 60 * 60 * 1000;
export const APP_VERSION_FALLBACK = '0.2.0';

export class MapInstallException extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'MapInstallException';
  }
}

export type MapUpdateOutcome =
  | { kind: 'disabled' }
  | { kind: 'throttled' }
  | { kind: 'upToDate' }
  | { kind: 'blockedByAppVersion'; minAppVersion: string }
  | { kind: 'checkFailed'; error: unknown }
  | { kind: 'available'; pointer: MapPointer; manifest: MapsManifest; manifestBytes: Uint8Array };

function decodeJson(bytes: Uint8Array): unknown {
  return JSON.parse(new TextDecoder().decode(bytes));
}

// --- Offline reads (§10.3) --------------------------------------------------

export async function installedContentVersion(): Promise<string | null> {
  const rows = await db.mapPacks.where('state').equals('installed').toArray();
  if (rows.length === 0) return null;
  rows.sort((a, b) => b.installedAt - a.installedAt);
  return rows[0].contentVersion;
}

async function installedPackManifestSha(): Promise<string | null> {
  const rows = await db.mapPacks.where('state').equals('installed').toArray();
  if (rows.length === 0) return null;
  rows.sort((a, b) => b.installedAt - a.installedAt);
  return rows[0].manifestSha256;
}

export async function loadInstalledManifest(): Promise<MapsManifest | null> {
  const sha = await installedPackManifestSha();
  if (sha === null) return null;
  const bytes = await readBlobBytes(sha);
  if (bytes === null) return null;
  try {
    const res = validateManifest(decodeJson(bytes), bytes.byteLength);
    return res.ok ? res.value : null;
  } catch {
    return null;
  }
}

export async function loadDocument(mapId: string): Promise<MapDocument | null> {
  const manifest = await loadInstalledManifest();
  if (manifest === null) return null;
  const descriptor = manifest.maps.find((m) => m.id === mapId);
  if (descriptor === undefined) return null;
  const bytes = await readBlobBytes(descriptor.document.sha256);
  if (bytes === null) return null;
  try {
    const res = validateDocument(decodeJson(bytes), bytes.byteLength);
    return res.ok ? res.value : null;
  } catch {
    return null;
  }
}

function assetShaForKind(descriptor: MapDescriptor, kind: string): string | null {
  const asset = descriptor.assets.find((a) => a.kind === kind);
  return asset === undefined ? null : asset.sha256;
}

export async function loadMapAssetBytes(mapId: string, kind: string): Promise<Uint8Array | null> {
  const manifest = await loadInstalledManifest();
  if (manifest === null) return null;
  const descriptor = manifest.maps.find((m) => m.id === mapId);
  if (descriptor === undefined) return null;
  const sha = assetShaForKind(descriptor, kind);
  return sha === null ? null : readBlobBytes(sha);
}

/** Content-address of a map's asset of a given kind, for image decoding. */
export async function mapAssetSha(mapId: string, kind: string): Promise<string | null> {
  const manifest = await loadInstalledManifest();
  if (manifest === null) return null;
  const descriptor = manifest.maps.find((m) => m.id === mapId);
  if (descriptor === undefined) return null;
  return assetShaForKind(descriptor, kind);
}

// --- Update check (§10.1) ---------------------------------------------------

export async function checkForUpdate(args: {
  networkEnabled: boolean;
  appVersion: string;
  force?: boolean;
}): Promise<MapUpdateOutcome> {
  if (!args.networkEnabled) return { kind: 'disabled' };
  const now = Date.now();
  if (args.force !== true) {
    const last = getLastCheckAt();
    if (last !== null && now - last < CHECK_INTERVAL_MS) return { kind: 'throttled' };
  }
  try {
    const etag = getPointerEtag();
    const pointerFetch = await fetchPointer(etag.length > 0 ? { etag } : {});
    setLastCheckAt(now); // the check ran, regardless of result
    if (pointerFetch.notModified) return { kind: 'upToDate' };

    const pointerRes = validatePointer(decodeJson(pointerFetch.bytes), pointerFetch.byteLength);
    if (!pointerRes.ok) return { kind: 'checkFailed', error: pointerRes };
    const pointer = pointerRes.value;

    const installed = await installedContentVersion();
    if (installed !== null && compareContentVersions(pointer.contentVersion, installed) <= 0) {
      setPointerEtag(pointerFetch.etag); // next poll 304s cheaply
      return { kind: 'upToDate' };
    }
    if (compareContentVersions(args.appVersion, pointer.minAppVersion) < 0) {
      return { kind: 'blockedByAppVersion', minAppVersion: pointer.minAppVersion };
    }

    const verified = await fetchVerified({
      primaryUrl: mapsJsDelivrUrl(pointer.tag, pointer.manifest.path),
      fallbackUrl: mapsRawUrl(pointer.tag, pointer.manifest.path),
      expectedSha256: pointer.manifest.sha256,
      maxBytes: MapLimits.manifestMaxBytes,
    });
    const manifestRes = validateManifest(decodeJson(verified.bytes), verified.byteLength);
    if (!manifestRes.ok) return { kind: 'checkFailed', error: manifestRes };

    setPointerEtag(pointerFetch.etag); // only after the whole chain validated
    return { kind: 'available', pointer, manifest: manifestRes.value, manifestBytes: verified.bytes };
  } catch (error) {
    return { kind: 'checkFailed', error };
  }
}

// --- Install (§10.2) --------------------------------------------------------

async function ensureBlobBytes(
  ref: { path: string; sha256: string; bytes: number },
  tag: string,
  cdnBase: string,
  maxBytes: number,
): Promise<Uint8Array> {
  if (await blobExists(ref.sha256)) {
    const existing = await readBlobBytes(ref.sha256);
    if (existing !== null) return existing; // differential reuse — no network hit
  }
  const verified = await fetchVerified({
    primaryUrl: `${cdnBase}/${ref.path}`,
    fallbackUrl: mapsRawUrl(tag, ref.path),
    expectedSha256: ref.sha256,
    maxBytes,
  });
  await writeBlob(verified.bytes, ref.sha256);
  return verified.bytes;
}

export async function install(
  available: Extract<MapUpdateOutcome, { kind: 'available' }>,
  options: { pins?: readonly string[] } = {},
): Promise<void> {
  const { pointer, manifest, manifestBytes } = available;
  const tag = pointer.tag;
  const cdnBase = manifest.cdnBase;

  // 1. Store the manifest blob (verified against the pinned hash).
  await writeBlob(manifestBytes, pointer.manifest.sha256);

  // 2. Ensure + validate every non-draft map's document and its assets.
  const fileRows: MapPackFileRow[] = [
    {
      contentVersion: manifest.contentVersion,
      logicalPath: 'manifest.json',
      sha256: pointer.manifest.sha256,
      bytes: pointer.manifest.bytes,
      kind: 'manifest',
    },
  ];
  for (const descriptor of manifest.maps) {
    if (descriptor.draft) continue;
    const docBytes = await ensureBlobBytes(descriptor.document, tag, cdnBase, MapLimits.documentMaxBytes);
    const docRes = validateDocument(decodeJson(docBytes), docBytes.byteLength);
    if (!docRes.ok) {
      throw new MapInstallException(`map ${descriptor.id}: invalid document (${docRes.message})`);
    }
    fileRows.push({
      contentVersion: manifest.contentVersion,
      logicalPath: descriptor.document.path,
      sha256: descriptor.document.sha256,
      bytes: descriptor.document.bytes,
      kind: 'document',
    });
    for (const asset of descriptor.assets) {
      await ensureBlobBytes(asset, tag, cdnBase, MapLimits.maxImageBytes);
      fileRows.push({
        contentVersion: manifest.contentVersion,
        logicalPath: asset.path,
        sha256: asset.sha256,
        bytes: asset.bytes,
        kind: asset.kind ?? 'asset',
      });
    }
  }

  // 3. One transaction: upsert the pack, replace its file rows.
  await db.transaction('rw', db.mapPacks, db.mapPackFiles, async () => {
    await db.mapPackFiles.where('contentVersion').equals(manifest.contentVersion).delete();
    await db.mapPacks.put({
      contentVersion: manifest.contentVersion,
      tag,
      manifestSha256: pointer.manifest.sha256,
      installedAt: Date.now(),
      state: 'installed',
    });
    await db.mapPackFiles.bulkPut(fileRows);
  });

  // 4. GC orphaned blobs (keep everything referenced + caller pins).
  const keep = new Set<string>(options.pins ?? []);
  await db.mapPackFiles.each((row) => keep.add(row.sha256));
  await gcBlobs(keep);
}

// --- Clear (§10.4) ----------------------------------------------------------

export async function clearAllContent(): Promise<void> {
  await db.transaction('rw', db.mapPackFiles, db.mapPacks, async () => {
    await db.mapPackFiles.clear();
    await db.mapPacks.clear();
  });
  await gcBlobs([]); // empty keep — collect everything
  removePointerEtag();
  removeLastCheckAt();
}
