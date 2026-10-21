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

export const fetchTemplates = (): Promise<Page<TemplateSummary>> =>
  apiGetPage<TemplateSummary>('/api/templates');
