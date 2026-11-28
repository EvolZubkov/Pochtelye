export type RecipientStatus = 'pending' | 'sending' | 'sent' | 'failed' | 'canceled';
export type SendStatus = 'scheduled' | 'sending' | 'sent' | 'failed' | 'canceled';
export type SendKind = 'letter' | 'meeting' | 'bulk';

export interface Recipient {
  email: string;
  status: RecipientStatus;
  error?: string;
}

/** Отправка в очереди. Статус не хранится: он следует из статусов получателей. */
export interface SendJob {
  id: string;
  kind: SendKind;
  subject: string;
  from: string;
  /** ISO-время начала отправки. */
  sendAt: string;
  recipients: Recipient[];
}

export interface SendChanges {
  subject?: string;
  sendAt?: string;
  /** Новый список ещё не отправленных получателей. */
  recipients?: string[];
}
