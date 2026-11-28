import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ApiError } from '../api/client';
import * as templatesApi from '../api/templates';
import type { TemplateSummary } from '../api/templates';
import { Templates } from './Templates';

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

const ITEMS = [
  template({}),
  template({ id: '2', name: 'Мой отчёт', scope: 'personal', category: '' }),
  template({ id: '3', name: 'Акция', category: 'Федеральные' }),
];

const load = (items: TemplateSummary[] = ITEMS) =>
  vi.spyOn(templatesApi, 'fetchTemplates').mockResolvedValue({ items, total: items.length });

const names = () => screen.queryAllByRole('heading', { level: 3 }).map((node) => node.textContent);

const renderLoaded = async () => {
  render(<Templates onOpen={vi.fn()} />);
  await screen.findByText('Приглашение');
};

afterEach(() => {
  vi.restoreAllMocks();
  window.location.hash = '';
});

describe('Templates', () => {
  it('shows every template with its scope', async () => {
    load();

    await renderLoaded();

    expect(names()).toEqual(['Приглашение', 'Мой отчёт', 'Акция']);
    expect(screen.getAllByText('Общий')).toHaveLength(2);
    expect(screen.getByText('Личный')).toBeInTheDocument();
  });

  it('searches by name and category, ignoring case', async () => {
    load();
    await renderLoaded();
    const search = screen.getByRole('searchbox', { name: 'Поиск' });

    await userEvent.type(search, 'ОТЧЁТ');
    expect(names()).toEqual(['Мой отчёт']);

    await userEvent.clear(search);
    await userEvent.type(search, 'федер');
    expect(names()).toEqual(['Акция']);
  });

  it('filters by owner', async () => {
    load();
    await renderLoaded();
    const owners = screen.getByRole('group', { name: 'Чьи шаблоны' });

    await userEvent.click(within(owners).getByRole('button', { name: 'Мои' }));
    expect(names()).toEqual(['Мой отчёт']);

    await userEvent.click(within(owners).getByRole('button', { name: 'Общие' }));
    expect(names()).toEqual(['Приглашение', 'Акция']);
  });

  it.each([
    ['HR', ['Приглашение']],
    ['Без категории', ['Мой отчёт']],
  ])('filters by category %s', async (category, expected) => {
    load();
    await renderLoaded();

    await userEvent.click(screen.getByRole('button', { name: category }));

    expect(names()).toEqual(expected);
    await userEvent.click(screen.getByRole('button', { name: 'Все категории' }));
    expect(names()).toHaveLength(3);
  });

  it('says when nothing matches', async () => {
    load();
    await renderLoaded();

    await userEvent.type(screen.getByRole('searchbox', { name: 'Поиск' }), 'zzz');

    expect(screen.getByText('Ничего не найдено')).toBeInTheDocument();
  });

  it('opens the chosen template', async () => {
    load();
    const onOpen = vi.fn();
    render(<Templates onOpen={onOpen} />);

    await userEvent.click(await screen.findByRole('button', { name: 'Открыть: Акция' }));

    expect(onOpen).toHaveBeenCalledWith(ITEMS[2]);
  });

  it('shows the preview image when present', async () => {
    load([template({ preview: 'data:image/png;base64,AAAA' })]);

    await renderLoaded();

    expect(screen.getByRole('img', { name: 'Приглашение' })).toBeInTheDocument();
  });

  it('shows the empty state when there are no templates', async () => {
    load([]);

    render(<Templates onOpen={vi.fn()} />);

    expect(await screen.findByText('Шаблонов пока нет')).toBeInTheDocument();
  });

  it('shows a localized error banner on failure', async () => {
    vi.spyOn(templatesApi, 'fetchTemplates').mockRejectedValue(
      new ApiError('network_error', 'x', 0),
    );

    render(<Templates onOpen={vi.fn()} />);

    expect(await screen.findByText('Нет связи с сервером.')).toBeInTheDocument();
  });
});
