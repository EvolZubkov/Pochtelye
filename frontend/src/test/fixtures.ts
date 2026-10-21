import type { AdminUser, Audience, SendRecord, SenderSummary } from '../api/admin';

export const adminUser = (over: Partial<AdminUser> = {}): AdminUser => ({
  id: 'u-1',
  sub: 'sub-1',
  email: 'anna@rt.ru',
  displayName: 'Анна',
  role: 'editor',
  audienceId: null,
  status: 'active',
  createdAt: '2026-01-01T00:00:00Z',
  lastSeenAt: '2026-02-01T10:00:00Z',
  inviteExpiresAt: null,
  ...over,
});

export const audience = (over: Partial<Audience> = {}): Audience => ({
  id: 'a-1',
  name: 'По умолчанию',
  profile: { blocks: { text: { enabled: true, capabilities: ['background'], defaults: { size: 14 } } } },
  isDefault: true,
  userCount: 2,
  createdAt: '2026-01-01T00:00:00Z',
  updatedAt: '2026-01-01T00:00:00Z',
  ...over,
});

export const sendRecord = (over: Partial<SendRecord> = {}): SendRecord => ({
  id: 's-1',
  senderId: 'u-1',
  senderEmail: 'anna@rt.ru',
  sentAt: '2026-03-01T09:00:00Z',
  subject: 'Приглашение',
  recipients: ['x@rt.ru', 'y@rt.ru'],
  recipientCount: 2,
  status: 'sent',
  errorCode: null,
  templateId: null,
  ...over,
});

export const senderSummary = (over: Partial<SenderSummary> = {}): SenderSummary => ({
  senderId: 'u-1',
  senderEmail: 'anna@rt.ru',
  messages: 3,
  recipients: 12,
  failed: 1,
  lastSentAt: '2026-03-01T09:00:00Z',
  ...over,
});
