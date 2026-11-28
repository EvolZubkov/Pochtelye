import {
  Banner,
  Chip,
  Cluster,
  EmptyState,
  SearchField,
  SegmentedControl,
  Skeleton,
  Stack,
} from '@universityrt/ui-kit';
import { useState } from 'react';
import { fetchTemplates } from '../api/templates';
import type { TemplateSummary } from '../api/templates';
import { useAsync } from '../hooks/useAsync';
import { errorMessage, t } from '../i18n';
import { NO_FILTER, categoriesOf, filterTemplates } from '../templateFilter';
import type { OwnerFilter, TemplateFilter } from '../templateFilter';
import { TemplateGrid } from './TemplateGrid';

interface TemplatesProps {
  onOpen: (template: TemplateSummary) => void;
}

const OWNERS: { value: OwnerFilter; label: string }[] = [
  { value: 'all', label: t.templates.owners.all },
  { value: 'shared', label: t.templates.owners.shared },
  { value: 'personal', label: t.templates.owners.personal },
];

export function Templates({ onOpen }: TemplatesProps) {
  const state = useAsync(fetchTemplates);
  const [filter, setFilter] = useState<TemplateFilter>(NO_FILTER);

  if (state.status === 'loading') return <Skeleton aria-label={t.common.loading} />;
  if (state.status === 'error') return <Banner tone="error" title={errorMessage(state.error)} />;

  const { items } = state.data;
  if (items.length === 0) {
    return <EmptyState title={t.templates.emptyTitle} description={t.templates.emptyHint} />;
  }
  const found = filterTemplates(items, filter);
  const change = (part: Partial<TemplateFilter>) => setFilter({ ...filter, ...part });

  return (
    <Stack gap={4}>
      <Cluster gap={3}>
        <SearchField
          value={filter.text}
          onChange={(event) => change({ text: event.target.value })}
          placeholder={t.templates.searchPlaceholder}
          aria-label={t.common.search}
        />
        <SegmentedControl<OwnerFilter>
          aria-label={t.templates.ownersLabel}
          items={OWNERS}
          value={filter.owner}
          onChange={(owner) => change({ owner })}
        />
      </Cluster>
      <Cluster gap={2}>
        <Chip selected={filter.category === null} onClick={() => change({ category: null })}>
          {t.templates.allCategories}
        </Chip>
        {categoriesOf(items).map((category) => (
          <Chip
            key={category}
            selected={filter.category === category}
            onClick={() => change({ category })}
          >
            {category || t.templates.uncategorized}
          </Chip>
        ))}
      </Cluster>
      {found.length === 0 ? (
        <EmptyState title={t.templates.nothingFound} />
      ) : (
        <TemplateGrid items={found} onOpen={onOpen} />
      )}
    </Stack>
  );
}
