import { t } from '../i18n';
import { statusOf } from './rules';
import type { SendJob, SendStatus } from './types';

export type SendTab = 'queue' | 'sent' | 'failed' | 'canceled';

const TAB_STATUSES: Record<SendTab, SendStatus[]> = {
  queue: ['scheduled', 'sending'],
  sent: ['sent'],
  failed: ['failed'],
  canceled: ['canceled'],
};

export const jobsInTab = (jobs: SendJob[], tab: SendTab): SendJob[] =>
  jobs.filter((job) => TAB_STATUSES[tab].includes(statusOf(job)));

/** Вкладки состояний со счётчиками. */
export const tabItems = (jobs: SendJob[]) =>
  (Object.keys(TAB_STATUSES) as SendTab[]).map((id) => ({
    id,
    label: `${t.sends.tabs[id]} (${jobsInTab(jobs, id).length})`,
  }));
