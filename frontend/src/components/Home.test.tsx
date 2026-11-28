import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Me } from '../api/me';
import * as templatesApi from '../api/templates';
import type { TemplateSummary } from '../api/templates';
import { Home } from './Home';

const user = (role: Me['role']): Me => ({
  id: '1',
  sub: 'u1',
  role,
  displayName: 'Анна',
  email: null,
  audienceId: null,
});

const template = (day: number): TemplateSummary => ({
  id: String(day),
  name: `Шаблон ${day}`,
  category: '',
  scope: 'shared',
  preview: null,
  ownerSub: 'u',
  createdAt: '2026-01-01T00:00:00Z',
  updatedAt: `2026-01-0${day}T00:00:00Z`,
});

const load = (items: TemplateSummary[]) =>
  vi.spyOn(templatesApi, 'fetchTemplates').mockResolvedValue({ items, total: items.length });

const show = (role: Me['role'] = 'editor') => {
  const handlers = { onOpen: vi.fn(), onNavigate: vi.fn() };
  render(<Home user={user(role)} {...handlers} />);
  return handlers;
};

afterEach(() => vi.restoreAllMocks());

describe('Home', () => {
  it('shows the four most recently changed templates, newest first', async () => {
    load([1, 5, 2, 4, 3].map(template));

    show();

    await screen.findByText('Шаблон 5');
    const names = screen.getAllByRole('heading', { level: 3 }).map((node) => node.textContent);
    expect(names).toEqual(['Шаблон 5', 'Шаблон 4', 'Шаблон 3', 'Шаблон 2']);
  });

  it('opens a recent template', async () => {
    load([template(1)]);
    const { onOpen } = show();

    await userEvent.click(await screen.findByRole('button', { name: 'Открыть: Шаблон 1' }));

    expect(onOpen).toHaveBeenCalledWith(template(1));
  });

  it('lists upcoming demo sends and leads to them', async () => {
    load([]);
    const { onNavigate } = show();

    expect(await screen.findByText('Приглашение на вебинар')).toBeInTheDocument();
    expect(screen.queryByText('Отчёт за квартал')).not.toBeInTheDocument();
    expect(screen.getByText('Тестовые данные')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Все мои отправки' }));

    expect(onNavigate).toHaveBeenCalledWith('sends');
  });

  it('leads to the template list', async () => {
    load([]);
    const { onNavigate } = show();

    await userEvent.click(screen.getByRole('button', { name: 'Выбрать шаблон для письма' }));

    expect(onNavigate).toHaveBeenCalledWith('templates');
    expect(screen.queryByRole('button', { name: 'Создать шаблон' })).not.toBeInTheDocument();
  });

  it('lets an admin start a new template in the builder', async () => {
    load([]);
    const { onNavigate } = show('admin');

    await userEvent.click(screen.getByRole('button', { name: 'Создать шаблон' }));

    expect(onNavigate).toHaveBeenCalledWith('builder');
  });
});
