/** English-month local date/number formatters for the NASA tools. */

const MONTHS = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
] as const;

function pad2(n: number): string {
  return n.toString().padStart(2, '0');
}

export function monthAbbr(monthIndex: number): string {
  return MONTHS[monthIndex] ?? '';
}

/** `d MMM yyyy` (local). */
export function dMonthYear(d: Date): string {
  return `${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
}

/** `d MMM yyyy, HH:mm` (local). */
export function dMonthYearHm(d: Date): string {
  return `${dMonthYear(d)}, ${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
}

/** `d MMM yyyy, HH:mm:ss` (local). */
export function dMonthYearHms(d: Date): string {
  return `${dMonthYear(d)}, ${pad2(d.getHours())}:${pad2(d.getMinutes())}:${pad2(d.getSeconds())}`;
}

/** `d MMM, HH:mm` (local) — scan detail title. */
export function dMonthHm(d: Date): string {
  return `${d.getDate()} ${MONTHS[d.getMonth()]}, ${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
}

/** `HH:mm:ss` (local). */
export function hms(d: Date): string {
  return `${pad2(d.getHours())}:${pad2(d.getMinutes())}:${pad2(d.getSeconds())}`;
}

/** `d MMM yyyy, HH:mm:ss` with English months — scan share card header. */
export function scanShareDateTime(d: Date): string {
  return `${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}, ${pad2(d.getHours())}:${pad2(
    d.getMinutes(),
  )}:${pad2(d.getSeconds())}`;
}
