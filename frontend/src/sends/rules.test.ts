import { describe, expect, it } from 'vitest';
import {
  applyEdit,
  canCancel,
  canEditDetails,
  canEditRecipients,
  canRetry,
  cancelJob,
  parseRecipients,
  retryJob,
  statusOf,
} from './rules';
import type { RecipientStatus, SendJob } from './types';

const NOW = new Date('2026-12-01T10:00:00Z');
const LATER = '2026-12-02T10:00:00.000Z';

const job = (...statuses: RecipientStatus[]): SendJob => ({
  id: '1',
  kind: 'bulk',
  subject: 'Тема',
  from: 'me@rt.ru',
  sendAt: LATER,
  recipients: statuses.map((status, i) => ({ email: `r${i}@rt.ru`, status })),
});

const emails = (value: SendJob) => value.recipients.map((r) => `${r.email}:${r.status}`);

describe('statusOf', () => {
  it.each([
    [['pending', 'pending'], 'scheduled'],
    [['sent', 'pending'], 'sending'],
    [['failed', 'pending'], 'sending'],
    [['sending', 'canceled'], 'sending'],
    [['sent', 'failed'], 'failed'],
    [['sent', 'canceled'], 'sent'],
    [['canceled', 'canceled'], 'canceled'],
  ] as [RecipientStatus[], string][])('%j is %s', (statuses, expected) => {
    expect(statusOf(job(...statuses))).toBe(expected);
  });
});

describe('allowed actions', () => {
  it('allows everything before the start', () => {
    const scheduled = job('pending');

    expect([canEditDetails, canEditRecipients, canCancel, canRetry].map((f) => f(scheduled))).toEqual(
      [true, true, true, false],
    );
  });

  it('allows only unsent recipients to change once started', () => {
    const sending = job('sent', 'pending');

    expect([canEditDetails, canEditRecipients, canCancel].map((f) => f(sending))).toEqual([
      false,
      true,
      true,
    ]);
  });

  it('has nothing to cancel while only the last letter is in flight', () => {
    expect(canCancel(job('sent', 'sending'))).toBe(false);
  });

  it('allows retry only for failed sends', () => {
    expect(canRetry(job('sent', 'failed'))).toBe(true);
    expect(canRetry(job('sent'))).toBe(false);
  });
});

describe('applyEdit', () => {
  it('changes subject, time and recipients of a scheduled send without mutating it', () => {
    const original = job('pending');

    const edited = applyEdit(
      original,
      { subject: ' Новая ', sendAt: '2026-12-03T00:00:00.000Z', recipients: ['a@rt.ru'] },
      NOW,
    );

    expect(edited.subject).toBe('Новая');
    expect(edited.sendAt).toBe('2026-12-03T00:00:00.000Z');
    expect(emails(edited)).toEqual(['a@rt.ru:pending']);
    expect(original.subject).toBe('Тема');
    expect(emails(original)).toEqual(['r0@rt.ru:pending']);
  });

  it('keeps already processed recipients and never queues them twice', () => {
    const edited = applyEdit(job('sent', 'pending'), { recipients: ['r0@rt.ru', 'new@rt.ru'] }, NOW);

    expect(emails(edited)).toEqual(['r0@rt.ru:sent', 'new@rt.ru:pending']);
  });

  it('lets the unsent tail of a started send be removed completely', () => {
    const edited = applyEdit(job('sent', 'pending'), { recipients: [] }, NOW);

    expect(emails(edited)).toEqual(['r0@rt.ru:sent']);
  });

  it.each([
    ['not_editable', job('sent'), { recipients: ['a@rt.ru'] }],
    ['not_editable', job('sent', 'pending'), { subject: 'x' }],
    ['not_editable', job('sent', 'pending'), { sendAt: LATER.replace('02', '05') }],
    ['subject_required', job('pending'), { subject: '  ' }],
    ['time_in_past', job('pending'), { sendAt: '2026-11-01T00:00:00.000Z' }],
    ['recipients_required', job('pending'), { recipients: [] }],
    ['bad_email', job('pending'), { recipients: ['не почта'] }],
  ])('rejects with %s', (code, source, changes) => {
    expect(() => applyEdit(source, changes, NOW)).toThrow(expect.objectContaining({ code }));
  });
});

describe('cancelJob and retryJob', () => {
  it('cancels only what has not started', () => {
    const canceled = cancelJob(job('sent', 'sending', 'pending'));

    expect(canceled.recipients.map((r) => r.status)).toEqual(['sent', 'sending', 'canceled']);
  });

  it('refuses to cancel a finished send', () => {
    expect(() => cancelJob(job('sent'))).toThrow(
      expect.objectContaining({ code: 'not_editable' }),
    );
  });

  it('queues failed recipients again, now, without the old error', () => {
    const failed = job('sent', 'failed');
    const withError = {
      ...failed,
      recipients: [failed.recipients[0], { ...failed.recipients[1], error: 'нет ящика' }],
    };

    const retried = retryJob(withError, NOW);

    expect(retried.sendAt).toBe(NOW.toISOString());
    expect(retried.recipients[1]).toEqual({ email: 'r1@rt.ru', status: 'pending' });
    expect(retried.recipients[0].status).toBe('sent');
  });

  it('refuses to retry a send without failures', () => {
    expect(() => retryJob(job('sent'), NOW)).toThrow(
      expect.objectContaining({ code: 'not_editable' }),
    );
  });
});

describe('parseRecipients', () => {
  it('splits by lines, commas and semicolons, lowercases and removes duplicates', () => {
    expect(parseRecipients(' A@rt.ru, b@rt.ru;\na@rt.ru\n\n')).toEqual(['a@rt.ru', 'b@rt.ru']);
  });
});
