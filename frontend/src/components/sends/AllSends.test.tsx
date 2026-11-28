import { fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import * as adminApi from '../../api/admin';
import { ApiError } from '../../api/client';
import { createDemoSendsApi } from '../../sends/api';
import { AllSends } from './AllSends';

const NOW = new Date('2026-12-01T10:00:00Z');
const ADMIN = 'admin@rt.ru';

async function show() {
  render(<AllSends actor={ADMIN} api={createDemoSendsApi(() => NOW)} />);
  await screen.findByText('Приглашение на вебинар');
}

const row = (subject: string) => screen.getByRole('row', { name: new RegExp(subject) });
const click = (scope: HTMLElement, name: string) =>
  userEvent.click(within(scope).getByRole('button', { name }));
const openTab = (name: RegExp) => userEvent.click(screen.getByRole('tab', { name }));

beforeEach(() => {
  vi.spyOn(adminApi, 'fetchSendSummary').mockResolvedValue([]);
  vi.spyOn(adminApi, 'fetchSendLog').mockResolvedValue({ items: [], total: 0 });
});

afterEach(() => vi.restoreAllMocks());

describe('AllSends', () => {
  it('shows the sends of every author', async () => {
    await show();

    expect(row('Приглашение на вебинар')).toHaveTextContent('sender@example.com');
    expect(row('Анонс обучения')).toHaveTextContent('anna.petrova@example.com');
  });

  it('lets an administrator cancel but not edit someone else’s send', async () => {
    await show();

    const buttons = within(row('Анонс обучения'));

    expect(buttons.getByRole('button', { name: 'Отменить' })).toBeInTheDocument();
    expect(buttons.queryByRole('button', { name: 'Изменить' })).not.toBeInTheDocument();
  });

  it('lets the author edit a scheduled send and resend a failed one', async () => {
    await show();

    expect(
      within(row('Приглашение на вебинар')).getByRole('button', { name: 'Изменить' }),
    ).toBeInTheDocument();
    await openTab(/С ошибками/);
    await click(row('Опрос о столовой'), 'Повторить');

    await vi.waitFor(() => expect(screen.queryByText('Опрос о столовой')).not.toBeInTheDocument());
  });

  it('shows who canceled a send', async () => {
    await show();

    await click(row('Анонс обучения'), 'Отменить');
    await userEvent.click(screen.getByRole('button', { name: 'Отменить отправку' }));
    await vi.waitFor(() => expect(screen.queryByText('Анонс обучения')).not.toBeInTheDocument());
    await openTab(/Отменённые/);

    expect(row('Анонс обучения')).toHaveTextContent(ADMIN);
  });

  it('filters by author and updates the tab counters', async () => {
    await show();

    await userEvent.click(screen.getByLabelText('Автор'));
    await userEvent.click(screen.getByRole('option', { name: 'anna.petrova@example.com' }));

    expect(row('Анонс обучения')).toBeInTheDocument();
    expect(screen.queryByText('Приглашение на вебинар')).not.toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /Запланированные/ })).toHaveTextContent('(1)');
  });

  it('finds a send by a recipient address', async () => {
    await show();

    await userEvent.type(screen.getByLabelText('Тема или получатель'), 'partner@');

    expect(row('Анонс обучения')).toBeInTheDocument();
    expect(screen.queryByText('Приглашение на вебинар')).not.toBeInTheDocument();
  });

  it('filters by date', async () => {
    await show();

    fireEvent.change(screen.getByLabelText('С даты'), { target: { value: '2027-01-01' } });

    expect(screen.getByText('Здесь пока пусто')).toBeInTheDocument();
  });

  it('shows errors of someone else’s failed send without offering to resend it', async () => {
    await show();
    await openTab(/С ошибками/);

    await click(row('Опрос о столовой'), 'Получатели');
    expect(screen.getByRole('dialog')).toHaveTextContent('Ящик получателя не найден');
    await userEvent.click(screen.getByRole('button', { name: /закрыть|close/i }));
    const other = within(row('Напоминание об отпусках'));
    expect(other.queryByRole('button', { name: 'Повторить' })).not.toBeInTheDocument();
  });

  it('keeps the server send log on its own tab without the demo warning', async () => {
    await show();

    await openTab(/Журнал/);

    expect(await screen.findByText('Нет отправок за выбранный период')).toBeInTheDocument();
    expect(screen.queryByText('Это тестовые данные')).not.toBeInTheDocument();
  });

  it('explains a loading failure', async () => {
    const api = createDemoSendsApi(() => NOW);
    api.listAll = () => Promise.reject(new ApiError('network_error', 'x', 0));

    render(<AllSends actor={ADMIN} api={api} />);

    expect(await screen.findByText('Нет связи с сервером.')).toBeInTheDocument();
  });
});
