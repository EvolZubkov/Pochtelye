import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { ApiError } from '../../api/client';
import { createDemoSendsApi } from '../../sends/api';
import { MySends } from './MySends';

const NOW = new Date('2026-12-01T10:00:00Z');
const ME = 'sender@example.com';

async function show() {
  render(<MySends actor={ME} api={createDemoSendsApi(() => NOW)} />);
  await screen.findByText('Приглашение на вебинар');
}

const row = (subject: string) => screen.getByRole('row', { name: new RegExp(subject) });
const click = (scope: HTMLElement, name: string) =>
  userEvent.click(within(scope).getByRole('button', { name }));
const openTab = (name: RegExp) => userEvent.click(screen.getByRole('tab', { name }));

describe('MySends', () => {
  it('warns that the data is not real and lists upcoming sends and mailings', async () => {
    await show();

    expect(screen.getByText('Это тестовые данные')).toBeInTheDocument();
    expect(row('Приглашение на вебинар')).toHaveTextContent('Запланировано');
    expect(row('Новости недели')).toHaveTextContent('Отправляется');
    expect(row('Новости недели')).toHaveTextContent('2 из 5');
  });

  it.each([
    [/Отправленные/, 'Отчёт за квартал'],
    [/С ошибками/, 'Опрос о столовой'],
    [/Отменённые/, 'Встреча команды'],
  ])('shows its own sends on tab %s', async (tab, subject) => {
    await show();

    await openTab(tab);

    expect(row(subject)).toBeInTheDocument();
    expect(screen.queryByText('Приглашение на вебинар')).not.toBeInTheDocument();
  });

  it('shows nobody else’s sends', async () => {
    await show();

    expect(screen.queryByText('Анонс обучения')).not.toBeInTheDocument();
  });

  it('shows every recipient with the error text', async () => {
    await show();
    await openTab(/С ошибками/);

    await click(row('Опрос о столовой'), 'Получатели');

    const dialog = screen.getByRole('dialog');
    expect(dialog).toHaveTextContent('Ящик получателя не найден');
  });

  it('edits the subject of a scheduled send', async () => {
    await show();

    await click(row('Приглашение на вебинар'), 'Изменить');
    const subject = screen.getByLabelText(/^Тема/);
    await userEvent.clear(subject);
    await userEvent.type(subject, 'Вебинар перенесён');
    await userEvent.click(screen.getByRole('button', { name: 'Сохранить' }));

    expect(await screen.findByText('Вебинар перенесён')).toBeInTheDocument();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('keeps the form open and explains a rejected change', async () => {
    await show();

    await click(row('Приглашение на вебинар'), 'Изменить');
    await userEvent.clear(screen.getByLabelText(/^Получатели/));
    await userEvent.click(screen.getByRole('button', { name: 'Сохранить' }));

    expect(await screen.findByText('Укажите хотя бы одного получателя.')).toBeInTheDocument();
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });

  it('locks subject and time once sending has started', async () => {
    await show();

    await click(row('Новости недели'), 'Изменить');

    expect(screen.getByLabelText(/^Тема/)).toBeDisabled();
    expect(screen.getByLabelText(/^Когда отправить/)).toBeDisabled();
    expect(screen.getByLabelText(/^Получатели/)).toBeEnabled();
  });

  it('cancels a scheduled send after confirmation', async () => {
    await show();

    await click(row('Приглашение на вебинар'), 'Отменить');
    await userEvent.click(screen.getByRole('button', { name: 'Отменить отправку' }));
    await vi.waitFor(() =>
      expect(screen.queryByText('Приглашение на вебинар')).not.toBeInTheDocument(),
    );
    await openTab(/Отменённые/);

    expect(row('Приглашение на вебинар')).toBeInTheDocument();
  });

  it('retries a failed send', async () => {
    await show();
    await openTab(/С ошибками/);

    await click(row('Опрос о столовой'), 'Повторить');

    expect(await screen.findByText('Здесь пока пусто')).toBeInTheDocument();
    await openTab(/Запланированные/);
    expect(row('Опрос о столовой')).toBeInTheDocument();
  });

  it('explains a loading failure', async () => {
    const api = createDemoSendsApi(() => NOW);
    api.list = () => Promise.reject(new ApiError('network_error', 'x', 0));

    render(<MySends actor={ME} api={api} />);

    expect(await screen.findByText('Нет связи с сервером.')).toBeInTheDocument();
  });
});
