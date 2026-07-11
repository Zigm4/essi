import type { ReactNode } from 'react';
import { BannerPage } from '../../design-system/components/BannerPage';
import { PageScrollView } from '../../design-system/components/PageScrollView';
import { SubPage } from '../../design-system/components/SubPage';
import { ModulePending } from './ModulePending';

/** Placeholder sub-route page: app chrome + MODULE PENDING card. */
export function PendingSubPage({ title }: { title: string }) {
  return (
    <SubPage title={title}>
      <ModulePending />
    </SubPage>
  );
}

/** Placeholder main-tab page: ESSI banner + MODULE PENDING card. */
export function PendingTabPage({
  bannerLabel,
  bannerActions,
}: {
  bannerLabel: string;
  bannerActions?: ReactNode;
}) {
  return (
    <BannerPage bannerLabel={bannerLabel} bannerActions={bannerActions}>
      <PageScrollView padding="12px 12px 32px">
        <ModulePending />
      </PageScrollView>
    </BannerPage>
  );
}
