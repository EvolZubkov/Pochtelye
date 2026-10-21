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
import type { Me } from './api/me';
import { EditorFrame } from './components/EditorFrame';
import { TemplatesList } from './components/TemplatesList';
import { useHashRoute } from './hooks/useHashRoute';
import type { Route } from './hooks/useHashRoute';
import { useMe } from './hooks/useMe';
import { errorMessage, t } from './i18n';

const BASE_NAV: { id: Route; label: string }[] = [
  { id: 'home', label: t.nav.home },
  { id: 'editor', label: t.nav.editor },
];
const BUILDER_NAV = { id: 'builder' as Route, label: t.nav.builder };

/** Конструктор доступен администратору; прочие роли получают только «Письма». */
function navFor(role: Me['role']) {
  return role === 'admin' ? [...BASE_NAV, BUILDER_NAV] : BASE_NAV;
}

function visibleRoute(route: Route, role: Me['role']): Route {
  return route === 'builder' && role !== 'admin' ? 'home' : route;
}

export function App() {
  const state = useMe();
  const [route, navigate] = useHashRoute();
  const user = state.status === 'ready' ? state.data : null;
  const activeRoute = user ? visibleRoute(route, user.role) : route;

  return (
    <AppShell
      header={
        <>
          <AppShellBrand>{t.appName}</AppShellBrand>
          {user && (
            <AppShellUser name={user.displayName ?? t.home.unnamed} role={t.roles[user.role]} />
          )}
        </>
      }
    >
      {state.status === 'loading' && <Spinner aria-label={t.common.loading} />}
      {state.status === 'error' && <Banner tone="error" title={errorMessage(state.error)} />}
      {user && (
        <>
          <Tabs
            items={navFor(user.role)}
            value={activeRoute}
            onChange={navigate}
            hidePanel
            listAriaLabel={t.nav.label}
          />
          {activeRoute === 'home' ? <Home user={user} /> : <EditorFrame mode={activeRoute} />}
        </>
      )}
    </AppShell>
  );
}

function Home({ user }: { user: Me }) {
  return (
    <>
      <AppShellPageHead title={t.home.title} />
      <Card>
        <CardBody>
          <p>
            {t.home.greeting}: {user.displayName ?? user.sub}
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
