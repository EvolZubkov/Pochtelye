import {
  AppShell,
  AppShellBrand,
  AppShellPageHead,
  AppShellUser,
  Banner,
  Card,
  CardBody,
  Spinner,
  Tabs,
} from '@universityrt/ui-kit';
import { ApiError } from './api/client';
import type { Me } from './api/me';
import { ActivationForm } from './components/ActivationForm';
import { AdminPanel } from './components/admin/AdminPanel';
import { EditorFrame } from './components/EditorFrame';
import { TemplatesList } from './components/TemplatesList';
import { useReload } from './hooks/useAsync';
import { useHashRoute } from './hooks/useHashRoute';
import type { Route } from './hooks/useHashRoute';
import { useMe } from './hooks/useMe';
import { errorMessage, t } from './i18n';

const NOT_ACTIVATED = 'not_activated';
const ADMIN_ROUTES: readonly Route[] = ['builder', 'admin'];

const NAV_LABELS: Record<Route, string> = {
  home: t.nav.home,
  editor: t.nav.editor,
  builder: t.nav.builder,
  admin: t.nav.admin,
};

/** Конструктор и админ-панель видны администратору; право на них проверяет API. */
function navFor(role: Me['role']): { id: Route; label: string }[] {
  const routes: Route[] = role === 'admin' ? ['home', 'editor', 'builder', 'admin'] : ['home', 'editor'];
  return routes.map((id) => ({ id, label: NAV_LABELS[id] }));
}

function visibleRoute(route: Route, role: Me['role']): Route {
  return ADMIN_ROUTES.includes(route) && role !== 'admin' ? 'home' : route;
}

export function App() {
  const [version, reload] = useReload();
  const state = useMe(version);
  const [route, navigate] = useHashRoute();
  const user = state.status === 'ready' ? state.data : null;
  const needsActivation =
    state.status === 'error' && state.error instanceof ApiError && state.error.code === NOT_ACTIVATED;

  return (
    <AppShell
      header={
        <>
          <AppShellBrand>{t.appName}</AppShellBrand>
          {user && (
            <AppShellUser name={user.displayName ?? user.email ?? t.home.unnamed} role={t.roles[user.role]} />
          )}
        </>
      }
    >
      {state.status === 'loading' && <Spinner aria-label={t.common.loading} />}
      {needsActivation && <ActivationForm onActivated={reload} />}
      {state.status === 'error' && !needsActivation && (
        <Banner tone="error" title={errorMessage(state.error)} />
      )}
      {user && <Workspace user={user} route={visibleRoute(route, user.role)} onNavigate={navigate} />}
    </AppShell>
  );
}

interface WorkspaceProps {
  user: Me;
  route: Route;
  onNavigate: (route: Route) => void;
}

function Workspace({ user, route, onNavigate }: WorkspaceProps) {
  return (
    <>
      <Tabs
        items={navFor(user.role)}
        value={route}
        onChange={onNavigate}
        hidePanel
        listAriaLabel={t.nav.label}
      />
      {route === 'home' && <Home user={user} />}
      {(route === 'editor' || route === 'builder') && <EditorFrame mode={route} />}
      {route === 'admin' && <AdminPanel />}
    </>
  );
}

function Home({ user }: { user: Me }) {
  return (
    <>
      <AppShellPageHead title={t.home.title} />
      <Card>
        <CardBody>
          <p>
            {t.home.greeting}: {user.displayName ?? user.email ?? user.sub}
          </p>
          <p>
            {t.home.role}: {t.roles[user.role]}
          </p>
        </CardBody>
      </Card>
      <TemplatesList />
    </>
  );
}
