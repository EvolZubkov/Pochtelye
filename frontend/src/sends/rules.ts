/**
 * Что можно делать с отправкой (ADR-0005). До начала меняется всё; после начала только
 * ещё не отправленные получатели. Сервер очереди должен проверять те же правила.
 */
import { ApiError } from '../api/client';
import type { Recipient, RecipientStatus, SendChanges, SendJob, SendStatus } from './types';

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export const isEmail = (value: string): boolean => EMAIL.test(value);

export function parseRecipients(text: string): string[] {
  const parts = text.split(/[\n,;]/).map((part) => part.trim().toLowerCase());
  return [...new Set(parts.filter((part) => part !== ''))];
}

const count = (job: SendJob, status: RecipientStatus) =>
  job.recipients.filter((r) => r.status === status).length;

export function statusOf(job: SendJob): SendStatus {
  const pending = count(job, 'pending');
  const processed = count(job, 'sent') + count(job, 'failed');
  if (count(job, 'sending') > 0 || (pending > 0 && processed > 0)) return 'sending';
  if (pending > 0) return 'scheduled';
  if (count(job, 'failed') > 0) return 'failed';
  return count(job, 'sent') > 0 ? 'sent' : 'canceled';
}

export const sentCount = (job: SendJob): number => count(job, 'sent');

export const canEditDetails = (job: SendJob): boolean => statusOf(job) === 'scheduled';
export const canEditRecipients = (job: SendJob): boolean =>
  ['scheduled', 'sending'].includes(statusOf(job));
export const canCancel = (job: SendJob): boolean => count(job, 'pending') > 0;
export const canRetry = (job: SendJob): boolean => statusOf(job) === 'failed';

function reject(code: string): never {
  throw new ApiError(code, code, 400);
}

function replacePending(job: SendJob, emails: string[]): Recipient[] {
  if (emails.some((email) => !isEmail(email))) reject('bad_email');
  const locked = job.recipients.filter((r) => r.status !== 'pending');
  const taken = new Set(locked.map((r) => r.email));
  const added = emails
    .filter((email) => !taken.has(email))
    .map((email): Recipient => ({ email, status: 'pending' }));
  if (locked.length + added.length === 0 || (statusOf(job) === 'scheduled' && added.length === 0)) {
    reject('recipients_required');
  }
  return [...locked, ...added];
}

export function applyEdit(job: SendJob, changes: SendChanges, now: Date): SendJob {
  const { subject, sendAt, recipients } = changes;
  const touchesDetails = subject !== undefined || sendAt !== undefined;
  if (!canEditRecipients(job) || (touchesDetails && !canEditDetails(job))) reject('not_editable');
  if (subject !== undefined && subject.trim() === '') reject('subject_required');
  if (sendAt !== undefined && !(new Date(sendAt) > now)) reject('time_in_past');
  return {
    ...job,
    subject: subject?.trim() ?? job.subject,
    sendAt: sendAt ?? job.sendAt,
    recipients: recipients ? replacePending(job, recipients) : job.recipients,
  };
}

export function cancelJob(job: SendJob, by: string, now: Date): SendJob {
  if (!canCancel(job)) reject('not_editable');
  return {
    ...job,
    canceled: { by, at: now.toISOString() },
    recipients: job.recipients.map((r) =>
      r.status === 'pending' ? { ...r, status: 'canceled' } : r,
    ),
  };
}

export function retryJob(job: SendJob, now: Date): SendJob {
  if (!canRetry(job)) reject('not_editable');
  return {
    ...job,
    sendAt: now.toISOString(),
    recipients: job.recipients.map((r) =>
      r.status === 'failed' ? { email: r.email, status: 'pending' } : r,
    ),
  };
}
