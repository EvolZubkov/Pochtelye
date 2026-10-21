export interface ApiErrorBody {
  code: string;
  message: string;
}

export interface Envelope<T> {
  data: T | null;
  error: ApiErrorBody | null;
  meta: Record<string, unknown> | null;
}

export interface Page<T> {
  items: T[];
  total: number;
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

type Method = 'GET' | 'POST' | 'PATCH' | 'DELETE';

async function request<T>(method: Method, path: string, body?: unknown): Promise<Envelope<T>> {
  const headers: Record<string, string> = { Accept: 'application/json' };
  const init: RequestInit = { method, headers };
  if (body !== undefined) {
    headers['Content-Type'] = 'application/json';
    init.body = JSON.stringify(body);
  }

  let response: Response;
  try {
    response = await fetch(path, init);
  } catch {
    throw new ApiError(NETWORK_ERROR_CODE, 'Network error', 0);
  }

  let envelope: Envelope<T>;
  try {
    envelope = (await response.json()) as Envelope<T>;
  } catch {
    throw new ApiError(BAD_RESPONSE_CODE, 'Response is not JSON', response.status);
  }

  if (envelope.error) {
    throw new ApiError(envelope.error.code, envelope.error.message, response.status);
  }
  if (!response.ok || envelope.data === null) {
    throw new ApiError(BAD_RESPONSE_CODE, 'Empty response', response.status);
  }
  return envelope;
}

export async function apiGet<T>(path: string): Promise<T> {
  return (await request<T>('GET', path)).data as T;
}

export async function apiGetPage<T>(path: string): Promise<Page<T>> {
  const envelope = await request<T[]>('GET', path);
  const total = envelope.meta?.total;
  return { items: envelope.data as T[], total: typeof total === 'number' ? total : 0 };
}

export async function apiSend<T>(method: Exclude<Method, 'GET'>, path: string, body?: unknown): Promise<T> {
  return (await request<T>(method, path, body)).data as T;
}

/** Строка запроса без пустых значений. */
export function query(params: Record<string, string | number | undefined | null>): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null && value !== '') search.set(key, String(value));
  }
  const text = search.toString();
  return text ? `?${text}` : '';
}
