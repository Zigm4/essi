import type { ReactNode } from 'react';
import { InfoCard } from '../../../../../design-system/components/InfoCard';
import { SectionHeader } from '../../../../../design-system/components/SectionHeader';
import { TransmissionHeader } from '../../../../../design-system/components/TransmissionHeader';

/** Shared primitives for the three "How it works" sheets (spec §10). */

export function HiwHeader() {
  return <TransmissionHeader label="ESSI · how this tool works" />;
}

export function HiwCard({
  icon,
  title,
  children,
}: {
  icon: ReactNode;
  title: string;
  children: ReactNode;
}) {
  return (
    <InfoCard>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <SectionHeader title={title} icon={icon} />
        {children}
      </div>
    </InfoCard>
  );
}

/** Explanatory paragraph (the `>` prose in the spec). */
export function P({ children }: { children: ReactNode }) {
  return (
    <p
      style={{
        margin: 0,
        fontFamily: 'var(--font-sans)',
        fontSize: 13,
        lineHeight: 1.55,
        color: 'var(--text-secondary)',
      }}
    >
      {children}
    </p>
  );
}

/** A body-styled lead line (e.g. "Distance in SL" before a CodeBlock). */
export function Lead({ children }: { children: ReactNode }) {
  return (
    <div style={{ fontFamily: 'var(--font-sans)', fontSize: 15, color: 'var(--text-primary)' }}>
      {children}
    </div>
  );
}

/** A caption line (e.g. "Mercury, position right now:"). */
export function Cap({ children }: { children: ReactNode }) {
  return (
    <div
      style={{
        fontFamily: 'var(--font-sans)',
        fontSize: 12,
        fontWeight: 500,
        color: 'var(--text-secondary)',
      }}
    >
      {children}
    </div>
  );
}
