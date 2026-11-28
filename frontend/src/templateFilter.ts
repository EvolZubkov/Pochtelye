import type { TemplateScope, TemplateSummary } from './api/templates';

export type OwnerFilter = 'all' | TemplateScope;

export interface TemplateFilter {
  text: string;
  owner: OwnerFilter;
  /** null: все категории; пустая строка: шаблоны без категории. */
  category: string | null;
}

export const NO_FILTER: TemplateFilter = { text: '', owner: 'all', category: null };

export function filterTemplates(
  items: TemplateSummary[],
  { text, owner, category }: TemplateFilter,
): TemplateSummary[] {
  const needle = text.trim().toLocaleLowerCase('ru');
  return items.filter(
    (item) =>
      (owner === 'all' || item.scope === owner) &&
      (category === null || item.category === category) &&
      `${item.name} ${item.category}`.toLocaleLowerCase('ru').includes(needle),
  );
}

/** Категории по алфавиту; «без категории» в конце. */
export function categoriesOf(items: TemplateSummary[]): string[] {
  const found = [...new Set(items.map((item) => item.category))];
  const named = found.filter((category) => category !== '').sort((a, b) => a.localeCompare(b, 'ru'));
  return found.includes('') ? [...named, ''] : named;
}
