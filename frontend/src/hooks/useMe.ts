import { fetchMe } from '../api/me';
import type { Me } from '../api/me';
import { useAsync } from './useAsync';
import type { AsyncState } from './useAsync';

/** `version` меняется после активации, чтобы заново запросить профиль. */
export const useMe = (version = 0): AsyncState<Me> => useAsync(fetchMe, [version]);
