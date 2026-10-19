import { Component, type ErrorInfo, type ReactNode } from 'react';
import { logError } from '../core/logging';
import { NeonButton } from '../design-system/components/NeonButton';
import { IconWarningAmber } from '../design-system/icons';
import styles from './ErrorBoundary.module.css';

interface Props {
  children: ReactNode;
  /** Root variant: nothing else renders, so it fills the screen and reloads to recover. */
  fullScreen?: boolean;
}

interface State {
  failed: boolean;
}

/**
 * Catches a render error so a single broken screen shows a recovery card
 * instead of blanking the whole app. Wrapped around the app (fullScreen) and
 * around the routed screen inside the shell (keyed by path, so navigating away
 * - e.g. with the tab bar - resets it).
 */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { failed: false };

  static getDerivedStateFromError(): State {
    return { failed: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    logError(error, info.componentStack ?? undefined);
  }

  render(): ReactNode {
    if (!this.state.failed) return this.props.children;
    const { fullScreen = false } = this.props;
    const goToTools = () => {
      window.location.hash = '#/tools';
      if (fullScreen) window.location.reload();
      else this.setState({ failed: false });
    };
    return (
      <div className={`${styles.wrap} ${fullScreen ? styles.fullScreen : ''}`} role="alert">
        <span className={styles.icon}>
          <IconWarningAmber size={40} />
        </span>
        <div className={styles.title}>Something went wrong on this screen.</div>
        <div className={styles.caption}>
          Your notes, ships and progress are safe. Reload, or go back to Tools. You can export your
          data from Menu › Settings.
        </div>
        <NeonButton className={styles.button} title="Reload" onPressed={() => window.location.reload()} />
        <button type="button" className={styles.secondary} onClick={goToTools}>
          Back to Tools
        </button>
      </div>
    );
  }
}
