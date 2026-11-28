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

const signIn = (role: meApi.Me['role'], hash = '') => {
  vi.spyOn(meApi, 'fetchMe').mockResolvedValue(me({ role }));
  window.location.hash = hash;
};

const menuItem = (name: string) => screen.queryByRole('button', { name });

const USER_ITEMS = ['Главная', 'Шаблоны', 'Письма', 'Мои отправки', 'Настройки'];
const ADMIN_ITEMS = ['Конструктор', 'Все отправки', 'Пользователи', 'Группы', 'Аудитории'];

beforeEach(() => {
  vi.spyOn(templatesApi, 'fetchTemplates').mockResolvedValue({ items: [], total: 0 });
  vi.spyOn(adminApi, 'fetchUsers').mockResolvedValue({ items: [], total: 0 });
  vi.spyOn(adminApi, 'fetchAudiences').mockResolvedValue([]);
  vi.spyOn(adminApi, 'fetchGroups').mockResolvedValue([]);
  vi.spyOn(adminApi, 'fetchSendSummary').mockResolvedValue([]);
  vi.spyOn(adminApi, 'fetchSendLog').mockResolvedValue({ items: [], total: 0 });
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
    expect(menuItem('Главная')).not.toBeInTheDocument();
  });
});

describe('App sidebar', () => {
  it('offers admins both user and admin sections', async () => {
    signIn('admin');

    render(<App />);

    expect(await screen.findByRole('button', { name: 'Пользователи' })).toBeInTheDocument();
    [...USER_ITEMS, ...ADMIN_ITEMS].forEach((name) => expect(menuItem(name)).toBeInTheDocument());
  });

  it.each(['editor', 'viewer'] as const)('offers a %s only the user sections', async (role) => {
    signIn(role);

    render(<App />);

    expect(await screen.findByRole('button', { name: 'Мои отправки' })).toBeInTheDocument();
    USER_ITEMS.forEach((name) => expect(menuItem(name)).toBeInTheDocument());
    ADMIN_ITEMS.forEach((name) => expect(menuItem(name)).not.toBeInTheDocument());
  });

  it('carries the product name in the menu', async () => {
    signIn('editor');

    render(<App />);

    expect(await screen.findByRole('complementary', { name: 'Разделы' })).toHaveTextContent(
      'Почтелье',
    );
  });

  it('navigates and marks the current section', async () => {
    signIn('editor');

    render(<App />);
    await userEvent.click(await screen.findByRole('button', { name: 'Шаблоны' }));

    expect(await screen.findByText('Шаблонов пока нет')).toBeInTheDocument();
    expect(menuItem('Шаблоны')).toHaveAttribute('aria-current', 'page');
    expect(window.location.hash).toBe('#/templates');
  });

  it.each([
    ['#/sends', 'Мои отправки', 'Это тестовые данные'],
    ['#/settings', 'Настройки', 'Это тестовый режим'],
  ])('opens %s marked as a demo', async (hash, title, mark) => {
    signIn('editor', hash);

    render(<App />);

    expect(await screen.findByRole('heading', { level: 1, name: title })).toBeInTheDocument();
    expect(await screen.findByText(mark)).toBeInTheDocument();
  });

  it('collapses on the editor and can be expanded again', async () => {
    signIn('editor', '#/editor');

    render(<App />);
    await userEvent.click(await screen.findByRole('button', { name: 'Развернуть' }));

    expect(screen.getByRole('button', { name: 'Свернуть' })).toBeInTheDocument();
  });

  it('collapses again when another section is opened', async () => {
    signIn('editor');

    render(<App />);
    await userEvent.click(await screen.findByRole('button', { name: 'Свернуть' }));
    await userEvent.click(screen.getByRole('button', { name: 'Шаблоны' }));

    expect(screen.getByRole('button', { name: 'Свернуть' })).toBeInTheDocument();
  });
});

describe('App editor', () => {
  it('shows the editor iframe on the editor route', async () => {
    signIn('editor', '#/editor');

    render(<App />);

    const frame = await screen.findByTitle('Редактор писем');
    expect(frame).toHaveAttribute('src', 'editor/index.html');
    expect(screen.queryByText(/Вы вошли как/)).not.toBeInTheDocument();
  });

  it('shows the builder iframe to admins', async () => {
    signIn('admin', '#/builder');

    render(<App />);

    expect(await screen.findByTitle('Конструктор шаблонов')).toHaveAttribute(
      'src',
      'editor/admin.html',
    );
  });

  it('hides the builder from non-admins and falls back to home', async () => {
    signIn('editor', '#/builder');

    render(<App />);

    expect(await screen.findByText(/Вы вошли как/)).toBeInTheDocument();
    expect(screen.queryByTitle('Конструктор шаблонов')).not.toBeInTheDocument();
  });
});

describe('App admin sections', () => {
  it.each([
    ['#/users', 'Пользователи', 'Пользователей не найдено'],
    ['#/admin', 'Пользователи', 'Пользователей не найдено'],
    ['#/audiences', 'Аудитории', 'Аудиторий нет'],
    ['#/all-sends', 'Все отправки', 'Это тестовые данные'],
  ])('opens %s for admins', async (hash, title, content) => {
    signIn('admin', hash);

    render(<App />);

    expect(await screen.findByRole('heading', { level: 1, name: title })).toBeInTheDocument();
    expect(await screen.findByText(content)).toBeInTheDocument();
  });

  it('opens groups for admins', async () => {
    signIn('admin', '#/groups');

    render(<App />);

    expect(await screen.findByRole('heading', { level: 1, name: 'Группы' })).toBeInTheDocument();
    await waitFor(() => expect(adminApi.fetchGroups).toHaveBeenCalled());
  });

  it.each(['#/users', '#/admin', '#/groups', '#/audiences', '#/all-sends'])(
    'keeps non-admins out of %s',
    async (hash) => {
      signIn('editor', hash);

      render(<App />);

      expect(await screen.findByText(/Вы вошли как/)).toBeInTheDocument();
      expect(adminApi.fetchUsers).not.toHaveBeenCalled();
      expect(adminApi.fetchGroups).not.toHaveBeenCalled();
      expect(adminApi.fetchAudiences).not.toHaveBeenCalled();
      expect(adminApi.fetchSendLog).not.toHaveBeenCalled();
    },
  );
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

describe('errorMessage', () => {
  it('falls back to the generic text for unknown codes', () => {
    expect(errorMessage(new ApiError('weird', 'x', 500))).toBe('Что-то пошло не так.');
    expect(errorMessage(new Error('boom'))).toBe('Что-то пошло не так.');
  });
});
