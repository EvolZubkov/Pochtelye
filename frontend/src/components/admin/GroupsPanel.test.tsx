import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import * as adminApi from '../../api/admin';
import { ApiError } from '../../api/client';
import { audience, group } from '../../test/fixtures';
import { GroupsPanel } from './GroupsPanel';

const restricted = group({ id: 'g-2', name: 'Базовые', categories: ['Тема 1', 'Тема 2'], userCount: 0 });

beforeEach(() => {
  vi.spyOn(adminApi, 'fetchGroups').mockResolvedValue([group(), restricted]);
  vi.spyOn(adminApi, 'fetchAudiences').mockResolvedValue([audience()]);
});

afterEach(() => vi.restoreAllMocks());

describe('GroupsPanel', () => {
  it('lists groups with audience, visible categories and user count', async () => {
    render(<GroupsPanel />);

    expect(await screen.findByText('Рассылки')).toBeInTheDocument();
    expect(screen.getByText('Все категории')).toBeInTheDocument();
    expect(screen.getByText('Тема 1, Тема 2')).toBeInTheDocument();
    expect(await screen.findAllByText('По умолчанию')).not.toHaveLength(0);
  });

  it('shows the empty state', async () => {
    vi.spyOn(adminApi, 'fetchGroups').mockResolvedValue([]);

    render(<GroupsPanel />);

    expect(await screen.findByText('Групп нет')).toBeInTheDocument();
  });

  it('creates a group limited to the typed categories, without duplicates', async () => {
    const create = vi.spyOn(adminApi, 'createGroup').mockResolvedValue(restricted);
    render(<GroupsPanel />);
    await screen.findByText('Рассылки');

    await userEvent.click(screen.getByRole('button', { name: 'Создать группу' }));
    const dialog = await screen.findByRole('dialog');
    await userEvent.type(within(dialog).getByLabelText(/^Название/), 'Новая');
    await userEvent.click(within(dialog).getByLabelText(/Видны шаблоны всех категорий/));
    await userEvent.type(within(dialog).getByLabelText(/Видимые категории шаблонов/), 'Тема 1{enter}Тема 1{enter} Тема 2 ');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Сохранить' }));

    await waitFor(() =>
      expect(create).toHaveBeenCalledWith({
        audienceId: 'a-1',
        name: 'Новая',
        features: {},
        categories: ['Тема 1', 'Тема 2'],
        limits: {},
      }),
    );
  });

  it('saves null categories when all categories stay visible', async () => {
    const update = vi.spyOn(adminApi, 'updateGroup').mockResolvedValue(group());
    render(<GroupsPanel />);
    await screen.findByText('Рассылки');

    await userEvent.click(screen.getAllByRole('button', { name: 'Изменить' })[0]);
    const dialog = await screen.findByRole('dialog');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Сохранить' }));

    await waitFor(() =>
      expect(update).toHaveBeenCalledWith('g-1', {
        name: 'Рассылки',
        features: { bulk_mail: true },
        categories: null,
      }),
    );
  });

  it('includes uncategorized shared templates when asked', async () => {
    const update = vi.spyOn(adminApi, 'updateGroup').mockResolvedValue(restricted);
    render(<GroupsPanel />);
    await screen.findByText('Базовые');

    await userEvent.click(screen.getAllByRole('button', { name: 'Изменить' })[1]);
    const dialog = await screen.findByRole('dialog');
    await userEvent.click(within(dialog).getByLabelText(/Показывать и шаблоны без категории/));
    await userEvent.click(within(dialog).getByRole('button', { name: 'Сохранить' }));

    await waitFor(() =>
      expect(update).toHaveBeenCalledWith('g-2', {
        name: 'Базовые',
        features: { bulk_mail: true },
        categories: ['Тема 1', 'Тема 2', ''],
      }),
    );
  });

  it('shows the server error when deleting a group that has users', async () => {
    vi.spyOn(adminApi, 'deleteGroup').mockRejectedValue(new ApiError('group_in_use', 'x', 409));
    render(<GroupsPanel />);
    await screen.findByText('Рассылки');

    await userEvent.click(screen.getAllByRole('button', { name: 'Удалить' })[0]);
    const dialog = await screen.findByRole('dialog');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Удалить' }));

    expect(await within(dialog).findByText('В группе есть пользователи.')).toBeInTheDocument();
  });

  it('deletes an empty group after confirmation', async () => {
    const remove = vi.spyOn(adminApi, 'deleteGroup').mockResolvedValue({ id: 'g-2' });
    render(<GroupsPanel />);
    await screen.findByText('Базовые');

    await userEvent.click(screen.getAllByRole('button', { name: 'Удалить' })[1]);
    const dialog = await screen.findByRole('dialog');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Удалить' }));

    await waitFor(() => expect(remove).toHaveBeenCalledWith('g-2'));
  });
});
