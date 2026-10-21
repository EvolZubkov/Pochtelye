import { render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { App } from './App';
import { ApiError } from './api/client';
import * as meApi from './api/me';
import * as templatesApi from './api/templates';
import { errorMessage } from './i18n';

beforeEach(() => {
  vi.spyOn(templatesApi, 'fetchTemplates').mockResolvedValue({ items: [], total: 0 });
});

afterEach(() => {
  vi.restoreAllMocks();
  window.location.hash = '';
});

describe('App', () => {
  it('shows the user and the localized role once loaded', async () => {
    vi.spyOn(meApi, 'fetchMe').mockResolvedValue({
      sub: 'u1',
      role: 'admin',
      displayName: 'Анна',
      email: null,
    });

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
    vi.spyOn(meApi, 'fetchMe').mockResolvedValue({
      sub: 'u1',
      role: 'editor',
      displayName: null,
      email: null,
    });
    window.location.hash = '#/editor';

    render(<App />);

    const frame = await screen.findByTitle('Редактор писем');
    expect(frame).toHaveAttribute('src', 'editor/index.html');
    expect(screen.queryByText(/Вы вошли как/)).not.toBeInTheDocument();
  });
});

describe('App builder access', () => {
  const as = (role: 'admin' | 'editor') =>
    vi.spyOn(meApi, 'fetchMe').mockResolvedValue({ sub: 'u1', role, displayName: null, email: null });

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

describe('errorMessage', () => {
  it('falls back to the generic text for unknown codes', () => {
    expect(errorMessage(new ApiError('weird', 'x', 500))).toBe('Что-то пошло не так.');
    expect(errorMessage(new Error('boom'))).toBe('Что-то пошло не так.');
  });
});
