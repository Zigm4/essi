import { IconWarningAmber } from '../icons';
import styles from './InfoRows.module.css';

/** Row primitives composed inside InfoCards in How-it-works sheets (spec §7.9). */

export function KvRow({
  label,
  value,
  labelWidth = 110,
}: {
  label: string;
  value: string;
  labelWidth?: number;
}) {
  return (
    <div className={styles.kvRow}>
      <span className={styles.kvLabel} style={{ width: labelWidth }}>
        {label}
      </span>
      <span className={styles.kvValue}>{value}</span>
    </div>
  );
}

export function OpRow({ op, desc }: { op: string; desc: string }) {
  return (
    <div className={styles.opRow}>
      <span className={styles.opCell}>{op}</span>
      <span className={styles.opDesc}>{desc}</span>
    </div>
  );
}

export function ParamRow({ name, value, note }: { name: string; value: string; note: string }) {
  return (
    <div className={styles.paramRow}>
      <div className={styles.paramLine}>
        <span className={styles.paramName}>{name}</span>
        <span className={styles.paramValue}>{value}</span>
      </div>
      <div className={styles.paramNote}>{note}</div>
    </div>
  );
}

export function QuirkRow({ title, detail }: { title: string; detail: string }) {
  return (
    <div className={styles.quirkRow}>
      <span className={styles.quirkIcon}>
        <IconWarningAmber size={14} />
      </span>
      <span>
        <span className={styles.quirkTitle} style={{ display: 'block' }}>
          {title}
        </span>
        <span className={styles.quirkDetail} style={{ display: 'block' }}>
          {detail}
        </span>
      </span>
    </div>
  );
}

export function StatusRow({ icon, title, rule }: { icon: string; title: string; rule: string }) {
  return (
    <div className={styles.statusRow}>
      <span className={styles.statusIcon}>{icon}</span>
      <span>
        <span className={styles.statusTitle} style={{ display: 'block' }}>
          {title}
        </span>
        <span className={styles.statusRule} style={{ display: 'block' }}>
          {rule}
        </span>
      </span>
    </div>
  );
}

export function StepRow({ number, title, body }: { number: string; title: string; body: string }) {
  return (
    <div className={styles.stepRow}>
      <span className={styles.stepNumber}>{number}</span>
      <span>
        <span className={styles.stepTitle} style={{ display: 'block' }}>
          {title}
        </span>
        <span className={styles.stepBody} style={{ display: 'block' }}>
          {body}
        </span>
      </span>
    </div>
  );
}

export function TierRow({ tier, title, body }: { tier: string; title: string; body: string }) {
  return (
    <div className={styles.tierRow}>
      <span className={styles.tierBadge}>{tier}</span>
      <span>
        <span className={styles.tierTitle} style={{ display: 'block' }}>
          {title}
        </span>
        <span className={styles.tierBody} style={{ display: 'block' }}>
          {body}
        </span>
      </span>
    </div>
  );
}

export function WindowRow({
  planet,
  broad,
  refine,
}: {
  planet: string;
  broad: string;
  refine: string;
}) {
  return (
    <div className={styles.windowRow}>
      <div className={styles.windowPlanet}>{planet}</div>
      <div className={styles.windowColumns}>
        <div className={styles.windowColumn}>
          <div className={styles.windowMicroLabel}>Coarse</div>
          <div className={styles.windowValue}>{broad}</div>
        </div>
        <div className={styles.windowColumn}>
          <div className={styles.windowMicroLabel}>Refine</div>
          <div className={styles.windowValue}>{refine}</div>
        </div>
      </div>
    </div>
  );
}
