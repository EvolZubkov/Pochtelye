import {
  AppShell,
  AppShellActions,
  AppShellBrand,
  AppShellUser,
  Banner,
  Sidebar,
  Spinner,
} from '@universityrt/ui-kit';
import { useState } from 'react';
import { ApiError } from './api/client';
import { ActivationForm } from './components/ActivationForm';
import { Workspace } from './components/Workspace';
import { useReload } from './hooks/useAsync';
import { useHashRoute } from './hooks/useHashRoute';
import type { Route } from './hooks/useHashRoute';
import { useMe } from './hooks/useMe';
import { errorMessage, t } from './i18n';
import { isFullWidth, menuFor, visibleRoute } from './navigation';

const NOT_ACTIVATED = 'not_activated';

export function App() {
  const [version, reload] = useReload();
  const state = useMe(version);
  const [route, navigate] = useHashRoute();
  // Ручной выбор ширины меню действует только в том разделе, где сделан.
  const [choice, setChoice] = useState<{ route: Route; collapsed: boolean } | null>(null);
  const user = state.status === 'ready' ? state.data : null;
  const needsActivation =
    state.status === 'error' && state.error instanceof ApiError && state.error.code === NOT_ACTIVATED;

  const current = user ? visibleRoute(route, user.role) : route;
  const collapsed = choice?.route === current ? choice.collapsed : isFullWidth(current);

  const open = (id: string) => {
    setChoice(null);
    navigate(id as Route);
  };

  return (
    <AppShell
      collapsed={user !== null && collapsed}
      side={
        user && (
          <Sidebar
            aria-label={t.nav.label}
            brand={<span className="brand-text">{t.appName}</span>}
            groups={menuFor(user.role)}
            activeId={current}
            onSelect={open}
            collapsed={collapsed}
            onToggleCollapse={() => setChoice({ route: current, collapsed: !collapsed })}
          />
        )
      }
      header={
        <>
          <AppShellBrand>{t.appName}</AppShellBrand>
          {user && (
            <AppShellActions>
              <AppShellUser
                name={user.displayName ?? user.email ?? t.home.unnamed}
                role={t.roles[user.role]}
                interactive={false}
              />
            </AppShellActions>
          )}
        </>
      }
    >
      {state.status === 'loading' && <Spinner aria-label={t.common.loading} />}
      {needsActivation && <ActivationForm onActivated={reload} />}
      {state.status === 'error' && !needsActivation && (
        <Banner tone="error" title={errorMessage(state.error)} />
      )}
      {user && <Workspace user={user} route={current} />}
    </AppShell>
  );
}
