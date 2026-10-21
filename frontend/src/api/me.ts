import { apiGet, apiSend } from './client';

export type Role = 'admin' | 'editor' | 'viewer';

export interface Me {
  id: string;
  sub: string | null;
  role: Role;
  displayName: string | null;
  email: string | null;
  audienceId: string | null;
}

export const fetchMe = (): Promise<Me> => apiGet<Me>('/api/me');

export const activate = (code: string): Promise<Me> => apiSend<Me>('POST', '/api/me/activate', { code });
