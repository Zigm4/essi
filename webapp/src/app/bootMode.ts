import { safeGetItem } from '../core/safeStorage';
import { SETTINGS_KEYS } from '../data/settings';

export type BootMode = 'full' | 'fast';

/**
 * Which boot a launch plays. The full typewriter intro welcomes a first launch
 * (onboarding not seen yet); later launches are fast. An explicit Fast boot
 * choice from Settings always wins, so turning it off brings the intro back.
 */
export function bootMode({
  fastBootChoice,
  onboardingSeen,
}: {
  /** The stored Settings › Fast boot value, null while never set. */
  fastBootChoice: boolean | null;
  onboardingSeen: boolean;
}): BootMode {
  if (fastBootChoice !== null) return fastBootChoice ? 'fast' : 'full';
  return onboardingSeen ? 'fast' : 'full';
}

/**
 * The stored Fast boot value, or null when it was never written. The settings
 * store reads a missing key as `false`, which can't tell "never set" from "off".
 */
export function storedFastBootChoice(): boolean | null {
  const raw = safeGetItem(`underdeck.${SETTINGS_KEYS.fastBoot}`);
  return raw === null ? null : raw === 'true';
}
