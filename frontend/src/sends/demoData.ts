/** Выдуманные отправки для интерфейса, пока нет очереди. Времена отсчитываются от now. */
import type { Recipient, RecipientStatus, SendJob } from './types';

const HOUR = 3_600_000;
const SENDER = 'sender@example.com';

const people = (...statuses: RecipientStatus[]): Recipient[] =>
  statuses.map((status, index) => ({
    email: `user${index + 1}@example.com`,
    status,
    ...(status === 'failed' ? { error: 'Ящик получателя не найден' } : {}),
  }));

export function demoSends(now: Date): SendJob[] {
  const at = (hours: number) => new Date(now.getTime() + hours * HOUR).toISOString();
  const job = (
    id: string,
    kind: SendJob['kind'],
    subject: string,
    hours: number,
    recipients: Recipient[],
  ): SendJob => ({ id, kind, subject, from: SENDER, sendAt: at(hours), recipients });

  return [
    job('1', 'letter', 'Приглашение на вебинар', 26, people('pending', 'pending', 'pending')),
    job('2', 'bulk', 'Новости недели', -1, people('sent', 'sent', 'sending', 'pending', 'pending')),
    job('3', 'letter', 'Отчёт за квартал', -30, people('sent', 'sent')),
    job('4', 'bulk', 'Опрос о столовой', -5, people('sent', 'failed', 'sent')),
    job('5', 'meeting', 'Встреча команды', 48, people('canceled', 'canceled')),
  ];
}
