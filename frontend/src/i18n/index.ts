import { ApiError } from '../api/client';
import { ru } from './ru';
import type { ErrorCode } from './ru';

/** Единственный язык пока ru; сюда подключится выбор локали. */
export const t = ru;

export function errorMessage(error: unknown): string {
  const code = error instanceof ApiError ? error.code : 'unknown';
  return code in t.errors ? t.errors[code as ErrorCode] : t.errors.unknown;
}
