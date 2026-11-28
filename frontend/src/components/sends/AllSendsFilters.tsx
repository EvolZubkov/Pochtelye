import { Cluster, Input, Select } from '@universityrt/ui-kit';
import { t } from '../../i18n';
import type { SendFilter } from '../../sends/filter';

interface AllSendsFiltersProps {
  value: SendFilter;
  authors: string[];
  onChange: (value: SendFilter) => void;
}

export function AllSendsFilters({ value, authors, onChange }: AllSendsFiltersProps) {
  const labels = t.sends.filter;
  const set = (change: Partial<SendFilter>) => onChange({ ...value, ...change });
  const options = [
    { value: '', label: t.common.all },
    ...authors.map((author) => ({ value: author, label: author })),
  ];

  return (
    <Cluster gap={3}>
      <Select
        label={labels.author}
        value={value.author}
        options={options}
        onChange={(author) => set({ author })}
      />
      <Input
        type="date"
        label={labels.from}
        value={value.from}
        onChange={(event) => set({ from: event.target.value })}
      />
      <Input
        type="date"
        label={labels.to}
        value={value.to}
        onChange={(event) => set({ to: event.target.value })}
      />
      <Input
        label={labels.query}
        value={value.query}
        onChange={(event) => set({ query: event.target.value })}
      />
    </Cluster>
  );
}
