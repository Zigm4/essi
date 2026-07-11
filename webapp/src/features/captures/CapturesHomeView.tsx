import { BannerAction } from '../../design-system/components/TransmissionHeader';
import { IconAdd } from '../../design-system/icons';
import { Haptics } from '../../core/haptics';
import { PendingTabPage } from '../common/PendingPages';

/** /captures — notes & links home (Notes tab). */
export function CapturesHomeView() {
  return (
    <PendingTabPage
      bannerLabel="ESSI · Capture Log"
      bannerActions={
        <BannerAction label="New capture" onTap={() => Haptics.tap()}>
          <IconAdd size={20} />
        </BannerAction>
      }
    />
  );
}
