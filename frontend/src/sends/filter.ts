import { endOfDayIso, startOfDayIso } from '../format';
import type { SendJob } from './types';

export interface SendFilter {
  author: string;
  /** Даты начала отправки из полей ввода (ГГГГ-ММ-ДД), обе включительно. */
  from: string;
  to: string;
  /** Часть темы или адреса получателя. */
  query: string;
}

export const NO_FILTER: SendFilter = { author: '', from: '', to: '', query: '' };

export function filterJobs(jobs: SendJob[], filter: SendFilter): SendJob[] {
  const since = startOfDayIso(filter.from);
  const before = endOfDayIso(filter.to);
  const query = filter.query.trim().toLowerCase();
  const matches = (job: SendJob) =>
    [job.subject, ...job.recipients.map((r) => r.email)].some((text) =>
      text.toLowerCase().includes(query),
    );

  return jobs.filter(
    (job) =>
      (!filter.author || job.author === filter.author) &&
      (!since || job.sendAt >= since) &&
      (!before || job.sendAt < before) &&
      (!query || matches(job)),
  );
}

export const authorsOf = (jobs: SendJob[]): string[] =>
  [...new Set(jobs.map((job) => job.author))].sort((a, b) => a.localeCompare(b));
