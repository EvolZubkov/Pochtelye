import { fetchMe } from '../api/me';
import type { Me } from '../api/me';
import { useAsync } from './useAsync';
import type { AsyncState } from './useAsync';

export const useMe = (): AsyncState<Me> => useAsync(fetchMe);
