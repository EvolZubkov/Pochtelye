import { describe, expect, it } from 'vitest';
import { NO_FILTER, authorsOf, filterJobs } from './filter';
import type { SendJob } from './types';

const job = (id: string, author: string, sendAt: Date, subject = 'Тема'): SendJob => ({
  id,
  kind: 'letter',
  subject,
  author,
  from: author,
  sendAt: sendAt.toISOString(),
  recipients: [{ email: `to${id}@rt.ru`, status: 'pending' }],
});

const JOBS = [
  job('1', 'boris@rt.ru', new Date(2026, 11, 1, 0, 0), 'Отчёт'),
  job('2', 'anna@rt.ru', new Date(2026, 11, 2, 23, 59), 'Приглашение'),
  job('3', 'anna@rt.ru', new Date(2026, 11, 3, 0, 0), 'Опрос'),
];

const ids = (filter: Partial<typeof NO_FILTER>) =>
  filterJobs(JOBS, { ...NO_FILTER, ...filter }).map((j) => j.id);

describe('filterJobs', () => {
  it('returns everything without a filter', () => {
    expect(ids({})).toEqual(['1', '2', '3']);
  });

  it('filters by author', () => {
    expect(ids({ author: 'anna@rt.ru' })).toEqual(['2', '3']);
  });

  it('includes both chosen days in local time', () => {
    expect(ids({ from: '2026-12-01', to: '2026-12-02' })).toEqual(['1', '2']);
    expect(ids({ from: '2026-12-03' })).toEqual(['3']);
  });

  it('searches the subject and recipient addresses, ignoring case', () => {
    expect(ids({ query: ' опрос ' })).toEqual(['3']);
    expect(ids({ query: 'TO2@' })).toEqual(['2']);
    expect(ids({ query: 'нет такого' })).toEqual([]);
  });
});

describe('authorsOf', () => {
  it('lists each author once in alphabetical order', () => {
    expect(authorsOf(JOBS)).toEqual(['anna@rt.ru', 'boris@rt.ru']);
  });
});
