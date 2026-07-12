import { BottomSheet } from '../shared/BottomSheet';
import { IconFlag } from '../shared/toolIcons';
import styles from './Jobs.module.css';

/** "About this dataset" sheet (spec §3.8). */
export function AboutDatasetSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  return (
    <BottomSheet
      open={open}
      onClose={onClose}
      heightFraction={0.85}
      radius={20}
      ariaLabel="About this dataset"
    >
      <div className={styles.aboutStack}>
        <div className={styles.aboutHeadline}>About this dataset</div>
        <div className={styles.aboutBody}>
          The 371 jobs listed here come from an extract Lama shared directly with the project. The
          numbers, locations, factions and reward functions are passed through as-is.
        </div>
        <div className={styles.aboutCallout}>
          <div className={styles.aboutCalloutHead}>
            <span className={styles.aboutCalloutIcon}>
              <IconFlag size={16} />
            </span>
            <span className={styles.aboutCalloutTitle}>Spotted a wrong value?</span>
          </div>
          <div className={styles.aboutCaption}>
            If a job is missing, mislabelled, or has a reward that looks off (negative bonus, weird
            amount, wrong faction), send the correction through the in-app Contact form or drop it in
            the project Discord. Every fix lands in the next build.
          </div>
        </div>
        <div className={styles.aboutFooter}>
          Some fields read "amount unknown" - that means the source extract had a zero bonus for that
          job, so the actual reward count is either dynamic or simply not recorded yet.
        </div>
      </div>
    </BottomSheet>
  );
}
