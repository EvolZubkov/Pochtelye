import { Button, Card, CardBody, CardFooter, CardHeader, Grid, Tag } from '@universityrt/ui-kit';
import type { TemplateSummary } from '../api/templates';
import { t } from '../i18n';

interface TemplateGridProps {
  items: TemplateSummary[];
  onOpen: (template: TemplateSummary) => void;
}

export function TemplateGrid({ items, onOpen }: TemplateGridProps) {
  return (
    <Grid minItem="sm" gap={4} aria-label={t.templates.title}>
      {items.map((template) => (
        <Card key={template.id}>
          <CardHeader
            title={template.name}
            subtitle={template.category || t.templates.uncategorized}
            trail={<Tag>{t.templates.scope[template.scope]}</Tag>}
          />
          <CardBody>
            <div className="template-preview">
              {template.preview && (
                <img src={template.preview} alt={template.name} loading="lazy" />
              )}
            </div>
          </CardBody>
          <CardFooter>
            <Button
              size="s"
              aria-label={`${t.templates.open}: ${template.name}`}
              onClick={() => onOpen(template)}
            >
              {t.templates.open}
            </Button>
          </CardFooter>
        </Card>
      ))}
    </Grid>
  );
}
