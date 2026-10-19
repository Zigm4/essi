import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { validateDocument, validateManifest } from '../knowledge/maps/data/parse';
import type { MapDescriptor, MapDocument } from '../knowledge/maps/model/types';
import { pristineFilter, visibleJobs } from '../tools/jobs/jobsLogic';
import { parseWallets, search as searchWallets } from '../tools/wallet/walletData';
import { runSearchSources, targetLocation, type GlobalSearchHit } from './globalSearch';
import { buildJobsCorpus, buildZoneCorpus, jobHits, walletHits, zoneHits } from './searchSources';

const publicDir = resolve(import.meta.dirname, '../../../public');

function readJson(path: string): { json: unknown; bytes: number } {
  const buf = readFileSync(resolve(publicDir, path));
  return { json: JSON.parse(buf.toString('utf-8')), bytes: buf.byteLength };
}

const jobsCorpus = buildJobsCorpus(readJson('catalog/jobs.json').json);
const owners = parseWallets(readJson('catalog/wallets.json').json);

/** The bundled seed maps, parsed as the maps area parses them. */
const seedMaps: { descriptor: MapDescriptor; doc: MapDocument }[] = (() => {
  const manifest = readJson('maps-seed/manifest.json');
  const parsed = validateManifest(manifest.json, manifest.bytes);
  if (!parsed.ok) throw new Error(parsed.message);
  return parsed.value.maps.map((descriptor) => {
    const file = readJson(`maps-seed/${descriptor.id}.map.json`);
    const doc = validateDocument(file.json, file.bytes);
    if (!doc.ok) throw new Error(doc.message);
    return { descriptor, doc: doc.value };
  });
})();
const zoneCorpus = buildZoneCorpus(seedMaps);

function locations(hits: readonly GlobalSearchHit[]): string[] {
  return hits.map((hit) => targetLocation(hit.target));
}

describe('jobHits (real jobs.json)', () => {
  it('finds a job by its ID, with or without #, and opens the Jobs tool on it', () => {
    for (const query of ['35511202', '#35511202']) {
      const hits = jobHits(jobsCorpus, query);
      expect(hits).toHaveLength(1);
      expect(hits[0]!.title).toBe('Job #35511202 · Professor Q');
      expect(hits[0]!.subtitle).toMatch(/^PRQ BEGINNER STR \[gain STRENGTH\]: Break rocks/);
      expect(targetLocation(hits[0]!.target)).toBe('/tools/jobs?q=%2335511202');
    }
  });

  it('matches what the Jobs tool lists for the same search (one row per ID)', () => {
    const ctx = { starred: new Set<string>(), statusMap: new Map(), zoneNames: jobsCorpus.zoneNames };
    for (const query of ['beginner', 'PRQ', 'professor q', 'Mischief', 'Queens Quarry', 'rocks', '355', '#30107301']) {
      const tool = visibleJobs(jobsCorpus.jobs, { ...pristineFilter(), query }, ctx);
      const ids = jobHits(jobsCorpus, query).map((hit) => (hit.target.kind === 'job' ? hit.target.jobId : ''));
      expect(ids.length, query).toBeGreaterThan(0);
      expect(ids, query).toEqual([...new Set(tool.map((job) => String(job.id)))]);
    }
  });

  it('lists the 24 beginner jobs', () => {
    expect(jobHits(jobsCorpus, 'beginner')).toHaveLength(24);
  });

  it('puts the exact ID first', () => {
    const [first] = jobHits(jobsCorpus, '30107301');
    expect(first!.target).toEqual({ kind: 'job', jobId: '30107301' });
  });

  it('a blank or #-only query finds nothing', () => {
    expect(jobHits(jobsCorpus, '#')).toEqual([]);
  });
});

