import { apiGetPage } from './client';
import type { Page } from './client';

export type TemplateScope = 'shared' | 'personal';

export interface TemplateSummary {
  id: string;
  name: string;
  category: string;
  scope: TemplateScope;
  preview: string | null;
  ownerSub: string;
  createdAt: string;
  updatedAt: string;
}

const PAGE_LIMIT = 200;

/** Все доступные шаблоны: поиск и фильтры работают по полному списку. */
export async function fetchTemplates(): Promise<Page<TemplateSummary>> {
  const items: TemplateSummary[] = [];
  for (let page = 1; ; page += 1) {
    const next = await apiGetPage<TemplateSummary>(
      `/api/templates?limit=${PAGE_LIMIT}&page=${page}`,
    );
    items.push(...next.items);
    if (next.items.length === 0 || items.length >= next.total) return { items, total: next.total };
  }
}
