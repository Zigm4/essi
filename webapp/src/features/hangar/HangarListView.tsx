import { BannerAction } from '../../design-system/components/TransmissionHeader';
import { IconAdd } from '../../design-system/icons';
import { Haptics } from '../../core/haptics';
import { PendingTabPage } from '../common/PendingPages';

/** /hangar — ship registry (Hangar tab). */
export function HangarListView() {
  return (
    <PendingTabPage
      bannerLabel="ESSI · Hangar Bay"
      bannerActions={
        <BannerAction label="Add ship" onTap={() => Haptics.tap()}>
          <IconAdd size={20} />
        </BannerAction>
      }
    />
  );
}
