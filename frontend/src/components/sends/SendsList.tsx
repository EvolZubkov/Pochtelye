import { Banner, EmptyState, Stack } from '@universityrt/ui-kit';
import { useState } from 'react';
import { errorMessage, t } from '../../i18n';
import type { SendsApi } from '../../sends/api';
import type { SendJob } from '../../sends/types';
import { ConfirmModal } from '../ConfirmModal';
import { RecipientsModal } from './RecipientsModal';
import { SendEditModal } from './SendEditModal';
import { SendsTable } from './SendsTable';
import type { SendAction } from './SendsTable';

interface SendsListProps {
  jobs: SendJob[];
  api: SendsApi;
  /** Кто выполняет действия. */
  actor: string;
  showAuthor?: boolean;
  onChanged: () => void;
}

type Dialog = { action: Exclude<SendAction, 'retry'>; job: SendJob } | null;

/** Таблица отправок вместе с окнами и действиями над ними. */
export function SendsList({ jobs, api, actor, showAuthor, onChanged }: SendsListProps) {
  const [dialog, setDialog] = useState<Dialog>(null);
  const [failure, setFailure] = useState<unknown>(null);

  const close = () => setDialog(null);
  const done = () => {
    close();
    onChanged();
  };
  const onAction = async (action: SendAction, job: SendJob) => {
    setFailure(null);
    if (action !== 'retry') return setDialog({ action, job });
    try {
      await api.retry(job.id);
      onChanged();
    } catch (error) {
      setFailure(error);
    }
  };

  return (
    <Stack gap={4}>
      {failure !== null && <Banner tone="error" title={errorMessage(failure)} />}
      {jobs.length === 0 ? (
        <EmptyState title={t.sends.empty} />
      ) : (
        <SendsTable jobs={jobs} isOwn={api.isOwn} showAuthor={showAuthor} onAction={onAction} />
      )}
      {dialog?.action === 'recipients' && <RecipientsModal job={dialog.job} onClose={close} />}
      {dialog?.action === 'edit' && (
        <SendEditModal
          job={dialog.job}
          onSave={(changes) => api.update(dialog.job.id, changes)}
          onSaved={done}
          onClose={close}
        />
      )}
      {dialog?.action === 'cancel' && (
        <ConfirmModal
          title={t.sends.cancelTitle}
          text={t.sends.cancelText}
          confirmLabel={t.sends.cancelConfirm}
          onConfirm={async () => {
            await api.cancel(dialog.job.id, actor);
            done();
          }}
          onClose={close}
        />
      )}
    </Stack>
  );
}
