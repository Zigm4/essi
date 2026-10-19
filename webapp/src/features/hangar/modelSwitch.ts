import { hasPrefix, type ShipCatalogEntry } from './catalog';
import { composedName, extractSuffix } from './shipModel';

/** The editor inputs that make up a ship's name. */
export interface NameFields {
  modelKey: string | null;
  nameField: string;
  suffixField: string;
}

/**
 * Name inputs after picking `newKey` in the model picker (spec §6.5, amended):
 * the call-sign number survives every switch.
 * - prefixed → prefixed: the suffix is kept as typed (MMCS-42 → SOLT-42).
 * - free name → prefixed: the suffix comes from the name, minus the new prefix
 *   or any catalog prefix it starts with ("MMCS-42" → SOLT-42).
 * - prefixed → no prefix: the name becomes the call sign on screen (MMCS-43),
 *   never the stale name the ship was opened with.
 * - free name → no prefix: unchanged.
 */
export function namesAfterModelSwitch(
  fields: NameFields,
  newKey: string | null,
  modelByKey: Map<string, ShipCatalogEntry>,
): { nameField: string; suffixField: string } {
  const oldEntry = fields.modelKey != null ? modelByKey.get(fields.modelKey) : undefined;
  const newEntry = newKey != null ? modelByKey.get(newKey) : undefined;

  if (newEntry != null && hasPrefix(newEntry)) {
    if (hasPrefix(oldEntry)) return { nameField: fields.nameField, suffixField: fields.suffixField };
    return {
      nameField: fields.nameField,
      suffixField: suffixFromName(fields.nameField.trim(), newEntry.prefix ?? '', modelByKey),
    };
  }

  if (hasPrefix(oldEntry)) return { nameField: composedName(fields, modelByKey), suffixField: '' };
  return { nameField: fields.nameField, suffixField: '' };
}

/** A free name's call-sign number: strips the new prefix, else any catalog "PREFIX-". */
function suffixFromName(
  name: string,
  newPrefix: string,
  modelByKey: Map<string, ShipCatalogEntry>,
): string {
  const own = extractSuffix(name, newPrefix);
  if (own !== name) return own;
  const upper = name.toUpperCase();
  for (const entry of modelByKey.values()) {
    if (!hasPrefix(entry)) continue;
    const tag = `${(entry.prefix ?? '').toUpperCase()}-`;
    if (upper.startsWith(tag)) return name.slice(tag.length);
  }
  return name;
}
