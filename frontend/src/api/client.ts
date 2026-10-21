export interface ApiErrorBody {
  code: string;
  message: string;
}

export interface Envelope<T> {
  data: T | null;
  error: ApiErrorBody | null;
  meta: Record<string, unknown> | null;
}

/** Ошибка API с кодом: текст по коду подбирает i18n, а не бэкенд. */
export class ApiError extends Error {
  constructor(
    readonly code: string,
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

const NETWORK_ERROR_CODE = 'network_error';
const BAD_RESPONSE_CODE = 'bad_response';

export async function apiGet<T>(path: string): Promise<T> {
  let response: Response;
  try {
    response = await fetch(path, { headers: { Accept: 'application/json' } });
  } catch {
    throw new ApiError(NETWORK_ERROR_CODE, 'Network error', 0);
  }

  let body: Envelope<T>;
  try {
    body = (await response.json()) as Envelope<T>;
  } catch {
    throw new ApiError(BAD_RESPONSE_CODE, 'Response is not JSON', response.status);
  }

  if (body.error) {
    throw new ApiError(body.error.code, body.error.message, response.status);
  }
  if (!response.ok || body.data === null) {
    throw new ApiError(BAD_RESPONSE_CODE, 'Empty response', response.status);
  }
  return body.data;
}
