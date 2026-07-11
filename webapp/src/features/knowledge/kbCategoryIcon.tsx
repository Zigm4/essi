import type { ReactNode } from 'react';
import { IconKnowledge, IconMap, IconPublic } from '../../design-system/icons';
import { IconBookmark, IconGroups, IconSettings, IconStar } from './kbIcons';

/**
 * KB Home category icon mapping (`_iconFor` in kb_home_view.dart, §3.2).
 * Maps SF-symbol-ish manifest names to the app's icon set.
 */
export function homeCategoryIcon(icon: string, size: number): ReactNode {
  switch (icon) {
    case 'map.fill':
    case 'map':
      return <IconMap size={size} />;
    case 'gearshape.fill':
    case 'gearshape':
      return <IconSettings size={size} />;
    case 'books.vertical':
    case 'book':
    case 'book.fill':
      return <IconKnowledge size={size} />;
    case 'star.fill':
      return <IconStar size={size} />;
    case 'person.3.fill':
    case 'person.3':
    case 'people':
      return <IconGroups size={size} />;
    case 'map.circle.fill':
    case 'map.circle':
    case 'public':
      return <IconPublic size={size} />;
    default:
      return <IconBookmark size={size} />;
  }
}

/**
 * KB Category view icon mapping (§4.2 quirk): a smaller `_iconFor` that only
 * knows maps / systems / books, so Guilds (`person.3.fill`) and Shires
 * (`map.circle.fill`) article rows fall back to the `bookmark` icon here even
 * though their home cards show `groups` / `public`. Reproduced as-is for parity.
 */
export function categoryRowIcon(icon: string, size: number): ReactNode {
  switch (icon) {
    case 'map.fill':
    case 'map':
      return <IconMap size={size} />;
    case 'gearshape.fill':
    case 'gearshape':
      return <IconSettings size={size} />;
    case 'books.vertical':
    case 'book':
    case 'book.fill':
      return <IconKnowledge size={size} />;
    default:
      return <IconBookmark size={size} />;
  }
}
