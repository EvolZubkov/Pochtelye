import { Button, Cluster, Table, Tag } from '@universityrt/ui-kit';
import { formatDateTime } from '../../format';
import { t } from '../../i18n';
import { canCancel, canEditRecipients, canRetry, sentCount, statusOf } from '../../sends/rules';
import type { SendJob } from '../../sends/types';

export type SendAction = 'recipients' | 'edit' | 'cancel' | 'retry';

interface SendsTableProps {
  jobs: SendJob[];
  isOwn: (job: SendJob) => boolean;
  showAuthor?: boolean;
  onAction: (action: SendAction, job: SendJob) => void;
}

interface Rule {
  action: SendAction;
  /** Изменять и повторять чужое письмо нельзя даже администратору. */
  authorOnly: boolean;
  allowed: (job: SendJob) => boolean;
}

const RULES: Rule[] = [
  { action: 'recipients', authorOnly: false, allowed: () => true },
  { action: 'edit', authorOnly: true, allowed: canEditRecipients },
  { action: 'retry', authorOnly: true, allowed: canRetry },
  { action: 'cancel', authorOnly: false, allowed: canCancel },
];

const canceledText = ({ canceled }: SendJob) =>
  canceled ? `${canceled.by}, ${formatDateTime(canceled.at)}` : t.common.none;

export function SendsTable({ jobs, isOwn, showAuthor, onAction }: SendsTableProps) {
  const columns = [
    { key: 'subject', header: t.sends.columns.subject, render: (j: SendJob) => j.subject },
    ...(showAuthor
      ? [{ key: 'author', header: t.sends.columns.author, render: (j: SendJob) => j.author }]
      : []),
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
    // Колонка нужна, только когда среди строк есть отменённые.
    ...(jobs.some((job) => job.canceled)
      ? [{ key: 'canceled', header: t.sends.columns.canceled, render: canceledText }]
      : []),
    {
      key: 'actions',
      header: t.sends.columns.actions,
      render: (j: SendJob) => (
        <Cluster gap={2}>
          {RULES.filter(({ authorOnly, allowed }) => (!authorOnly || isOwn(j)) && allowed(j)).map(
            ({ action }) => (
              <Button key={action} size="s" variant="secondary" onClick={() => onAction(action, j)}>
                {t.sends.actions[action]}
              </Button>
            ),
          )}
        </Cluster>
      ),
    },
  ];

  return <Table columns={columns} rows={jobs} rowKey={(job) => job.id} />;
}
