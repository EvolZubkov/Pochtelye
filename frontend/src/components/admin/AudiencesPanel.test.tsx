import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import * as adminApi from '../../api/admin';
import { ApiError } from '../../api/client';
import { audience } from '../../test/fixtures';
import { AudiencesPanel } from './AudiencesPanel';

// Форма аудитории рисует ~60 контролов; в jsdom каждое действие пользователя заметно дороже.
const HEAVY_FORM_TIMEOUT_MS = 20_000;

const hr = audience({ id: 'a-2', name: 'HR', isDefault: false, userCount: 0, profile: { blocks: {} } });

beforeEach(() => {
  vi.spyOn(adminApi, 'fetchAudiences').mockResolvedValue([audience(), hr]);
});

afterEach(() => vi.restoreAllMocks());

describe('AudiencesPanel', () => {
  it('lists audiences, marks the default and hides destructive actions for it', async () => {
    render(<AudiencesPanel />);

    expect(await screen.findByText('HR')).toBeInTheDocument();
    expect(screen.getByText('По умолчанию', { selector: 'span' })).toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: 'Удалить' })).toHaveLength(1);
    expect(screen.getAllByRole('button', { name: 'Сделать основной' })).toHaveLength(1);
  });

  it('makes an audience the default', async () => {
    const update = vi.spyOn(adminApi, 'updateAudience').mockResolvedValue(hr);
    render(<AudiencesPanel />);
    await screen.findByText('HR');

    await userEvent.click(screen.getByRole('button', { name: 'Сделать основной' }));

    expect(update).toHaveBeenCalledWith('a-2', { isDefault: true });
  });

  it('shows the server error when deleting an audience that is in use', async () => {
    vi.spyOn(adminApi, 'deleteAudience').mockRejectedValue(new ApiError('audience_in_use', 'x', 409));
    render(<AudiencesPanel />);
    await screen.findByText('HR');

    await userEvent.click(screen.getByRole('button', { name: 'Удалить' }));
    const dialog = await screen.findByRole('dialog');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Удалить' }));

    expect(await within(dialog).findByText('Аудитория используется пользователями или группами.')).toBeInTheDocument();
  });

  it('deletes an unused audience after confirmation', async () => {
    const remove = vi.spyOn(adminApi, 'deleteAudience').mockResolvedValue({ id: 'a-2' });
    render(<AudiencesPanel />);
    await screen.findByText('HR');

    await userEvent.click(screen.getByRole('button', { name: 'Удалить' }));
    const dialog = await screen.findByRole('dialog');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Удалить' }));

    await waitFor(() => expect(remove).toHaveBeenCalledWith('a-2'));
  });

  it('creates a new audience from the default profile, toggling a block and a capability', async () => {
    const create = vi.spyOn(adminApi, 'createAudience').mockResolvedValue(hr);
    render(<AudiencesPanel />);
    await screen.findByText('HR');

    await userEvent.click(screen.getByRole('button', { name: 'Создать аудиторию' }));
    const dialog = await screen.findByRole('dialog');
    await userEvent.click(within(dialog).getByLabelText(/^Название/));
    await userEvent.paste('Новая');
    await userEvent.click(within(dialog).getByRole('checkbox', { name: 'Текст: Рамка' }));
    await userEvent.click(within(dialog).getByRole('checkbox', { name: 'Отправка письма' }));
    await userEvent.click(within(dialog).getByRole('button', { name: 'Сохранить' }));

    await waitFor(() => expect(create).toHaveBeenCalledOnce());
    const [input] = create.mock.calls[0];
    expect(input.name).toBe('Новая');
    expect(input.isDefault).toBe(false);
    expect(input.profile.blocks.text.capabilities).toEqual(['background', 'border']);
    expect(input.profile.blocks.text.defaults).toEqual({ size: 14 }); // чужие ключи сохранены
    expect(input.profile.features).toEqual({ exchange_send: true });
  }, HEAVY_FORM_TIMEOUT_MS);

  it('disables a block and drops its capability checkboxes', async () => {
    const update = vi.spyOn(adminApi, 'updateAudience').mockResolvedValue(hr);
    render(<AudiencesPanel />);
    await screen.findByText('HR');

    await userEvent.click(screen.getAllByRole('button', { name: 'Изменить' })[0]);
    const dialog = await screen.findByRole('dialog');
    await userEvent.click(within(dialog).getByRole('checkbox', { name: 'Текст' }));
    expect(within(dialog).queryByRole('checkbox', { name: 'Текст: Фон' })).not.toBeInTheDocument();
    await userEvent.click(within(dialog).getByRole('button', { name: 'Сохранить' }));

    await waitFor(() => expect(update).toHaveBeenCalledOnce());
    const [id, input] = update.mock.calls[0];
    expect(id).toBe('a-1');
    expect(input.profile?.blocks.text.enabled).toBe(false);
  }, HEAVY_FORM_TIMEOUT_MS);

  it('sets and clears the content padding', async () => {
    const create = vi.spyOn(adminApi, 'createAudience').mockResolvedValue(hr);
    render(<AudiencesPanel />);
    await screen.findByText('HR');

    await userEvent.click(screen.getByRole('button', { name: 'Создать аудиторию' }));
    const dialog = await screen.findByRole('dialog');
    await userEvent.click(within(dialog).getByLabelText(/^Название/));
    await userEvent.paste('P');
    const padding = within(dialog).getByLabelText(/Горизонтальный отступ/);
    await userEvent.click(padding);
    await userEvent.paste('24');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Сохранить' }));

    await waitFor(() => expect(create).toHaveBeenCalledOnce());
    expect(create.mock.calls[0][0].profile.contentPadding).toBe(24);
  }, HEAVY_FORM_TIMEOUT_MS);

  it('shows the empty state and load errors', async () => {
    vi.spyOn(adminApi, 'fetchAudiences').mockResolvedValue([]);
    const { unmount } = render(<AudiencesPanel />);
    expect(await screen.findByText('Аудиторий нет')).toBeInTheDocument();
    unmount();

    vi.spyOn(adminApi, 'fetchAudiences').mockRejectedValue(new ApiError('forbidden', 'x', 403));
    render(<AudiencesPanel />);
    expect(await screen.findByText('Недостаточно прав.')).toBeInTheDocument();
  });
});
