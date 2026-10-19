import { useEffect, useState, type ReactNode } from 'react';
import { Haptics } from '../../../core/haptics';
import { logError } from '../../../core/logging';
import { IconDownload, IconForum } from '../../../design-system/icons';
import { IconLink, IconShare } from '../nasa/ui/toolIcons';
import { BottomSheet } from './BottomSheet';
import { canShareImageFile, copyText, downloadBlob, shareImage, type ShareContent } from './shareActions';
import { renderCardPng } from './shareCard';
import styles from './ShareSheet.module.css';

type ImageState = { status: 'rendering' } | { status: 'ready'; blob: Blob; url: string } | { status: 'error' };

/** The "Share" sheet: a preview of the card and the three ways to share it. */
export function ShareSheet({ content, onClose }: { content: ShareContent | null; onClose: () => void }) {
  return (
    <BottomSheet open={content !== null} onClose={onClose} heightFraction={0.9} radius={22} ariaLabel="Share">
      {content !== null && <ShareSheetBody content={content} onDone={onClose} />}
    </BottomSheet>
  );
}

function ShareSheetBody({ content, onDone }: { content: ShareContent; onDone: () => void }) {
  const [image, setImage] = useState<ImageState>({ status: 'rendering' });
  const nativeShare = canShareImageFile();

  // Draw the card as soon as the sheet opens, so "Share image" can hand the
  // file over within the tap (browsers require a fresh user gesture).
  useEffect(() => {
    let alive = true;
    let url: string | null = null;
    renderCardPng(content.card)
      .then((blob) => {
        if (!alive) return;
        url = URL.createObjectURL(blob);
        setImage({ status: 'ready', blob, url });
      })
      .catch((e: unknown) => {
        logError(e);
        if (alive) setImage({ status: 'error' });
      });
    return () => {
      alive = false;
      if (url !== null) URL.revokeObjectURL(url);
    };
  }, [content]);

  const copyDiscord = async () => {
    Haptics.tap();
    if (await copyText(content.discordText, 'Discord message copied - paste it in a channel.')) onDone();
  };
  const copyLink = async () => {
    Haptics.tap();
    if (await copyText(content.link, 'Link copied.')) onDone();
  };
  const sendImage = () => {
    if (image.status !== 'ready') return;
    Haptics.tap();
    void shareImage(image.blob, content.fileName, content.title, content.caption).then(onDone);
  };
  const download = () => {
    if (image.status !== 'ready') return;
    downloadBlob(image.blob, content.fileName);
    onDone();
  };

  return (
    <div className={styles.stack}>
      <div className={styles.title}>Share</div>

      <div className={styles.preview}>
        {image.status === 'ready' && <img className={styles.previewImg} src={image.url} alt="Share card preview" />}
        {image.status === 'rendering' && <span className={styles.previewNote}>Drawing the card…</span>}
        {image.status === 'error' && (
          <span className={styles.previewNote}>Couldn&apos;t create the share image - the message and link still work.</span>
        )}
      </div>

      <ShareRow
        icon={<IconForum size={20} />}
        title="Copy Discord message"
        caption="Formatted text with the link, ready to paste in a channel."
        onClick={() => void copyDiscord()}
      />
      <ShareRow
        icon={<IconShare size={20} />}
        title={nativeShare ? 'Share image' : 'Copy image'}
        caption={
          nativeShare
            ? 'Send the card to Discord or any app.'
            : 'Copies the card - paste it in Discord.'
        }
        disabled={image.status !== 'ready'}
        onClick={sendImage}
      />
      <ShareRow
        icon={<IconLink size={20} />}
        title="Copy link"
        caption="Opens this result in ESSI."
        onClick={() => void copyLink()}
      />

      <button type="button" className={styles.download} disabled={image.status !== 'ready'} onClick={download}>
        <IconDownload size={16} />
        Download image
      </button>
    </div>
  );
}

function ShareRow({
  icon,
  title,
  caption,
  disabled = false,
  onClick,
}: {
  icon: ReactNode;
  title: string;
  caption: string;
  disabled?: boolean;
  onClick: () => void;
}) {
  return (
    <button type="button" className={styles.row} disabled={disabled} onClick={onClick}>
      <span className={styles.rowIcon}>{icon}</span>
      <span className={styles.rowText}>
        <span className={styles.rowTitle}>{title}</span>
        <span className={styles.rowCaption}>{caption}</span>
      </span>
    </button>
  );
}
