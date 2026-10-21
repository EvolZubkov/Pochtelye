import { Banner, Card, CardBody, CardHeader, EmptyState, Grid, Skeleton, Tag } from '@universityrt/ui-kit';
import { fetchTemplates } from '../api/templates';
import { useAsync } from '../hooks/useAsync';
import { errorMessage, t } from '../i18n';

export function TemplatesList() {
  const state = useAsync(fetchTemplates);

  if (state.status === 'loading') return <Skeleton aria-label={t.common.loading} />;
  if (state.status === 'error') return <Banner tone="error" title={errorMessage(state.error)} />;

  const { items } = state.data;
  if (items.length === 0) {
    return <EmptyState title={t.templates.emptyTitle} description={t.templates.emptyHint} />;
  }

  return (
    <Grid minItem="md" gap={4} aria-label={t.templates.title}>
      {items.map((template) => (
        <Card key={template.id}>
          <CardHeader
            title={template.name}
            subtitle={template.category || undefined}
            trail={<Tag>{t.templates.scope[template.scope]}</Tag>}
          />
          <CardBody>
            {template.preview ? (
              <img src={template.preview} alt={template.name} width="100%" />
            ) : null}
          </CardBody>
        </Card>
      ))}
    </Grid>
  );
}
