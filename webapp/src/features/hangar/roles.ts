import type { ShipRow } from '../../data/db';

/**
 * The 12 crew seats (spec §9.1). Array order IS the seat order — every place
 * that iterates roles (list card, editor crew card, `availableRoles`) uses it.
 */
export const SHIP_RIGHTS = [
  'pilot',
  'gunner',
  'cartographer',
  'prospector',
  'signaller',
  'technician',
  'sentry',
  'fabricator',
  'medic',
  'quartermaster',
  'chef',
  'alchemist',
] as const;

export type ShipRight = (typeof SHIP_RIGHTS)[number];

/** Capitalized English display names (spec §9.1 / §16). */
export const ROLE_DISPLAY: Record<ShipRight, string> = {
  pilot: 'Pilot',
  gunner: 'Gunner',
  cartographer: 'Cartographer',
  prospector: 'Prospector',
  signaller: 'Signaller',
  technician: 'Technician',
  sentry: 'Sentry',
  fabricator: 'Fabricator',
  medic: 'Medic',
  quartermaster: 'Quartermaster',
  chef: 'Chef',
  alchemist: 'Alchemist',
};

/** Maps each seat to its `ShipRow` name column (spec §11.1). */
export const ROLE_COLUMN: Record<ShipRight, keyof ShipRow> = {
  pilot: 'pilotName',
  gunner: 'gunnerName',
  cartographer: 'cartographerName',
  prospector: 'prospectorName',
  signaller: 'signallerName',
  technician: 'technicianName',
  sentry: 'sentryName',
  fabricator: 'fabricatorName',
  medic: 'medicName',
  quartermaster: 'quartermasterName',
  chef: 'chefName',
  alchemist: 'alchemistName',
};

/** Role input placeholder, e.g. `Pilot's name` (spec §6.3 / §16). */
export function roleHint(right: ShipRight): string {
  return `${ROLE_DISPLAY[right]}'s name`;
}
