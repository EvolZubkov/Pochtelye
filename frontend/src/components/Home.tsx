import {
  Banner,
  Button,
  Card,
  CardBody,
  Cluster,
  EmptyState,
  Heading,
  Skeleton,
  Stack,
} from '@universityrt/ui-kit';
import type { Me } from '../api/me';
import { fetchTemplates } from '../api/templates';
import type { TemplateSummary } from '../api/templates';
import { useAsync } from '../hooks/useAsync';
import type { Route } from '../hooks/useHashRoute';
import { errorMessage, t } from '../i18n';
import { TemplateGrid } from './TemplateGrid';

const RECENT_COUNT = 4;

interface HomeProps {
  user: Me;
  onOpen: (template: TemplateSummary) => void;
  onNavigate: (route: Route) => void;
}

export function Home({ user, onOpen, onNavigate }: HomeProps) {
  return (
    <Stack gap={5}>
      <Card>
        <CardBody>
          <p>
            {t.home.greeting}: {user.displayName ?? user.email ?? user.sub}
          </p>
          <p>
            {t.home.role}: {t.roles[user.role]}
          </p>
          <Cluster gap={3}>
            <Button onClick={() => onNavigate('templates')}>{t.home.chooseTemplate}</Button>
            {user.role === 'admin' && (
              <Button variant="secondary" onClick={() => onNavigate('builder')}>
                {t.home.newTemplate}
              </Button>
            )}
          </Cluster>
        </CardBody>
      </Card>
      <Heading level={2}>{t.home.recent}</Heading>
      <RecentTemplates onOpen={onOpen} />
    </Stack>
  );
}

function RecentTemplates({ onOpen }: Pick<HomeProps, 'onOpen'>) {
  const state = useAsync(fetchTemplates);

  if (state.status === 'loading') return <Skeleton aria-label={t.common.loading} />;
  if (state.status === 'error') return <Banner tone="error" title={errorMessage(state.error)} />;
  if (state.data.items.length === 0) {
    return <EmptyState title={t.templates.emptyTitle} description={t.templates.emptyHint} />;
  }
  const recent = [...state.data.items]
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
    .slice(0, RECENT_COUNT);
  return <TemplateGrid items={recent} onOpen={onOpen} />;
}
