import { readFileSync } from 'node:fs';
import { describe, it, expect } from 'vitest';
import { validateDocument, validateManifest } from './parse';

const seedDir = `${process.cwd()}/public/maps-seed/`;

function loadJson(name: string): { json: unknown; bytes: number } {
  const buf = readFileSync(seedDir + name);
  return { json: JSON.parse(buf.toString('utf-8')), bytes: buf.byteLength };
}

describe('mars seed', () => {
  it('mars.map.json validates as a 576-zone grid document', () => {
    const { json, bytes } = loadJson('mars.map.json');
    const res = validateDocument(json, bytes);
    expect(res.ok, res.ok ? '' : res.message).toBe(true);
    if (res.ok) {
      expect(res.value.id).toBe('mars');
      expect(res.value.grid).toEqual({ cols: 24, rows: 24 });
      expect(res.value.zones.length).toBe(576);
    }
  });

  it('manifest.json validates and lists mars', () => {
    const { json, bytes } = loadJson('manifest.json');
    const res = validateManifest(json, bytes);
    expect(res.ok, res.ok ? '' : res.message).toBe(true);
    if (res.ok) {
      expect(res.value.maps.map((m) => m.id)).toContain('mars');
    }
  });
});
