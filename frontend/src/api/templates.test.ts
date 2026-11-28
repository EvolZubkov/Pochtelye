import { afterEach, describe, expect, it, vi } from 'vitest';
import * as client from './client';
import { fetchTemplates } from './templates';
import type { TemplateSummary } from './templates';

const items = (from: number, count: number) =>
  Array.from({ length: count }, (_, i) => ({ id: String(from + i) }) as TemplateSummary);

afterEach(() => vi.restoreAllMocks());

describe('fetchTemplates', () => {
  it('collects every page', async () => {
    const get = vi
      .spyOn(client, 'apiGetPage')
      .mockResolvedValueOnce({ items: items(0, 200), total: 201 })
      .mockResolvedValueOnce({ items: items(200, 1), total: 201 });

    const page = await fetchTemplates();

    expect(page.items).toHaveLength(201);
    expect(get.mock.calls.map(([path]) => path)).toEqual([
      '/api/templates?limit=200&page=1',
      '/api/templates?limit=200&page=2',
    ]);
  });

  it('stops when the server returns an empty page', async () => {
    const get = vi.spyOn(client, 'apiGetPage').mockResolvedValue({ items: [], total: 10 });

    const page = await fetchTemplates();

    expect(page.items).toEqual([]);
    expect(get).toHaveBeenCalledTimes(1);
  });
});
