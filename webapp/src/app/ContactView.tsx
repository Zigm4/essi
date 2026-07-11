import { useState } from 'react';
import { contactEmail } from '../core/constants';
import { appBuildNumber, appVersion } from '../core/version';
import { GlassCard } from '../design-system/components/GlassCard';
import { NeonButton } from '../design-system/components/NeonButton';
import { SectionHeader } from '../design-system/components/SectionHeader';
import { SubPage } from '../design-system/components/SubPage';
import { TagChip } from '../design-system/components/TagChip';
import { TransmissionHeader } from '../design-system/components/TransmissionHeader';
import { IconInfoOutline, IconMail, IconMailOutline, IconTag } from '../design-system/icons';
import styles from './ContactView.module.css';

const CATEGORIES = ['Feedback', 'Bug report', 'Support', 'Other'] as const;

const DEVICE_LABEL = 'Web';

/** Contact (/menu/contact) — mailto composer. Photo attachments are mobile-only. */
export function ContactView({ initialMessage = '' }: { initialMessage?: string }) {
  const [category, setCategory] = useState<(typeof CATEGORIES)[number]>('Feedback');
  const [message, setMessage] = useState(initialMessage);

  const appLine = `App: ESSI v${appVersion} (${appBuildNumber}) (Alpha)`;
  const canSend = message.trim().length > 0;

  const send = () => {
    const body = [
      message.trim(),
      '',
      '---',
      appLine,
      `Device: ${DEVICE_LABEL}`,
      `Category: ${category}`,
      `Sent to: ${contactEmail}`,
    ].join('\n');
    const subject = `[ESSI] ${category}`;
    window.location.href = `mailto:${contactEmail}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
  };

  return (
    <SubPage title="Contact">
      <TransmissionHeader label="ESSI · operator support" />

      <GlassCard>
        <SectionHeader title="Category" icon={<IconTag size={18} />} />
        <div className={styles.chips}>
          {CATEGORIES.map((c) => (
            <TagChip key={c} label={c} selected={c === category} onTap={() => setCategory(c)} />
          ))}
        </div>
      </GlassCard>

      <GlassCard>
        <SectionHeader title="Your message" icon={<IconMailOutline size={18} />} />
        <textarea
          className={styles.textarea}
          placeholder="Tell me what's on your mind…"
          aria-label="Your message"
          value={message}
          onChange={(e) => setMessage(e.target.value)}
        />
      </GlassCard>

      <GlassCard>
        <div className={styles.autoHeader}>
          <span className={styles.autoIcon}>
            <IconInfoOutline size={14} />
          </span>
          <span className={styles.autoLabel}>Auto-included in the email</span>
        </div>
        <div className={styles.autoLine}>{appLine}</div>
        <div className={styles.autoLine}>{`Device: ${DEVICE_LABEL}`}</div>
        <div className={`${styles.autoLine} ${styles.autoLineAccent}`}>
          {`Sent to: ${contactEmail}`}
        </div>
      </GlassCard>

      <NeonButton
        title="Open in Mail"
        icon={<IconMail size={18} />}
        enabled={canSend}
        onPressed={send}
      />
    </SubPage>
  );
}
