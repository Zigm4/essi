/**
 * Build-time app configuration.
 *
 * The JPL proxy URL is fixed here so the NASA tools work for everyone with no
 * setup. To point at a different Cloudflare Worker, edit this value and redeploy
 * (a `VITE_JPL_PROXY_URL` build env var still overrides it if set). End users
 * cannot change it from the app.
 */

const ENV_PROXY: unknown = import.meta.env.VITE_JPL_PROXY_URL;

export const JPL_PROXY_URL: string =
  typeof ENV_PROXY === 'string' && ENV_PROXY.trim().length > 0
    ? ENV_PROXY
    : 'https://underdeck-jpl-proxy.zigm4.workers.dev';
