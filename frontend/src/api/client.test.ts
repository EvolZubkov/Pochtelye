import { afterEach, describe, expect, it, vi } from 'vitest';
import { ApiError, apiGet } from './client';

function mockFetch(body: unknown, status = 200) {
  vi.stubGlobal(
    'fetch',
    vi.fn().mockResolvedValue({ ok: status < 400, status, json: async () => body }),
  );
}

afterEach(() => vi.unstubAllGlobals());

describe('apiGet', () => {
  it('returns data from the envelope', async () => {
    mockFetch({ data: { status: 'ok' }, error: null, meta: null });

    await expect(apiGet('/api/health')).resolves.toEqual({ status: 'ok' });
  });

  it('throws ApiError with the backend error code', async () => {
    mockFetch({ data: null, error: { code: 'auth_missing', message: 'x' }, meta: null }, 401);

    await expect(apiGet('/api/me')).rejects.toMatchObject({ code: 'auth_missing', status: 401 });
  });

  it('throws network_error when fetch rejects', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('down')));

    await expect(apiGet('/api/me')).rejects.toMatchObject({ code: 'network_error' });
  });

  it('throws bad_response when the body is not JSON', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => {
          throw new SyntaxError('bad');
        },
      }),
    );

    const result = apiGet('/api/me');

    await expect(result).rejects.toBeInstanceOf(ApiError);
    await expect(result).rejects.toMatchObject({ code: 'bad_response' });
  });

  it('throws bad_response when data is empty without an error', async () => {
    mockFetch({ data: null, error: null, meta: null });

    await expect(apiGet('/api/me')).rejects.toMatchObject({ code: 'bad_response' });
  });
});
