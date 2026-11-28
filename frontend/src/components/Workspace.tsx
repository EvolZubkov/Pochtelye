import { EmptyState } from '@universityrt/ui-kit';
import type { ReactNode } from 'react';
import type { Me } from '../api/me';
import type { TemplateSummary } from '../api/templates';
import type { Route } from '../hooks/useHashRoute';
import { t } from '../i18n';
import { AudiencesPanel } from './admin/AudiencesPanel';
import { GroupsPanel } from './admin/GroupsPanel';
import { SendLogPanel } from './admin/SendLogPanel';
import { UsersPanel } from './admin/UsersPanel';
import { EditorFrame } from './EditorFrame';
import { Home } from './Home';
import { Page } from './Page';
import { Templates } from './Templates';

interface WorkspaceProps {
  user: Me;
  route: Route;
  params: string;
  onNavigate: (route: Route, params?: string) => void;
}

type PageRoute = Exclude<Route, 'editor' | 'builder'>;

const soon = () => <EmptyState title={t.soon.title} description={t.soon.hint} />;

type PageContext = Pick<WorkspaceProps, 'user' | 'onNavigate'> & {
  onOpen: (template: TemplateSummary) => void;
};

const PAGES: Record<PageRoute, (context: PageContext) => ReactNode> = {
  home: (context) => <Home {...context} />,
  templates: ({ onOpen }) => <Templates onOpen={onOpen} />,
  sends: soon,
  settings: soon,
  'all-sends': () => <SendLogPanel />,
  users: () => <UsersPanel />,
  groups: () => <GroupsPanel />,
  audiences: () => <AudiencesPanel />,
};

/** Содержимое выбранного раздела. Редакторы занимают всю область без заголовка. */
export function Workspace({ user, route, params, onNavigate }: WorkspaceProps) {
  if (route === 'editor' || route === 'builder') {
    return <EditorFrame key={`${route}?${params}`} mode={route} params={params} />;
  }
  const onOpen = ({ id, scope }: TemplateSummary) =>
    onNavigate('editor', new URLSearchParams({ template: id, type: scope }).toString());
  return <Page title={t.nav.items[route]}>{PAGES[route]({ user, onNavigate, onOpen })}</Page>;
}
