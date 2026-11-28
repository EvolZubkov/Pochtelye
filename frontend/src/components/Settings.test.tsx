import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { createDemoMailSettingsApi } from '../sends/mailSettings';
import { Settings } from './Settings';

const field = (label: RegExp) => screen.getByLabelText(label);
const save = () => userEvent.click(screen.getByRole('button', { name: 'Сохранить' }));

async function show() {
  const api = createDemoMailSettingsApi();
  const view = render(<Settings api={api} />);
  await screen.findByLabelText(/^Сервер/);
  return { api, view };
}

async function fill() {
  await userEvent.type(field(/^Сервер/), 'cas.rt.ru');
  await userEvent.type(field(/^Логин/), 'pr\\ivanov');
  await userEvent.type(field(/^Пароль/), 'secret');
  await userEvent.type(field(/^Адреса отправителя/), 'ivan@rt.ru');
}

describe('Settings', () => {
  it('warns that nothing is really saved', async () => {
    await show();

    expect(screen.getByText('Это тестовый режим')).toBeInTheDocument();
  });

  it('saves the connection and never keeps the password', async () => {
    const { api } = await show();

    await fill();
    await save();

    expect(await screen.findByText('Настройки приняты')).toBeInTheDocument();
    const stored = await api.load();
    expect(stored).toEqual({
      server: 'cas.rt.ru',
      login: 'pr\\ivanov',
      fromAddresses: ['ivan@rt.ru'],
      hasPassword: true,
    });
    expect(JSON.stringify(stored)).not.toContain('secret');
    expect(field(/^Пароль/)).toHaveValue('');
  });

  it('shows the saved connection again without asking for the password', async () => {
    const { api, view } = await show();
    await fill();
    await save();
    await screen.findByText('Настройки приняты');
    view.unmount();

    render(<Settings api={api} />);

    expect(await screen.findByLabelText(/^Сервер/)).toHaveValue('cas.rt.ru');
    await save();
    expect(await screen.findByText('Настройки приняты')).toBeInTheDocument();
  });

  it.each([
    ['Укажите сервер и логин.', async () => {}],
    [
      'Укажите пароль.',
      async () => {
        await userEvent.type(field(/^Сервер/), 'cas.rt.ru');
        await userEvent.type(field(/^Логин/), 'ivan');
      },
    ],
    [
      'Проверьте адреса электронной почты.',
      async () => {
        await fill();
        await userEvent.type(field(/^Адреса отправителя/), '\nне почта');
      },
    ],
  ])('explains: %s', async (message, prepare) => {
    await show();

    await prepare();
    await save();

    expect(await screen.findByText(message)).toBeInTheDocument();
    expect(screen.queryByText('Настройки приняты')).not.toBeInTheDocument();
  });
});
