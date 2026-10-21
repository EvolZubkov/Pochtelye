import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { InviteCodeModal } from './InviteCodeModal';

afterEach(() => vi.restoreAllMocks());

describe('InviteCodeModal', () => {
  it('shows the code and copies it to the clipboard', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });
    render(<InviteCodeModal email="a@rt.ru" code="ABCD-EFGH-JKMN-PQRS" onClose={vi.fn()} />);

    await userEvent.click(screen.getByRole('button', { name: 'Скопировать' }));

    expect(writeText).toHaveBeenCalledWith('ABCD-EFGH-JKMN-PQRS');
    expect(await screen.findByRole('button', { name: 'Скопировано' })).toBeInTheDocument();
  });

  it('keeps working when the clipboard is unavailable', async () => {
    const writeText = vi.fn().mockRejectedValue(new Error('denied'));
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });
    render(<InviteCodeModal email="a@rt.ru" code="ABCD-EFGH-JKMN-PQRS" onClose={vi.fn()} />);

    await userEvent.click(screen.getByRole('button', { name: 'Скопировать' }));

    expect(screen.getByText('ABCD-EFGH-JKMN-PQRS')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Скопировать' })).toBeInTheDocument();
  });
});
