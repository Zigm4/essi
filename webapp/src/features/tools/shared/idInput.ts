/**
 * Cleans typed or pasted text down to a numeric ID of at most `length` digits.
 * Clean first, then limit: a native maxLength would cut "#195 016 321" or
 * "FOE #3241501042" before the separators are stripped. When the text holds
 * more digits than one ID (a label such as "ID 2:", a time stamp), a standalone
 * run of exactly `length` digits wins over the first `length` digits.
 */
export function cleanIdInput(raw: string, length: number): string {
  const digits = raw.replace(/\D/g, '');
  if (digits.length <= length) return digits;
  // No lookbehind: older Safari versions reject it.
  const standalone = new RegExp(`(?:^|\\D)(\\d{${length}})(?!\\d)`).exec(raw);
  return standalone?.[1] ?? digits.slice(0, length);
}
