import { render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ApiError } from '../api/client';
import * as templatesApi from '../api/templates';
import type { TemplateSummary } from '../api/templates';
import { TemplatesList } from './TemplatesList';

const template = (over: Partial<TemplateSummary>): TemplateSummary => ({
  id: '1',
  name: 'Приглашение',
  category: 'HR',
  scope: 'shared',
  preview: null,
  ownerSub: 'u',
  createdAt: '2026-01-01T00:00:00Z',
  updatedAt: '2026-01-01T00:00:00Z',
  ...over,
});

afterEach(() => vi.restoreAllMocks());

describe('TemplatesList', () => {
  it('renders template cards with localized scope', async () => {
    vi.spyOn(templatesApi, 'fetchTemplates').mockResolvedValue({
      items: [template({}), template({ id: '2', name: 'Мой', scope: 'personal', category: '' })],
      total: 2,
    });

    render(<TemplatesList />);

    expect(await screen.findByText('Приглашение')).toBeInTheDocument();
    expect(screen.getByText('Общий')).toBeInTheDocument();
    expect(screen.getByText('Личный')).toBeInTheDocument();
  });

  it('shows the empty state when there are no templates', async () => {
    vi.spyOn(templatesApi, 'fetchTemplates').mockResolvedValue({ items: [], total: 0 });

    render(<TemplatesList />);

    expect(await screen.findByText('Шаблонов пока нет')).toBeInTheDocument();
  });

  it('shows a localized error banner on failure', async () => {
    vi.spyOn(templatesApi, 'fetchTemplates').mockRejectedValue(new ApiError('network_error', 'x', 0));

    render(<TemplatesList />);

    expect(await screen.findByText('Нет связи с сервером.')).toBeInTheDocument();
  });

  it('renders the preview image when present', async () => {
    vi.spyOn(templatesApi, 'fetchTemplates').mockResolvedValue({
      items: [template({ preview: 'data:image/png;base64,AAAA' })],
      total: 1,
    });

    render(<TemplatesList />);

    expect(await screen.findByRole('img', { name: 'Приглашение' })).toBeInTheDocument();
  });
});
