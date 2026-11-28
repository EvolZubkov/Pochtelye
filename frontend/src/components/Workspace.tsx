import { EmptyState } from '@universityrt/ui-kit';
import type { ReactNode } from 'react';
import type { Me } from '../api/me';
import type { Route } from '../hooks/useHashRoute';
import { t } from '../i18n';
import { AudiencesPanel } from './admin/AudiencesPanel';
import { GroupsPanel } from './admin/GroupsPanel';
import { SendLogPanel } from './admin/SendLogPanel';
import { UsersPanel } from './admin/UsersPanel';
import { EditorFrame } from './EditorFrame';
import { Home } from './Home';
import { Page } from './Page';
import { TemplatesList } from './TemplatesList';

interface WorkspaceProps {
  user: Me;
  route: Route;
}

type PageRoute = Exclude<Route, 'editor' | 'builder'>;

const soon = () => <EmptyState title={t.soon.title} description={t.soon.hint} />;

const PAGES: Record<PageRoute, (user: Me) => ReactNode> = {
  home: (user) => <Home user={user} />,
  templates: () => <TemplatesList />,
  sends: soon,
  settings: soon,
  'all-sends': () => <SendLogPanel />,
  users: () => <UsersPanel />,
  groups: () => <GroupsPanel />,
  audiences: () => <AudiencesPanel />,
};

/** Содержимое выбранного раздела. Редакторы занимают всю область без заголовка. */
export function Workspace({ user, route }: WorkspaceProps) {
  if (route === 'editor' || route === 'builder') return <EditorFrame key={route} mode={route} />;
  return <Page title={t.nav.items[route]}>{PAGES[route](user)}</Page>;
}
