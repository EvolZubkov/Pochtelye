import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import * as adminApi from '../../api/admin';
import { ApiError } from '../../api/client';
import { sendRecord, senderSummary } from '../../test/fixtures';
import { SendLogPanel } from './SendLogPanel';

beforeEach(() => {
  vi.spyOn(adminApi, 'fetchSendSummary').mockResolvedValue([senderSummary()]);
  vi.spyOn(adminApi, 'fetchSendLog').mockResolvedValue({
    items: [sendRecord(), sendRecord({ id: 's-2', status: 'failed', subject: 'Сбой' })],
    total: 2,
  });
});

afterEach(() => vi.restoreAllMocks());

describe('SendLogPanel', () => {
  it('shows the per-sender summary and the send log', async () => {
    render(<SendLogPanel />);

    expect(await screen.findByText('Приглашение')).toBeInTheDocument();
    expect(screen.getByText('Отправлено')).toBeInTheDocument();
    expect(screen.getByText('Ошибка')).toBeInTheDocument();
    expect(screen.getAllByText('anna@rt.ru').length).toBeGreaterThan(0);
  });

  it('reveals the recipients of a message on demand', async () => {
    render(<SendLogPanel />);
    await screen.findByText('Приглашение');
    expect(screen.queryByText(/x@rt.ru, y@rt.ru/)).not.toBeInTheDocument();

    await userEvent.click(screen.getAllByRole('button', { name: '2' })[0]);

    expect(await screen.findByText(/x@rt.ru, y@rt.ru/)).toBeInTheDocument();
  });

  it('turns the date filter into a half-open range including the chosen day', async () => {
    render(<SendLogPanel />);
    await screen.findByText('Приглашение');

    fireEvent.change(screen.getByLabelText('С даты'), { target: { value: '2026-03-01' } });
    fireEvent.change(screen.getByLabelText('По дату'), { target: { value: '2026-03-02' } });

    await waitFor(() => {
      const [page, filter] = vi.mocked(adminApi.fetchSendLog).mock.lastCall!;
      expect(page).toBe(1);
      expect(new Date(filter.dateFrom!).getTime()).toBe(new Date('2026-03-01T00:00:00').getTime());
      expect(new Date(filter.dateTo!).getTime()).toBe(new Date('2026-03-03T00:00:00').getTime());
    });
  });

  it('shows empty states', async () => {
    vi.spyOn(adminApi, 'fetchSendSummary').mockResolvedValue([]);
    vi.spyOn(adminApi, 'fetchSendLog').mockResolvedValue({ items: [], total: 0 });

    render(<SendLogPanel />);

    expect(await screen.findByText('Отправок пока нет')).toBeInTheDocument();
    expect(await screen.findByText('Нет отправок за выбранный период')).toBeInTheDocument();
  });

  it('shows localized errors for both blocks', async () => {
    vi.spyOn(adminApi, 'fetchSendSummary').mockRejectedValue(new ApiError('forbidden', 'x', 403));
    vi.spyOn(adminApi, 'fetchSendLog').mockRejectedValue(new ApiError('network_error', 'x', 0));

    render(<SendLogPanel />);

    expect(await screen.findByText('Недостаточно прав.')).toBeInTheDocument();
    expect(await screen.findByText('Нет связи с сервером.')).toBeInTheDocument();
  });
});
