import { apiGet } from './client';

export type Role = 'admin' | 'editor' | 'viewer';

export interface Me {
  sub: string;
  role: Role;
  displayName: string | null;
  email: string | null;
}

export const fetchMe = (): Promise<Me> => apiGet<Me>('/api/me');