describe('walletHits (real wallets.json)', () => {
  it('finds an owner by Discord handle and opens Wallet Lookup on them', () => {
    const hits = walletHits(owners, 'cruzified999');
    expect(hits).toHaveLength(1);
    expect(hits[0]).toMatchObject({ title: '! Cruzified', subtitle: '@cruzified999 · jnyrg.wam', icon: 'person' });
    expect(targetLocation(hits[0]!.target)).toBe('/tools/wallet?q=cruzified999');
  });

  it('an owner without a handle opens on their name', () => {
    const cain = walletHits(owners, 'cain').find((hit) => hit.title === 'cain');
    expect(cain?.subtitle).toBe('sajoa.c.wam');
    expect(cain?.target).toEqual({ kind: 'wallet', query: 'cain' });
  });

  it('finds a wallet of an owner whose name does not match', () => {
    const hits = walletHits(owners, 'sajoa');
    expect(hits).toEqual([
      {
        source: 'wallet',
        title: 'sajoa.c.wam',
        subtitle: 'Owner: cain',
        icon: 'wallet',
        target: { kind: 'wallet', query: 'sajoa.c.wam' },
      },
    ]);
  });

  it('counts what Wallet Lookup counts', () => {
    for (const query of ['lalothen', 'wam', 'a', 'zz']) {
      const tool = searchWallets(query, owners);
      expect(walletHits(owners, query), query).toHaveLength(tool.ownerHits.length + tool.walletHits.length);
    }
  });
});

describe('zoneHits (bundled seed maps)', () => {
  it('finds zones by an enum value (the 40 Mars zones Lalothen owns)', () => {
    const hits = zoneHits(zoneCorpus, 'Lalothen');
    expect(hits).toHaveLength(40);
    expect(hits.every((hit) => hit.subtitle.startsWith('Mars') && hit.subtitle.includes('Lalothen'))).toBe(true);
    expect(locations(hits)).toContain('/knowledge/maps/mars?zone=z120');
  });

  it('finds zones by name, diacritics and case ignored', () => {
    const [first] = zoneHits(zoneCorpus, 'chalybes geothermal');
    expect(first).toMatchObject({ title: 'Chalybes Geothermal Caldera', subtitle: 'Io · Chalybes', icon: 'map' });
    expect(targetLocation(first!.target)).toBe('/knowledge/maps/io?zone=z1');
  });

  it('a zone number lists that zone of every map first, in map order', () => {
    for (const query of ['35', '035', 'z35', '#35', 'Zone 35']) {
      const hits = locations(zoneHits(zoneCorpus, query));
      expect(hits.slice(0, 3), query).toEqual([
        '/knowledge/maps/io?zone=z35',
        '/knowledge/maps/venus?zone=z35',
        '/knowledge/maps/mars?zone=z35',
      ]);
      expect(new Set(hits).size, query).toBe(hits.length); // the text search adds no duplicates
    }
  });

  it('skips draft maps', () => {
    const drafted = seedMaps.map((m) => (m.doc.id === 'mars' ? { ...m, descriptor: { ...m.descriptor, draft: true } } : m));
    expect(zoneHits(buildZoneCorpus(drafted), 'Lalothen')).toEqual([]);
  });

  it('no match → no hit', () => {
    expect(zoneHits(zoneCorpus, 'qwxzv')).toEqual([]);
  });
});

describe('runSearchSources with the real catalogs', () => {
  it('a knowledge base that fails to load still shows zones, wallets and notes', async () => {
    const note: GlobalSearchHit = {
      source: 'capture',
      title: 'Lalothen trade',
      subtitle: '',
      icon: 'note',
      target: { kind: 'route', location: '/captures/note/n1' },
    };
    const result = await runSearchSources('Lalothen', {
      mapZone: async (q) => zoneHits(zoneCorpus, q),
      kbArticle: () => Promise.reject(new Error('manifest -> HTTP 404')),
      job: async (q) => jobHits(jobsCorpus, q),
      wallet: async (q) => walletHits(owners, q),
      capture: async () => [note],
      mapPin: async () => [],
    });
    expect(result.groups.map((g) => [g.source, g.total])).toEqual([
      ['mapZone', 40],
      ['wallet', 1],
      ['capture', 1],
    ]);
    expect(result.failed.map((f) => f.source)).toEqual(['kbArticle']);
  });
});
