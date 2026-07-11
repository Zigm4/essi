/** Byte formatting (data-layer spec §13): `none`, `540 B`, `9.5 MB`, `12 MB`. */
export function formatBytes(bytes: number): string {
  if (bytes <= 0) return 'none';
  const units = ['B', 'KB', 'MB', 'GB'] as const;
  let value = bytes;
  let unit = 0;
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024;
    unit += 1;
  }
  const digits = value < 10 && unit > 0 ? 1 : 0;
  return `${value.toFixed(digits)} ${units[unit]}`;
}
