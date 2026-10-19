import { beforeEach, describe, expect, it, vi } from 'vitest';

const jplRequest = vi.fn();
vi.mock('./jplClient', () => ({ jplRequest: (...args: unknown[]) => jplRequest(...args) }));

const { track } = await import('./trackerClient');
const { TrackerMpcLookupError } = await import('./errors');

// Horizons VECTORS excerpt (km) - the format the parser reads.
const EPHEMERIS = `$$SOE
2461333.500000000 = A.D. 2026-Oct-19 00:00:00.0000 TDB
 X = 3.012345678901234E+08 Y = 7.654321098765432E+08 Z =-1.234567890123456E+07
 VX=-1.0E+01 VY= 5.0E+00 VZ= 1.0E-01
 LT= 2.7E+03 RG= 8.2E+08 RR= 1.0E+00
$$EOE`;

beforeEach(() => {
  jplRequest.mockReset();
  jplRequest.mockResolvedValue({ status: 200, body: JSON.stringify({ result: EPHEMERIS }) });
});

describe('track() for planets and moons', () => {
  it('asks Horizons for the body itself, without an SBDB lookup', async () => {
    const result = await track('https://proxy', { name: 'Europa', kind: 'moon', mpcID: 'jpl:502' }, []);
    expect(jplRequest).toHaveBeenCalledTimes(1);
    const [, route, params] = jplRequest.mock.calls[0] as [string, string, Record<string, string>];
    expect(route).toBe('horizons');
    expect(params.COMMAND).toBe("'502'"); // no ';' - that would be asteroid 502
    expect(result).toMatchObject({ mpcID: 'jpl:502', kind: 'moon', displayName: 'Europa', sector: 3 }); // 68.5°
  });

  it('finds the body from its name when the id is missing', async () => {
    const result = await track('https://proxy', { name: 'Titan', kind: 'moon' }, []);
    const [, , params] = jplRequest.mock.calls[0] as [string, string, Record<string, string>];
    expect(params.COMMAND).toBe("'606'");
    expect(result.mpcID).toBe('jpl:606');
  });

  it('refuses the Sun and unknown bodies', async () => {
    await expect(track('https://proxy', { name: 'Sun', kind: 'planet' }, [])).rejects.toBeInstanceOf(
      TrackerMpcLookupError,
    );
    await expect(track('https://proxy', { name: 'Vulcan', kind: 'planet' }, [])).rejects.toBeInstanceOf(
      TrackerMpcLookupError,
    );
    expect(jplRequest).not.toHaveBeenCalled();
  });
});
