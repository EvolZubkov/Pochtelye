import {
  Banner,
  Button,
  Cluster,
  EmptyState,
  Input,
  Pagination,
  Select,
  Skeleton,
  Stack,
  Table,
  TableChip,
} from '@universityrt/ui-kit';
import { useState } from 'react';
import { SEND_LOG_PAGE_SIZE, fetchSendLog, fetchSendSummary } from '../../api/admin';
import type { SendLogFilter, SendRecord, SenderSummary } from '../../api/admin';
import { endOfDayIso, formatDateTime, startOfDayIso, totalPages } from '../../format';
import { useAsync } from '../../hooks/useAsync';
import { errorMessage, t } from '../../i18n';

const ALL_SENDERS = '';

export function SendLogPanel() {
  const [senderId, setSenderId] = useState(ALL_SENDERS);
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [page, setPage] = useState(1);
  const [expanded, setExpanded] = useState<string[]>([]);

  const filter: SendLogFilter = {
    senderId: senderId || undefined,
    dateFrom: startOfDayIso(dateFrom),
    dateTo: endOfDayIso(dateTo),
  };
  const deps = [senderId, dateFrom, dateTo];
  const summary = useAsync(() => fetchSendSummary({ dateFrom: filter.dateFrom, dateTo: filter.dateTo }), [
    dateFrom,
    dateTo,
  ]);
  const log = useAsync(() => fetchSendLog(page, filter), [...deps, page]);

  const change = (apply: () => void) => {
    apply();
    setPage(1);
    setExpanded([]);
  };

  const senderLabel = (id: string, email: string | null) => email ?? id;
  const senderOptions = [
    { value: ALL_SENDERS, label: t.common.all },
    ...(summary.status === 'ready'
      ? summary.data.map((row) => ({ value: row.senderId, label: senderLabel(row.senderId, row.senderEmail) }))
      : []),
  ];

  const summaryColumns = [
    { key: 'sender', header: t.admin.sendLog.columns.sender, render: (r: SenderSummary) => senderLabel(r.senderId, r.senderEmail) },
    { key: 'messages', header: t.admin.sendLog.columns.messages, numeric: true, render: (r: SenderSummary) => r.messages },
    { key: 'recipients', header: t.admin.sendLog.columns.recipients, numeric: true, render: (r: SenderSummary) => r.recipients },
    { key: 'failed', header: t.admin.sendLog.columns.failed, numeric: true, render: (r: SenderSummary) => r.failed },
    { key: 'last', header: t.admin.sendLog.columns.last, render: (r: SenderSummary) => formatDateTime(r.lastSentAt) },
  ];

  const toggle = (id: string) =>
    setExpanded((current) => (current.includes(id) ? current.filter((x) => x !== id) : [...current, id]));

  const logColumns = [
    { key: 'sentAt', header: t.admin.sendLog.columns.sentAt, render: (r: SendRecord) => formatDateTime(r.sentAt) },
    { key: 'sender', header: t.admin.sendLog.columns.sender, render: (r: SendRecord) => senderLabel(r.senderId, r.senderEmail) },
    { key: 'subject', header: t.admin.sendLog.columns.subject, render: (r: SendRecord) => r.subject },
    {
      key: 'recipients',
      header: t.admin.sendLog.columns.recipients,
      numeric: true,
      render: (r: SendRecord) => (
        <Button size="s" variant="ghost" onClick={() => toggle(r.id)} aria-expanded={expanded.includes(r.id)}>
          {r.recipientCount}
        </Button>
      ),
    },
    {
      key: 'status',
      header: t.admin.sendLog.columns.status,
      render: (r: SendRecord) => (
        <TableChip tone={r.status === 'sent' ? 'success' : 'error'}>{t.admin.sendLog.status[r.status]}</TableChip>
      ),
    },
  ];

  return (
    <Stack gap={5}>
      <Cluster gap={3}>
        <Input
          label={t.admin.sendLog.from}
          type="date"
          value={dateFrom}
          onChange={(event) => change(() => setDateFrom(event.target.value))}
        />
        <Input
          label={t.admin.sendLog.to}
          type="date"
          value={dateTo}
          onChange={(event) => change(() => setDateTo(event.target.value))}
        />
        <Select
          label={t.admin.sendLog.sender}
          value={senderId}
          options={senderOptions}
          onChange={(value) => change(() => setSenderId(value))}
        />
      </Cluster>

      <Stack gap={2}>
        <h3>{t.admin.sendLog.summaryTitle}</h3>
        {summary.status === 'loading' && <Skeleton aria-label={t.common.loading} />}
        {summary.status === 'error' && <Banner tone="error" title={errorMessage(summary.error)} />}
        {summary.status === 'ready' &&
          (summary.data.length === 0 ? (
            <EmptyState title={t.admin.sendLog.emptySummary} />
          ) : (
            <Table columns={summaryColumns} rows={summary.data} rowKey={(r) => r.senderId} />
          ))}
      </Stack>

      <Stack gap={2}>
        <h3>{t.admin.sendLog.logTitle}</h3>
        {log.status === 'loading' && <Skeleton aria-label={t.common.loading} />}
        {log.status === 'error' && <Banner tone="error" title={errorMessage(log.error)} />}
        {log.status === 'ready' &&
          (log.data.items.length === 0 ? (
            <EmptyState title={t.admin.sendLog.emptyLog} />
          ) : (
            <>
              <Table
                columns={logColumns}
                rows={log.data.items}
                rowKey={(r) => r.id}
                expandedKeys={expanded}
                renderExpanded={(r) => (
                  <p>
                    {t.admin.sendLog.showRecipients}: {r.recipients.join(', ')}
                  </p>
                )}
              />
              <Pagination
                page={page}
                totalPages={totalPages(log.data.total, SEND_LOG_PAGE_SIZE)}
                onChange={setPage}
              />
            </>
          ))}
      </Stack>
    </Stack>
  );
}
