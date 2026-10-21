import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import * as adminApi from '../../api/admin';
import { ApiError } from '../../api/client';
import { adminUser, audience } from '../../test/fixtures';
import { UsersPanel } from './UsersPanel';

const invited = adminUser({
  id: 'u-2',
  sub: null,
  email: 'new@rt.ru',
  displayName: null,
  status: 'invited',
  lastSeenAt: null,
  audienceId: 'a-2',
});

beforeEach(() => {
  vi.spyOn(adminApi, 'fetchUsers').mockResolvedValue({ items: [adminUser(), invited], total: 2 });
  vi.spyOn(adminApi, 'fetchAudiences').mockResolvedValue([
    audience(),
    audience({ id: 'a-2', name: 'HR', isDefault: false }),
  ]);
});

afterEach(() => vi.restoreAllMocks());

describe('UsersPanel', () => {
  it('lists users with role, audience, status and last seen', async () => {
    render(<UsersPanel />);

    expect(await screen.findByText('anna@rt.ru')).toBeInTheDocument();
    expect(screen.getByText('Ждёт входа')).toBeInTheDocument();
    expect(screen.getByText('Активен')).toBeInTheDocument();
    expect(await screen.findByText('HR')).toBeInTheDocument();
    expect(screen.getByText('Не входил')).toBeInTheDocument();
  });

  it('shows the empty state', async () => {
    vi.spyOn(adminApi, 'fetchUsers').mockResolvedValue({ items: [], total: 0 });

    render(<UsersPanel />);

    expect(await screen.findByText('Пользователей не найдено')).toBeInTheDocument();
  });

  it('shows a localized error banner when loading fails', async () => {
    vi.spyOn(adminApi, 'fetchUsers').mockRejectedValue(new ApiError('forbidden', 'x', 403));

    render(<UsersPanel />);

    expect(await screen.findByText('Недостаточно прав.')).toBeInTheDocument();
  });

  it('creates a user and shows the one-time invite code', async () => {
    const created = adminUser({ id: 'u-3', email: 'ivan@rt.ru', status: 'invited', sub: null });
    const createUser = vi
      .spyOn(adminApi, 'createUser')
      .mockResolvedValue({ user: created, inviteCode: 'ABCD-EFGH-JKMN-PQRS' });
    render(<UsersPanel />);
    await screen.findByText('anna@rt.ru');

    await userEvent.click(screen.getByRole('button', { name: 'Добавить пользователя' }));
    const dialog = await screen.findByRole('dialog');
    await userEvent.type(within(dialog).getByLabelText(/Рабочая почта/), 'ivan@rt.ru');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Сохранить' }));

    expect(createUser).toHaveBeenCalledWith({
      email: 'ivan@rt.ru',
      displayName: null,
      role: 'editor',
      audienceId: null,
    });
    expect(await screen.findByText('ABCD-EFGH-JKMN-PQRS')).toBeInTheDocument();
  });

  it('shows a server error inside the form and keeps it open', async () => {
    vi.spyOn(adminApi, 'createUser').mockRejectedValue(new ApiError('email_taken', 'x', 409));
    render(<UsersPanel />);
    await screen.findByText('anna@rt.ru');

    await userEvent.click(screen.getByRole('button', { name: 'Добавить пользователя' }));
    const dialog = await screen.findByRole('dialog');
    await userEvent.type(within(dialog).getByLabelText(/Рабочая почта/), 'anna@rt.ru');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Сохранить' }));

    expect(await within(dialog).findByText('Пользователь с такой почтой уже есть.')).toBeInTheDocument();
  });

  it('reissues an invite only for invited users', async () => {
    const reissue = vi
      .spyOn(adminApi, 'reissueInvite')
      .mockResolvedValue({ user: invited, inviteCode: 'WXYZ-2345-6789-ABCD' });
    render(<UsersPanel />);
    await screen.findByText('new@rt.ru');

    expect(screen.getAllByRole('button', { name: 'Новый код' })).toHaveLength(1);
    await userEvent.click(screen.getByRole('button', { name: 'Новый код' }));

    expect(reissue).toHaveBeenCalledWith('u-2');
    expect(await screen.findByText('WXYZ-2345-6789-ABCD')).toBeInTheDocument();
  });

  it('asks for confirmation before deleting and then reloads', async () => {
    const remove = vi.spyOn(adminApi, 'deleteUser').mockResolvedValue({ id: 'u-1' });
    render(<UsersPanel />);
    await screen.findByText('anna@rt.ru');

    await userEvent.click(screen.getAllByRole('button', { name: 'Удалить' })[0]);
    expect(remove).not.toHaveBeenCalled();
    const dialog = await screen.findByRole('dialog');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Удалить' }));

    await waitFor(() => expect(remove).toHaveBeenCalledWith('u-1'));
    await waitFor(() => expect(adminApi.fetchUsers).toHaveBeenCalledTimes(2));
  });

  it('shows the delete error inside the confirmation (e.g. deleting yourself)', async () => {
    vi.spyOn(adminApi, 'deleteUser').mockRejectedValue(new ApiError('cannot_modify_self', 'x', 409));
    render(<UsersPanel />);
    await screen.findByText('anna@rt.ru');

    await userEvent.click(screen.getAllByRole('button', { name: 'Удалить' })[0]);
    const dialog = await screen.findByRole('dialog');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Удалить' }));

    expect(await within(dialog).findByText('Нельзя изменить или удалить самого себя.')).toBeInTheDocument();
  });

  it('searches with a debounce and returns to the first page', async () => {
    render(<UsersPanel />);
    await screen.findByText('anna@rt.ru');

    await userEvent.type(screen.getByRole('searchbox', { name: 'Поиск' }), 'ann');

    await waitFor(() => expect(adminApi.fetchUsers).toHaveBeenLastCalledWith(1, 'ann'));
  });
});
