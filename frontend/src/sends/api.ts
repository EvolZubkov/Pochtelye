import { ApiError } from '../api/client';
import { DEMO_OWNER, demoSends } from './demoData';
import { applyEdit, cancelJob, retryJob } from './rules';
import type { SendChanges, SendJob } from './types';

/** Контракт очереди отправок. Сейчас есть только демо; настоящая очередь заменит его. */
export interface SendsApi {
  /** Отправки текущего пользователя. */
  list: () => Promise<SendJob[]>;
  /** Своя ли отправка: изменять и повторять может только автор. */
  isOwn: (job: SendJob) => boolean;
  /** Отправки всех пользователей: только для администратора. */
  listAll: () => Promise<SendJob[]>;
  update: (id: string, changes: SendChanges) => Promise<void>;
  /** `actor` нужен только демо: настоящий сервер берёт автора действия из токена. */
  cancel: (id: string, actor: string) => Promise<void>;
  retry: (id: string) => Promise<void>;
}

const isOwn = (job: SendJob) => job.author === DEMO_OWNER;

/** Живёт в памяти вкладки: перезагрузка страницы возвращает исходные данные. */
export function createDemoSendsApi(clock: () => Date = () => new Date()): SendsApi {
  let jobs = demoSends(clock());

  const find = (id: string) => {
    const found = jobs.find((job) => job.id === id);
    if (!found) throw new ApiError('send_not_found', 'send_not_found', 404);
    return found;
  };
  const change = async (id: string, apply: (job: SendJob) => SendJob) => {
    const next = apply(find(id));
    jobs = jobs.map((job) => (job.id === id ? next : job));
  };
  const changeOwn = async (id: string, apply: (job: SendJob) => SendJob) => {
    if (!isOwn(find(id))) throw new ApiError('forbidden', 'forbidden', 403);
    await change(id, apply);
  };

  return {
    list: async () => jobs.filter(isOwn),
    isOwn,
    listAll: async () => jobs,
    update: (id, changes) => changeOwn(id, (job) => applyEdit(job, changes, clock())),
    cancel: (id, actor) => change(id, (job) => cancelJob(job, actor, clock())),
    retry: (id) => changeOwn(id, (job) => retryJob(job, clock())),
  };
}

export const sendsApi = createDemoSendsApi();
