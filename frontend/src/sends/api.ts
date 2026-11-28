import { ApiError } from '../api/client';
import { demoSends } from './demoData';
import { applyEdit, cancelJob, retryJob } from './rules';
import type { SendChanges, SendJob } from './types';

/** Контракт очереди отправок. Сейчас есть только демо; настоящая очередь заменит его. */
export interface SendsApi {
  list: () => Promise<SendJob[]>;
  update: (id: string, changes: SendChanges) => Promise<void>;
  cancel: (id: string) => Promise<void>;
  retry: (id: string) => Promise<void>;
}

/** Живёт в памяти вкладки: перезагрузка страницы возвращает исходные данные. */
export function createDemoSendsApi(clock: () => Date = () => new Date()): SendsApi {
  let jobs = demoSends(clock());

  const change = async (id: string, apply: (job: SendJob) => SendJob) => {
    const found = jobs.find((job) => job.id === id);
    if (!found) throw new ApiError('send_not_found', 'send_not_found', 404);
    const next = apply(found);
    jobs = jobs.map((job) => (job.id === id ? next : job));
  };

  return {
    list: async () => jobs,
    update: (id, changes) => change(id, (job) => applyEdit(job, changes, clock())),
    cancel: (id) => change(id, cancelJob),
    retry: (id) => change(id, (job) => retryJob(job, clock())),
  };
}

export const sendsApi = createDemoSendsApi();
