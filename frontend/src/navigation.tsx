import type { SidebarGroup } from '@universityrt/ui-kit';
import {
  FileText,
  Hammer,
  House,
  ListChecks,
  Mail,
  Send,
  Settings,
  Tags,
  UserCog,
  Users,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import type { Me } from './api/me';
import type { Route } from './hooks/useHashRoute';
import { t } from './i18n';

const ICON_SIZE = 18;

const USER_ROUTES: readonly Route[] = ['home', 'templates', 'editor', 'sends', 'settings'];
const ADMIN_ROUTES: readonly Route[] = ['builder', 'all-sends', 'users', 'groups', 'audiences'];
/** Редакторам нужна вся ширина окна: меню на них свёрнуто до значков. */
const FULL_WIDTH_ROUTES: readonly Route[] = ['editor', 'builder'];

const ICONS: Record<Route, LucideIcon> = {
  home: House,
  templates: FileText,
  editor: Mail,
  sends: Send,
  settings: Settings,
  builder: Hammer,
  'all-sends': ListChecks,
  users: Users,
  groups: UserCog,
  audiences: Tags,
};

function items(routes: readonly Route[]): SidebarGroup['items'] {
  return routes.map((route) => {
    const Icon = ICONS[route];
    return { id: route, label: t.nav.items[route], icon: <Icon size={ICON_SIZE} aria-hidden /> };
  });
}

/** Разделы администратора скрыты от остальных; настоящее право на них проверяет API. */
export function menuFor(role: Me['role']): SidebarGroup[] {
  const user: SidebarGroup = { items: items(USER_ROUTES) };
  if (role !== 'admin') return [user];
  return [user, { title: t.nav.adminGroup, items: items(ADMIN_ROUTES) }];
}

export function visibleRoute(route: Route, role: Me['role']): Route {
  return ADMIN_ROUTES.includes(route) && role !== 'admin' ? 'home' : route;
}

export const isFullWidth = (route: Route): boolean => FULL_WIDTH_ROUTES.includes(route);
