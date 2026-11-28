import { describe, expect, it } from 'vitest';
import { createDemoSendsApi } from './api';
import { DEMO_OWNER } from './demoData';

const NOW = new Date('2026-12-01T10:00:00Z');
const demo = () => createDemoSendsApi(() => NOW);

describe('demo sends', () => {
  it('lists only own sends to the owner and everything to the administrator', async () => {
    const api = demo();

    const own = await api.list();
    const all = await api.listAll();

    expect(own.every((job) => job.author === DEMO_OWNER)).toBe(true);
    expect(all.length).toBeGreaterThan(own.length);
  });

  it('records who canceled and when', async () => {
    const api = demo();

    await api.cancel('1', 'admin@rt.ru');

    const found = (await api.listAll()).find((job) => job.id === '1');
    expect(found?.canceled).toEqual({ by: 'admin@rt.ru', at: NOW.toISOString() });
  });

  it('lets only the author change or resend', async () => {
    const api = demo();

    await expect(api.update('6', { subject: 'Чужая' })).rejects.toMatchObject({
      code: 'forbidden',
    });
    await expect(api.retry('8')).rejects.toMatchObject({ code: 'forbidden' });
  });

  it('rejects an unknown send', async () => {
    await expect(demo().retry('nope')).rejects.toMatchObject({ code: 'send_not_found' });
  });
});
