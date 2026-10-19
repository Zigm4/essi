// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { cleanIdInput } from './idInput';

describe('cleanIdInput', () => {
  it('keeps every digit of a formatted asteroid ID (9 digits)', () => {
    expect(cleanIdInput('ID: 195016321', 9)).toBe('195016321');
    expect(cleanIdInput('195 016 321', 9)).toBe('195016321');
    expect(cleanIdInput('195-016-321', 9)).toBe('195016321');
    expect(cleanIdInput('#195016321', 9)).toBe('195016321');
    expect(cleanIdInput(' 195016321 ', 9)).toBe('195016321');
  });

  it('keeps every digit of a formatted FOE ID (10 digits)', () => {
    expect(cleanIdInput('FOE #3241501042', 10)).toBe('3241501042');
    expect(cleanIdInput('3241 501 042', 10)).toBe('3241501042');
    expect(cleanIdInput('#3241501042', 10)).toBe('3241501042');
  });

  it('passes partial input through while typing', () => {
    expect(cleanIdInput('', 9)).toBe('');
    expect(cleanIdInput('1950', 9)).toBe('1950');
    expect(cleanIdInput('19a5', 9)).toBe('195');
  });

  it('limits to the ID length once the separators are gone', () => {
    // An extra keystroke on a full field is dropped, like a maxLength would.
    expect(cleanIdInput('1950163214', 9)).toBe('195016321');
    expect(cleanIdInput('195 016 321 7', 9)).toBe('195016321');
  });

  it('prefers a standalone ID over leading digits from a label', () => {
    expect(cleanIdInput('ID 2: 195016321', 9)).toBe('195016321');
    expect(cleanIdInput('Asteroid 195016321 at 12:30', 9)).toBe('195016321');
    expect(cleanIdInput('FOE 7 - 3241501042', 10)).toBe('3241501042');
  });
});
