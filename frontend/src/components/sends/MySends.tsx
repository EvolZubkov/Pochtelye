import { Banner, EmptyState, Skeleton, Stack, Tabs } from '@universityrt/ui-kit';
import { useState } from 'react';
import { fetchFeatures } from '../../api/editor';
import type { Me } from '../../api/me';
import { useAsync, useReload } from '../../hooks/useAsync';
import { errorMessage, t } from '../../i18n';
import { sendsApi } from '../../sends/api';
import type { SendsApi } from '../../sends/api';
import { statusOf } from '../../sends/rules';
import type { SendJob, SendStatus } from '../../sends/types';
import { ConfirmModal } from '../ConfirmModal';
import { RecipientsModal } from './RecipientsModal';
import { SendEditModal } from './SendEditModal';
import { SendsTable } from './SendsTable';
import type { SendAction } from './SendsTable';

type Tab = 'queue' | 'sent' | 'failed' | 'canceled';

const TAB_STATUSES: Record<Tab, SendStatus[]> = {
  queue: ['scheduled', 'sending'],
  sent: ['sent'],
  failed: ['failed'],
  canceled: ['canceled'],
};
const TABS = Object.keys(TAB_STATUSES) as Tab[];

interface MySendsProps {
  role: Me['role'];
  api?: SendsApi;
}

type Dialog = { action: Exclude<SendAction, 'retry'>; job: SendJob } | null;

/** Администратор видит всё; остальным массовые рассылки показаны, если право не отнято. */
async function loadBulkRight(role: Me['role']): Promise<boolean> {
  if (role === 'admin') return true;
  try {
    return (await fetchFeatures()).bulk_mail !== false;
  } catch {
    return false;
  }
}

export function MySends({ role, api = sendsApi }: MySendsProps) {
  const [version, reload] = useReload();
  const sends = useAsync(api.list, [version]);
  const bulk = useAsync(() => loadBulkRight(role), [role]);
  const [tab, setTab] = useState<Tab>('queue');
  const [dialog, setDialog] = useState<Dialog>(null);
  const [failure, setFailure] = useState<unknown>(null);

  if (sends.status === 'error') return <Banner tone="error" title={errorMessage(sends.error)} />;
  if (sends.status === 'loading' || bulk.status !== 'ready') {
    return <Skeleton aria-label={t.common.loading} />;
  }

  const visible = sends.data.filter((job) => bulk.data || job.kind !== 'bulk');
  const inTab = (name: Tab) => visible.filter((job) => TAB_STATUSES[name].includes(statusOf(job)));
  const rows = inTab(tab);
  const done = () => {
    setDialog(null);
    reload();
  };
  const onAction = async (action: SendAction, job: SendJob) => {
    setFailure(null);
    if (action !== 'retry') return setDialog({ action, job });
    try {
      await api.retry(job.id);
      reload();
    } catch (error) {
      setFailure(error);
    }
  };

  return (
    <Stack gap={4}>
      <Banner tone="warning" title={t.sends.demoTitle}>
        {t.sends.demoHint}
      </Banner>
      <Tabs
        items={TABS.map((id) => ({ id, label: `${t.sends.tabs[id]} (${inTab(id).length})` }))}
        value={tab}
        onChange={setTab}
        hidePanel
        listAriaLabel={t.sends.tabsLabel}
      />
      {failure !== null && <Banner tone="error" title={errorMessage(failure)} />}
      {rows.length === 0 ? (
        <EmptyState title={t.sends.empty} />
      ) : (
        <SendsTable jobs={rows} onAction={onAction} />
      )}
      {dialog?.action === 'recipients' && (
        <RecipientsModal job={dialog.job} onClose={() => setDialog(null)} />
      )}
      {dialog?.action === 'edit' && (
        <SendEditModal
          job={dialog.job}
          onSave={(changes) => api.update(dialog.job.id, changes)}
          onSaved={done}
          onClose={() => setDialog(null)}
        />
      )}
      {dialog?.action === 'cancel' && (
        <ConfirmModal
          title={t.sends.cancelTitle}
          text={t.sends.cancelText}
          confirmLabel={t.sends.cancelConfirm}
          onConfirm={async () => {
            await api.cancel(dialog.job.id);
            done();
          }}
          onClose={() => setDialog(null)}
        />
      )}
    </Stack>
  );
}
