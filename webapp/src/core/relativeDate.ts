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

function dayMonthYear(date: Date): string {
  return `${date.getDate()} ${MONTHS[date.getMonth()]} ${date.getFullYear()}`;
}

/** Mirrors lib/core/relative_date.dart (app-shell spec §13.7). */
export function formatRelativeDate(date: Date, now: Date = new Date()): string {
  const diffMs = now.getTime() - date.getTime();
  if (diffMs < 0) {
    // Future date → full local date-time, e.g. '5 Jul 2026, 14:30'.
    return `${dayMonthYear(date)}, ${pad2(date.getHours())}:${pad2(date.getMinutes())}`;
  }
  const minutes = Math.floor(diffMs / 60_000);
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  if (days < 30) return `${Math.floor(days / 7)}w ago`;
  if (days < 365) return `${Math.floor(days / 30)} mo ago`;
  return dayMonthYear(date);
}
