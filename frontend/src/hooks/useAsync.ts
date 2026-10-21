import { useCallback, useEffect, useState } from 'react';

export type AsyncState<T> =
  | { status: 'loading' }
  | { status: 'ready'; data: T }
  | { status: 'error'; error: unknown };

/**
 * Загрузка при монтировании и при смене deps; устаревший ответ игнорируется.
 * `load` читается в момент запуска, поэтому его ссылка не должна быть в deps.
 */
export function useAsync<T>(load: () => Promise<T>, deps: readonly unknown[] = []): AsyncState<T> {
  const [state, setState] = useState<AsyncState<T>>({ status: 'loading' });

  useEffect(() => {
    let cancelled = false;
    setState((previous) => (previous.status === 'ready' ? previous : { status: 'loading' }));
    load()
      .then((data) => !cancelled && setState({ status: 'ready', data }))
      .catch((error: unknown) => !cancelled && setState({ status: 'error', error }));
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  return state;
}

/** Счётчик для ручной перезагрузки: положите `version` в deps useAsync и вызовите `reload()`. */
export function useReload(): [number, () => void] {
  const [version, setVersion] = useState(0);
  const reload = useCallback(() => setVersion((value) => value + 1), []);
  return [version, reload];
}
