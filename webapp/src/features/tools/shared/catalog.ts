import { appFetchText } from '../../../core/http';

/**
 * Loads a static catalog JSON that ships under `public/catalog/`. Served from
 * the site root (respecting the Vite BASE_URL), so it works on GitHub Pages
 * subpaths. Network failures surface as NetworkError (mapped by friendlyError);
 * a malformed body throws a SyntaxError that the caller maps to its fallback.
 */
export async function loadCatalog<T>(file: string): Promise<T> {
  const url = `${import.meta.env.BASE_URL}catalog/${file}`;
  const raw = await appFetchText(url);
  return JSON.parse(raw) as T;
}
