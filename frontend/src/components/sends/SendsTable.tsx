import { Button, Cluster, Table, Tag } from '@universityrt/ui-kit';
import { formatDateTime } from '../../format';
import { t } from '../../i18n';
import { canCancel, canEditRecipients, canRetry, sentCount, statusOf } from '../../sends/rules';
import type { SendJob } from '../../sends/types';

export type SendAction = 'recipients' | 'edit' | 'cancel' | 'retry';

interface SendsTableProps {
  jobs: SendJob[];
  onAction: (action: SendAction, job: SendJob) => void;
}

const ACTIONS: { action: SendAction; allowed: (job: SendJob) => boolean }[] = [
  { action: 'recipients', allowed: () => true },
  { action: 'edit', allowed: canEditRecipients },
  { action: 'retry', allowed: canRetry },
  { action: 'cancel', allowed: canCancel },
];

export function SendsTable({ jobs, onAction }: SendsTableProps) {
  const columns = [
    { key: 'subject', header: t.sends.columns.subject, render: (j: SendJob) => j.subject },
    { key: 'kind', header: t.sends.columns.kind, render: (j: SendJob) => t.sends.kinds[j.kind] },
    {
      key: 'sendAt',
      header: t.sends.columns.sendAt,
      render: (j: SendJob) => formatDateTime(j.sendAt),
    },
    {
      key: 'recipients',
      header: t.sends.columns.progress,
      render: (j: SendJob) => `${sentCount(j)} ${t.sends.of} ${j.recipients.length}`,
    },
    {
      key: 'status',
      header: t.sends.columns.status,
      render: (j: SendJob) => <Tag>{t.sends.statuses[statusOf(j)]}</Tag>,
    },
    {
      key: 'actions',
      header: t.sends.columns.actions,
      render: (j: SendJob) => (
        <Cluster gap={2}>
          {ACTIONS.filter(({ allowed }) => allowed(j)).map(({ action }) => (
            <Button key={action} size="s" variant="secondary" onClick={() => onAction(action, j)}>
              {t.sends.actions[action]}
            </Button>
          ))}
        </Cluster>
      ),
    },
  ];

  return <Table columns={columns} rows={jobs} rowKey={(job) => job.id} />;
}
