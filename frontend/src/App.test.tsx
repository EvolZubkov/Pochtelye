import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { App } from './App';
import { ApiError } from './api/client';
import * as meApi from './api/me';
import * as adminApi from './api/admin';
import * as templatesApi from './api/templates';
import { errorMessage } from './i18n';

const me = (over: Partial<meApi.Me> = {}): meApi.Me => ({
  id: 'id-1',
  sub: 'u1',
  role: 'editor',
  displayName: null,
  email: null,
  audienceId: null,
  ...over,
});

beforeEach(() => {
  vi.spyOn(templatesApi, 'fetchTemplates').mockResolvedValue({ items: [], total: 0 });
});

afterEach(() => {
  vi.restoreAllMocks();
  window.location.hash = '';
});

describe('App', () => {
  it('shows the user and the localized role once loaded', async () => {
    vi.spyOn(meApi, 'fetchMe').mockResolvedValue(me({ role: 'admin', displayName: 'Анна' }));

    render(<App />);

    expect(await screen.findByText(/Вы вошли как: Анна/)).toBeInTheDocument();
    expect(screen.getByText(/Роль: Администратор/)).toBeInTheDocument();
  });

  it('shows a localized banner for an API error code', async () => {
    vi.spyOn(meApi, 'fetchMe').mockRejectedValue(new ApiError('auth_expired', 'x', 401));

    render(<App />);

    expect(await screen.findByText(/Сессия истекла/)).toBeInTheDocument();
  });
});

describe('App navigation', () => {
  it('shows the editor iframe on the editor route', async () => {
    vi.spyOn(meApi, 'fetchMe').mockResolvedValue(me());
    window.location.hash = '#/editor';

    render(<App />);

    const frame = await screen.findByTitle('Редактор писем');
    expect(frame).toHaveAttribute('src', 'editor/index.html');
    expect(screen.queryByText(/Вы вошли как/)).not.toBeInTheDocument();
  });
});

describe('App builder access', () => {
  const as = (role: 'admin' | 'editor') =>
    vi.spyOn(meApi, 'fetchMe').mockResolvedValue(me({ role }));

  it('offers the builder tab and iframe to admins', async () => {
    as('admin');
    window.location.hash = '#/builder';

    render(<App />);

    expect(await screen.findByTitle('Конструктор шаблонов')).toHaveAttribute(
      'src',
      'editor/admin.html',
    );
    expect(screen.getByRole('tab', { name: 'Конструктор' })).toBeInTheDocument();
  });

  it('hides the builder from non-admins and falls back to home', async () => {
    as('editor');
    window.location.hash = '#/builder';

    render(<App />);

    expect(await screen.findByText(/Вы вошли как/)).toBeInTheDocument();
    expect(screen.queryByRole('tab', { name: 'Конструктор' })).not.toBeInTheDocument();
    expect(screen.queryByTitle('Конструктор шаблонов')).not.toBeInTheDocument();
  });
});

describe('App activation', () => {
  it('shows the activation form when access is not activated and reloads after success', async () => {
    const fetchMe = vi
      .spyOn(meApi, 'fetchMe')
      .mockRejectedValueOnce(new ApiError('not_activated', 'x', 403))
      .mockResolvedValue(me({ displayName: 'Новичок' }));
    vi.spyOn(meApi, 'activate').mockResolvedValue(me());

    render(<App />);
    await userEvent.type(await screen.findByLabelText('Код приглашения'), 'ABCD-EFGH');
    await userEvent.click(screen.getByRole('button', { name: 'Активировать' }));

    expect(await screen.findByText(/Вы вошли как: Новичок/)).toBeInTheDocument();
    expect(fetchMe).toHaveBeenCalledTimes(2);
  });

  it('shows other errors as a banner, not the activation form', async () => {
    vi.spyOn(meApi, 'fetchMe').mockRejectedValue(new ApiError('auth_missing', 'x', 401));

    render(<App />);

    expect(await screen.findByText(/Нет токена платформы/)).toBeInTheDocument();
    expect(screen.queryByLabelText('Код приглашения')).not.toBeInTheDocument();
  });
});

describe('App admin panel', () => {
  beforeEach(() => {
    vi.spyOn(adminApi, 'fetchUsers').mockResolvedValue({ items: [], total: 0 });
    vi.spyOn(adminApi, 'fetchAudiences').mockResolvedValue([]);
    vi.spyOn(adminApi, 'fetchSendSummary').mockResolvedValue([]);
    vi.spyOn(adminApi, 'fetchSendLog').mockResolvedValue({ items: [], total: 0 });
  });

  it('shows the admin tab to admins and switches between sections', async () => {
    vi.spyOn(meApi, 'fetchMe').mockResolvedValue(me({ role: 'admin' }));
    window.location.hash = '#/admin';

    render(<App />);

    expect(await screen.findByText('Пользователей не найдено')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('tab', { name: 'Журнал отправок' }));
    expect(await screen.findByText('Нет отправок за выбранный период')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('tab', { name: 'Аудитории' }));
    await waitFor(() => expect(adminApi.fetchAudiences).toHaveBeenCalled());
    expect(await screen.findByText('Аудиторий нет')).toBeInTheDocument();
  });

  it('hides the admin tab and panel from non-admins', async () => {
    vi.spyOn(meApi, 'fetchMe').mockResolvedValue(me({ role: 'editor' }));
    window.location.hash = '#/admin';

    render(<App />);

    expect(await screen.findByText(/Вы вошли как/)).toBeInTheDocument();
    expect(screen.queryByRole('tab', { name: 'Админ' })).not.toBeInTheDocument();
    expect(adminApi.fetchUsers).not.toHaveBeenCalled();
  });
});

describe('errorMessage', () => {
  it('falls back to the generic text for unknown codes', () => {
    expect(errorMessage(new ApiError('weird', 'x', 500))).toBe('Что-то пошло не так.');
    expect(errorMessage(new Error('boom'))).toBe('Что-то пошло не так.');
  });
});
