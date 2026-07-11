/** Content-delivery endpoints (maps spec §4.1). All hosts send CORS `*`. */

export const kMapsContentRepo = 'underpunks55/underdeck-content';
export const kMapsContentBase = 'https://underpunks55.github.io/underdeck-content';
export const kMapsPointerUrl = `${kMapsContentBase}/pointer/latest-v1.json`;
export const kMapsPointerFallbackUrl =
  'https://raw.githubusercontent.com/underpunks55/underdeck-content/main/pointer/latest-v1.json';

export function mapsJsDelivrUrl(tag: string, path: string): string {
  return `https://cdn.jsdelivr.net/gh/underpunks55/underdeck-content@${tag}/${path}`;
}

export function mapsRawUrl(tag: string, path: string): string {
  return `https://raw.githubusercontent.com/underpunks55/underdeck-content/${tag}/${path}`;
}
