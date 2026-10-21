import { render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { App } from './App';
import { ApiError } from './api/client';
import * as meApi from './api/me';
import { errorMessage } from './i18n';

afterEach(() => vi.restoreAllMocks());

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

describe('errorMessage', () => {
  it('falls back to the generic text for unknown codes', () => {
    expect(errorMessage(new ApiError('weird', 'x', 500))).toBe('Что-то пошло не так.');
    expect(errorMessage(new Error('boom'))).toBe('Что-то пошло не так.');
  });
});
