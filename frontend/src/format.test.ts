import { describe, expect, it } from 'vitest';
import { endOfDayIso, formatDateTime, startOfDayIso, totalPages } from './format';

describe('format', () => {
  it('formats a missing date as "never"', () => {
    expect(formatDateTime(null)).toBe('Не входил');
  });

  it('formats a date in Russian short form', () => {
    expect(formatDateTime('2026-03-01T09:05:00Z')).toMatch(/\d{2}\.\d{2}\.\d{4}/);
  });

  it('turns an empty date into undefined', () => {
    expect(startOfDayIso('')).toBeUndefined();
    expect(endOfDayIso('')).toBeUndefined();
  });

  it('makes the end boundary the start of the next local day', () => {
    const start = new Date(startOfDayIso('2026-03-01')!).getTime();
    const end = new Date(endOfDayIso('2026-03-01')!).getTime();

    expect(end - start).toBeGreaterThanOrEqual(23 * 3600 * 1000);
    expect(end - start).toBeLessThanOrEqual(25 * 3600 * 1000);
  });

  it('never returns fewer than one page', () => {
    expect(totalPages(0, 20)).toBe(1);
    expect(totalPages(41, 20)).toBe(3);
  });
});
