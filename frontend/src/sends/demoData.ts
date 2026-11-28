/** Выдуманные отправки для интерфейса, пока нет очереди. Времена отсчитываются от now. */
import type { Recipient, RecipientStatus, SendJob } from './types';

const HOUR = 3_600_000;
/** Автор «своих» отправок: их видит пользователь в разделе «Мои отправки». */
export const DEMO_OWNER = 'sender@example.com';
const ANNA = 'anna.petrova@example.com';
const OLEG = 'oleg.smirnov@example.com';

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
    author = DEMO_OWNER,
  ): SendJob => ({ id, kind, subject, author, from: author, sendAt: at(hours), recipients });

  return [
    job('1', 'letter', 'Приглашение на вебинар', 26, people('pending', 'pending', 'pending')),
    job('2', 'bulk', 'Новости недели', -1, people('sent', 'sent', 'sending', 'pending', 'pending')),
    job('3', 'letter', 'Отчёт за квартал', -30, people('sent', 'sent')),
    job('4', 'bulk', 'Опрос о столовой', -5, people('sent', 'failed', 'sent')),
    {
      ...job('5', 'meeting', 'Встреча команды', 48, people('canceled', 'canceled')),
      canceled: { by: DEMO_OWNER, at: at(-2) },
    },
    job(
      '6',
      'letter',
      'Анонс обучения',
      3,
      [{ email: 'partner@example.com', status: 'pending' }],
      ANNA,
    ),
    job('7', 'bulk', 'Дайджест отдела', -50, people('sent', 'sent', 'sent'), ANNA),
    job('8', 'bulk', 'Напоминание об отпусках', -20, people('failed', 'failed'), OLEG),
  ];
}
