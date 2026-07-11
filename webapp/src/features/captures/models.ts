import type { LinkRow, NoteRow, TagRow } from '../../data/db';

/**
 * Domain models for the Captures feature (spec §19.1). Rows in Dexie store
 * timestamps as epoch-ms numbers; the models expose them as `Date`. `tags`
 * ordering follows the join-table read order.
 */

export interface TagModel {
  id: string;
  /** As typed by the user (first spelling wins — spec §18.1). */
  displayName: string;
  /** Lowercase dedupe key (unique). */
  name: string;
  /** Nullable; currently never written by the UI (spec §25.3). */
  colorHex: string | null;
}

export interface NoteModel {
  id: string;
  title: string;
  body: string;
  createdAt: Date;
  updatedAt: Date;
  tags: TagModel[];
}

export interface LinkModel {
  id: string;
  title: string;
  url: string;
  note: string;
  createdAt: Date;
  updatedAt: Date;
  tags: TagModel[];
}

export function toTagModel(row: TagRow): TagModel {
  return {
    id: row.id,
    displayName: row.displayName,
    name: row.name,
    colorHex: row.colorHex,
  };
}

export function toNoteModel(row: NoteRow, tags: TagModel[]): NoteModel {
  return {
    id: row.id,
    title: row.title,
    body: row.body,
    createdAt: new Date(row.createdAt),
    updatedAt: new Date(row.updatedAt),
    tags,
  };
}

export function toLinkModel(row: LinkRow, tags: TagModel[]): LinkModel {
  return {
    id: row.id,
    title: row.title,
    url: row.url,
    note: row.note,
    createdAt: new Date(row.createdAt),
    updatedAt: new Date(row.updatedAt),
    tags,
  };
}
