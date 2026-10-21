import { act, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { parseRoute, useHashRoute } from './useHashRoute';

afterEach(() => {
  window.location.hash = '';
});

describe('parseRoute', () => {
  it('maps known hashes to routes', () => {
    expect(parseRoute('#/editor')).toBe('editor');
    expect(parseRoute('#/home')).toBe('home');
  });

  it('falls back to home for unknown or empty hashes', () => {
    expect(parseRoute('')).toBe('home');
    expect(parseRoute('#/nope')).toBe('home');
    expect(parseRoute('#editor')).toBe('home');
  });
});

describe('useHashRoute', () => {
  it('navigates by changing the hash and reacts to hashchange', () => {
    const { result } = renderHook(() => useHashRoute());
    expect(result.current[0]).toBe('home');

    act(() => {
      result.current[1]('editor');
      window.dispatchEvent(new HashChangeEvent('hashchange'));
    });

    expect(window.location.hash).toBe('#/editor');
    expect(result.current[0]).toBe('editor');
  });
});
