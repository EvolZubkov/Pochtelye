import { AppShell, AppShellBrand, AppShellPageHead, AppShellUser, Banner, Card, CardBody, Spinner } from '@universityrt/ui-kit';
import { errorMessage, t } from './i18n';
import { TemplatesList } from './components/TemplatesList';
import { useMe } from './hooks/useMe';

export function App() {
  const state = useMe();
  const user = state.status === 'ready' ? state.data : null;

  return (
    <AppShell
      header={
        <>
          <AppShellBrand>{t.appName}</AppShellBrand>
          {user && (
            <AppShellUser
              name={user.displayName ?? t.home.unnamed}
              role={t.roles[user.role]}
            />
          )}
        </>
      }
    >
      <AppShellPageHead title={t.home.title} />
      {state.status === 'loading' && <Spinner aria-label={t.common.loading} />}
      {state.status === 'error' && (
        <Banner tone="error" title={errorMessage(state.error)} />
      )}
      {user && (
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
      )}
      {user && <TemplatesList />}
    </AppShell>
  );
}
