import { apiGetPage, apiGet, apiSend, query } from './client';
import type { Page } from './client';
import type { Role } from './me';

export type UserStatus = 'invited' | 'active';

export interface AdminUser {
  id: string;
  sub: string | null;
  email: string | null;
  displayName: string | null;
  role: Role;
  audienceId: string | null;
  groupId: string | null;
  status: UserStatus;
  createdAt: string;
  lastSeenAt: string | null;
  inviteExpiresAt: string | null;
}

export interface UserWithInvite {
  user: AdminUser;
  inviteCode: string;
}

export interface UserInput {
  email: string;
  displayName: string | null;
  role: Role;
  audienceId: string | null;
  groupId: string | null;
}

export const USERS_PAGE_SIZE = 20;

export const fetchUsers = (page: number, search: string): Promise<Page<AdminUser>> =>
  apiGetPage<AdminUser>(`/api/admin/users${query({ page, limit: USERS_PAGE_SIZE, search })}`);

export const createUser = (input: UserInput): Promise<UserWithInvite> =>
  apiSend<UserWithInvite>('POST', '/api/admin/users', input);

export const updateUser = (id: string, input: Partial<UserInput>): Promise<AdminUser> =>
  apiSend<AdminUser>('PATCH', `/api/admin/users/${id}`, input);

export const deleteUser = (id: string): Promise<{ id: string }> =>
  apiSend('DELETE', `/api/admin/users/${id}`);

export const reissueInvite = (id: string): Promise<UserWithInvite> =>
  apiSend<UserWithInvite>('POST', `/api/admin/users/${id}/invite`);

export interface BlockProfile {
  enabled: boolean;
  capabilities: string[];
  [key: string]: unknown;
}

export interface AudienceProfile {
  name?: string;
  blocks: Record<string, BlockProfile>;
  contentPadding?: number;
  features?: Record<string, boolean>;
  [key: string]: unknown;
}

export interface Audience {
  id: string;
  name: string;
  profile: AudienceProfile;
  isDefault: boolean;
  userCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface AudienceInput {
  name: string;
  profile: AudienceProfile;
  isDefault: boolean;
}

export const fetchAudiences = (): Promise<Audience[]> => apiGet<Audience[]>('/api/admin/audiences');

export const createAudience = (input: AudienceInput): Promise<Audience> =>
  apiSend<Audience>('POST', '/api/admin/audiences', input);

export const updateAudience = (id: string, input: Partial<AudienceInput>): Promise<Audience> =>
  apiSend<Audience>('PATCH', `/api/admin/audiences/${id}`, input);

export const deleteAudience = (id: string): Promise<{ id: string }> =>
  apiSend('DELETE', `/api/admin/audiences/${id}`);

export interface Group {
  id: string;
  audienceId: string;
  name: string;
  features: Record<string, boolean>;
  /** Видимые категории общих шаблонов; null: видны все. */
  categories: string[] | null;
  /** Лимиты на будущее: сервер их пока не проверяет. */
  limits: Record<string, number>;
  userCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface GroupInput {
  audienceId: string;
  name: string;
  features: Record<string, boolean>;
  categories: string[] | null;
  limits: Record<string, number>;
}

export const fetchGroups = (): Promise<Group[]> => apiGet<Group[]>('/api/admin/groups');

export const createGroup = (input: GroupInput): Promise<Group> =>
  apiSend<Group>('POST', '/api/admin/groups', input);

export const updateGroup = (id: string, input: Partial<Omit<GroupInput, 'audienceId'>>): Promise<Group> =>
  apiSend<Group>('PATCH', `/api/admin/groups/${id}`, input);

export const deleteGroup = (id: string): Promise<{ id: string }> =>
  apiSend('DELETE', `/api/admin/groups/${id}`);

export type SendStatus = 'sent' | 'failed';

export interface SendRecord {
  id: string;
  senderId: string;
  senderEmail: string | null;
  sentAt: string;
  subject: string;
  recipients: string[];
  recipientCount: number;
  status: SendStatus;
  errorCode: string | null;
  templateId: string | null;
}

export interface SenderSummary {
  senderId: string;
  senderEmail: string | null;
  messages: number;
  recipients: number;
  failed: number;
  lastSentAt: string;
}

export interface SendLogFilter {
  senderId?: string;
  dateFrom?: string;
  dateTo?: string;
}

export const SEND_LOG_PAGE_SIZE = 20;

export const fetchSendLog = (page: number, filter: SendLogFilter): Promise<Page<SendRecord>> =>
  apiGetPage<SendRecord>(`/api/admin/send-log${query({ page, limit: SEND_LOG_PAGE_SIZE, ...filter })}`);

export const fetchSendSummary = (filter: SendLogFilter): Promise<SenderSummary[]> =>
  apiGet<SenderSummary[]>(`/api/admin/send-log/summary${query({ ...filter })}`);
