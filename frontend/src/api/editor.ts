import { apiGet } from './client';

export type Features = Partial<Record<'bulk_mail' | 'exchange_send', boolean>>;

/** Функции из профиля пользователя: аудитория с уточнениями группы. */
export const fetchFeatures = async (): Promise<Features> =>
  (await apiGet<{ features?: Features | null }>('/api/editor/profile')).features ?? {};
