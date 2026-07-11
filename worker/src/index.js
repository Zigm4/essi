/**
 * Underdeck JPL proxy — Cloudflare Worker.
 *
 * The JPL SSD/CNEOS APIs (Horizons, SBDB) do not send CORS headers, so a
 * browser app cannot call them directly. This worker relays the three
 * endpoints Underdeck uses and adds CORS headers, nothing more.
 *
 *   GET /horizons?…    → https://ssd.jpl.nasa.gov/api/horizons.api?…
 *   GET /sbdb?…        → https://ssd-api.jpl.nasa.gov/sbdb.api?…
 *   GET /sbdb_query?…  → https://ssd-api.jpl.nasa.gov/sbdb_query.api?…
 *
 * Query strings are forwarded verbatim. Upstream status codes pass through
 * unchanged — SBDB legitimately answers 300 on multi-match lookups and the
 * client depends on receiving it.
 *
 * ALLOWED_ORIGINS (wrangler.toml) is a comma-separated list of origins
 * allowed to call this worker; "*" allows everyone.
 */

const UPSTREAMS = {
  '/horizons': 'https://ssd.jpl.nasa.gov/api/horizons.api',
  '/sbdb': 'https://ssd-api.jpl.nasa.gov/sbdb.api',
  '/sbdb_query': 'https://ssd-api.jpl.nasa.gov/sbdb_query.api',
};

// Per-route edge cache TTL (seconds). Horizons ephemerides for a given
// time window never change, but Underdeck's queries embed "now" down to
// the minute, so long TTLs would rarely hit anyway.
const CACHE_TTL = {
  '/horizons': 300,
  '/sbdb': 86400,
  '/sbdb_query': 3600,
};

function corsHeaders(request, env) {
  const allowed = (env.ALLOWED_ORIGINS || '*').split(',').map((s) => s.trim());
  const origin = request.headers.get('Origin') || '';
  const allowOrigin = allowed.includes('*')
    ? '*'
    : allowed.includes(origin)
      ? origin
      : allowed[0] || '';
  return {
    'Access-Control-Allow-Origin': allowOrigin,
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Max-Age': '86400',
    Vary: 'Origin',
  };
}

export default {
  async fetch(request, env) {
    const cors = corsHeaders(request, env);

    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: cors });
    }
    if (request.method !== 'GET') {
      return new Response('Method not allowed', { status: 405, headers: cors });
    }

    const url = new URL(request.url);
    const upstream = UPSTREAMS[url.pathname];
    if (!upstream) {
      const routes = Object.keys(UPSTREAMS).join(', ');
      return new Response(`Unknown route. Available: ${routes}`, {
        status: 404,
        headers: cors,
      });
    }

    const target = upstream + url.search;
    const response = await fetch(target, {
      headers: { Accept: 'application/json, text/plain, */*' },
      cf: {
        cacheTtl: CACHE_TTL[url.pathname],
        cacheEverything: true,
      },
    });

    const headers = new Headers(cors);
    const contentType = response.headers.get('Content-Type');
    if (contentType) headers.set('Content-Type', contentType);
    headers.set('Cache-Control', `public, max-age=${CACHE_TTL[url.pathname]}`);

    return new Response(response.body, { status: response.status, headers });
  },
};
