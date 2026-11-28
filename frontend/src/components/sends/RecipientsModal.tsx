import { Modal, Table } from '@universityrt/ui-kit';
import { t } from '../../i18n';
import type { Recipient, SendJob } from '../../sends/types';

export function RecipientsModal({ job, onClose }: { job: SendJob; onClose: () => void }) {
  const columns = [
    { key: 'email', header: t.sends.recipient.email, render: (r: Recipient) => r.email },
    {
      key: 'status',
      header: t.sends.recipient.status,
      render: (r: Recipient) => t.sends.recipient.statuses[r.status],
    },
    {
      key: 'error',
      header: t.sends.recipient.error,
      render: (r: Recipient) => r.error ?? t.common.none,
    },
  ];

  return (
    <Modal open size="l" title={job.subject} description={`${t.sends.from}: ${job.from}`} onClose={onClose}>
      <Table columns={columns} rows={job.recipients} rowKey={(r) => r.email} />
    </Modal>
  );
}
