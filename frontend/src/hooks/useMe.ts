import { useEffect, useState } from 'react';
import { fetchMe } from '../api/me';
import type { Me } from '../api/me';

export type MeState =
  | { status: 'loading' }
  | { status: 'ready'; me: Me }
  | { status: 'error'; error: unknown };

export function useMe(): MeState {
  const [state, setState] = useState<MeState>({ status: 'loading' });

  useEffect(() => {
    let cancelled = false;
    fetchMe()
      .then((me) => !cancelled && setState({ status: 'ready', me }))
      .catch((error: unknown) => !cancelled && setState({ status: 'error', error }));
    return () => {
      cancelled = true;
    };
  }, []);

  return state;
}
