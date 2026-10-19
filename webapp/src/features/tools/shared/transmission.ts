import { discordMaskedLink } from './shareActions';

/**
 * The Discord message shared by ESSI tools, written as a short transmission:
 * a heading and a division line, a one-line intro, the data as a list, the
 * link and a sign-off. Light role-play that keeps the numbers first.
 */

/** The NASA tools sign off from the science side of ESSI. */
export const SCIENCE_SIGN_OFF = 'Scientific Directorate, East Shire Space Industries (ESSI)';

export interface Transmission {
  /** e.g. "📡 ESSI · Priority transmission" (a Discord ### heading). */
  header: string;
  /** Small text under the header, e.g. "Astrometry & Deep Space Surveillance Division". */
  division: string;
  intro: string;
  /** The data: a bold title line, then "- " list lines. */
  body: string[];
  /** Lines after the data (advice, legend). */
  after?: string[];
  linkLabel: string;
  link: string;
  /** Who signs the transmission (default: the Scientific Directorate). */
  signOff?: string;
}

export function transmission(t: Transmission): string {
  return [
    `### ${t.header}`,
    `-# ${t.division}`,
    '',
    t.intro,
    '',
    ...t.body,
    '',
    ...(t.after ?? []),
    `🔗 ${discordMaskedLink(t.linkLabel, t.link)}`,
    '',
    `-# End of transmission · ${t.signOff ?? SCIENCE_SIGN_OFF}`,
  ].join('\n');
}
