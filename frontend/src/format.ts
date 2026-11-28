import { t } from './i18n';

export function formatDateTime(iso: string | null): string {
  if (!iso) return t.common.never;
  return new Date(iso).toLocaleString('ru-RU', { dateStyle: 'short', timeStyle: 'short' });
}

/** Начало локального дня в ISO (UTC) для фильтра «с даты». */
export function startOfDayIso(date: string): string | undefined {
  return date ? new Date(`${date}T00:00:00`).toISOString() : undefined;
}

/** Начало следующего дня: верхняя граница фильтра «по дату» включает выбранный день. */
export function endOfDayIso(date: string): string | undefined {
  if (!date) return undefined;
  const next = new Date(`${date}T00:00:00`);
  next.setDate(next.getDate() + 1);
  return next.toISOString();
}

export function totalPages(total: number, pageSize: number): number {
  return Math.max(1, Math.ceil(total / pageSize));
}

const MINUTE_MS = 60_000;

/** Значение для поля datetime-local: местное время без часового пояса. */
export function toLocalInput(iso: string): string {
  const date = new Date(iso);
  return new Date(date.getTime() - date.getTimezoneOffset() * MINUTE_MS).toISOString().slice(0, 16);
}

/** Обратно в ISO (UTC). Пустое поле даёт пустую строку: правила отклонят такое время. */
export function fromLocalInput(value: string): string {
  return value ? new Date(value).toISOString() : '';
}
