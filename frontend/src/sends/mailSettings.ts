import { ApiError } from '../api/client';
import { isEmail } from './rules';

export interface MailSettings {
  server: string;
  login: string;
  fromAddresses: string[];
  /** Сам пароль обратно не отдаётся никогда. */
  hasPassword: boolean;
}

export interface MailSettingsInput {
  server: string;
  login: string;
  /** Пустая строка: оставить прежний пароль. */
  password: string;
  fromAddresses: string[];
}

export interface MailSettingsApi {
  load: () => Promise<MailSettings>;
  save: (input: MailSettingsInput) => Promise<MailSettings>;
}

function reject(code: string): never {
  throw new ApiError(code, code, 400);
}

/** Демо: пароль проверяется на заполненность и сразу отбрасывается. */
export function createDemoMailSettingsApi(): MailSettingsApi {
  let stored: MailSettings = { server: '', login: '', fromAddresses: [], hasPassword: false };

  return {
    load: async () => stored,
    save: async ({ server, login, password, fromAddresses }) => {
      if (!server.trim() || !login.trim()) reject('connection_required');
      if (!password && !stored.hasPassword) reject('password_required');
      if (fromAddresses.some((address) => !isEmail(address))) reject('bad_email');
      stored = { server: server.trim(), login: login.trim(), fromAddresses, hasPassword: true };
      return stored;
    },
  };
}

export const mailSettingsApi = createDemoMailSettingsApi();
