import { useState } from 'react';
import { GlassCard } from '../design-system/components/GlassCard';
import { SectionHeader } from '../design-system/components/SectionHeader';
import { SubPage } from '../design-system/components/SubPage';
import { IconExpandLess, IconExpandMore } from '../design-system/icons';
import styles from './FAQView.module.css';

interface FaqEntry {
  q: string;
  a: string;
}

/** Exact Q/A copy (app-shell spec §10); the storage answer uses the web wording. */
const SECTIONS: { key: string; entries: FaqEntry[] }[] = [
  {
    key: 'operations',
    entries: [
      {
        q: 'Is Underdeck free?',
        a: 'Yes. Underdeck is free and will stay free, forever. No ads, no in-app purchases, no premium tier.',
      },
      {
        q: 'Is this an official UP55 app?',
        a: 'No. Underdeck is a fan project. It is not affiliated with or endorsed by Jaydz Dev (alias Lama), the creator of Underpunks55.',
      },
    ],
  },
  {
    key: 'privacy',
    entries: [
      {
        q: 'Does Underdeck collect my data?',
        a: 'No. Zero telemetry, zero analytics. The app does not communicate with any server we operate.',
      },
      {
        q: 'Where is my data stored?',
        a: 'On your device, in a local database in your browser. To move data between devices, use the export/import feature in Settings.',
      },
    ],
  },
  {
    key: 'network',
    entries: [
      {
        q: 'Does the app need internet?',
        a: 'Not for normal use. Notes, links, ships, the knowledge base, the Asteroid Analyzer, the Fishing Map, the Mars Express schedule and the Wallet Lookup all work fully offline. Three tools are opt-in and do talk to a network: System Scan, Discoveries, and Tracker. They call NASA APIs (JPL Horizons and SBDB). Nothing happens unless you tap their action button. Interactive maps are the one feature that reaches out on its own: they download map content from GitHub (see the next question). Tapping the Discord invite link in the Menu also opens the network, but only at the moment you tap it.',
      },
      {
        q: 'Where do interactive maps come from?',
        a: 'Map content (the map list, each map, and its images) is hosted on GitHub and delivered over a multi-CDN path: GitHub Pages (fronted by Fastly) for the small "which version is current" pointer, and jsDelivr — with raw.githubusercontent.com as a fallback — for the actual files. Downloads are on by default and happen at most once every 24 hours; every file is checked against a SHA-256 hash before it is stored. Nothing about you is sent — these are plain GET requests, so your IP address is visible to those CDNs, and that is all. A built-in sample map ships inside the app so maps work offline on first launch. You can turn downloads off entirely in Settings › Interactive maps, and clear anything already downloaded there too.',
      },
      {
        q: 'What does System Scan send to NASA?',
        a: 'When you tap "Scan now" in Tools / System Scan, Underdeck makes 9 GET requests to ssd.jpl.nasa.gov/api/horizons.api, one per planet. Sent: NAIF code (199-999) and current UTC timestamp. Received: public ephemeris text. Visible to NASA: your IP address. Stored: nothing on first run; entries you keep are saved locally.',
      },
      {
        q: 'What does Tracker send to NASA?',
        a: 'When you tap "Track" in Tools / Tracker, Underdeck makes 1 to 4 GET requests to JPL Horizons / SBDB. Sent: object name or designation, plus a fixed instruction. No identifier of yours is added. Stored: each successful track is saved to local history. You can delete entries any time.',
      },
    ],
  },
];

function FaqItem({ entry }: { entry: FaqEntry }) {
  const [open, setOpen] = useState(false);
  return (
    <GlassCard onTap={() => setOpen((v) => !v)}>
      <span className={styles.itemHeader}>
        <span className={styles.question}>{entry.q}</span>
        <span className={styles.expandIcon}>
          {open ? <IconExpandLess size={22} /> : <IconExpandMore size={22} />}
        </span>
      </span>
      {open && <span className={styles.answer} style={{ display: 'block' }}>{entry.a}</span>}
    </GlassCard>
  );
}

/** FAQ (/menu/faq) — items toggle independently, all start closed. */
export function FAQView() {
  return (
    <SubPage title="FAQ">
      {SECTIONS.map((section) => (
        <div key={section.key} className={styles.section}>
          <SectionHeader title={section.key} />
          {section.entries.map((entry) => (
            <FaqItem key={entry.q} entry={entry} />
          ))}
        </div>
      ))}
    </SubPage>
  );
}
