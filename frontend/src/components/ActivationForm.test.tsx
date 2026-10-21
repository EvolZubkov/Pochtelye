import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ApiError } from '../api/client';
import * as meApi from '../api/me';
import { ActivationForm } from './ActivationForm';

afterEach(() => vi.restoreAllMocks());

describe('ActivationForm', () => {
  it('sends the trimmed code and notifies on success', async () => {
    const activate = vi.spyOn(meApi, 'activate').mockResolvedValue({} as meApi.Me);
    const onActivated = vi.fn();
    render(<ActivationForm onActivated={onActivated} />);

    await userEvent.type(screen.getByLabelText('Код приглашения'), '  ABCD-EFGH  ');
    await userEvent.click(screen.getByRole('button', { name: 'Активировать' }));

    expect(activate).toHaveBeenCalledWith('ABCD-EFGH');
    expect(onActivated).toHaveBeenCalledOnce();
  });

  it('keeps the submit button disabled while the code is empty', () => {
    render(<ActivationForm onActivated={vi.fn()} />);

    expect(screen.getByRole('button', { name: 'Активировать' })).toBeDisabled();
  });

  it('shows a localized error for a wrong code and does not notify', async () => {
    vi.spyOn(meApi, 'activate').mockRejectedValue(new ApiError('invite_invalid', 'x', 400));
    const onActivated = vi.fn();
    render(<ActivationForm onActivated={onActivated} />);

    await userEvent.type(screen.getByLabelText('Код приглашения'), 'WRONG');
    await userEvent.click(screen.getByRole('button', { name: 'Активировать' }));

    expect(await screen.findByText('Код приглашения неверен или истёк.')).toBeInTheDocument();
    expect(onActivated).not.toHaveBeenCalled();
  });
});
