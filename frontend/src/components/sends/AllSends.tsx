import { Banner, Skeleton, Stack, Tabs } from '@universityrt/ui-kit';
import { useState } from 'react';
import { useAsync, useReload } from '../../hooks/useAsync';
import { errorMessage, t } from '../../i18n';
import { sendsApi } from '../../sends/api';
import type { SendsApi } from '../../sends/api';
import { NO_FILTER, authorsOf, filterJobs } from '../../sends/filter';
import { jobsInTab, tabItems } from '../../sends/tabs';
import type { SendTab } from '../../sends/tabs';
import { SendLogPanel } from '../admin/SendLogPanel';
import { AllSendsFilters } from './AllSendsFilters';
import { SendsList } from './SendsList';

interface AllSendsProps {
  actor: string;
  api?: SendsApi;
}

/** Отправки всех пользователей (демо) и журнал отправок с сервера. */
export function AllSends({ actor, api = sendsApi }: AllSendsProps) {
  const [version, reload] = useReload();
  const sends = useAsync(api.listAll, [version]);
  const [tab, setTab] = useState<SendTab | 'log'>('queue');
  const [filter, setFilter] = useState(NO_FILTER);

  const jobs = sends.status === 'ready' ? sends.data : [];
  const matching = filterJobs(jobs, filter);

  const content = () => {
    if (tab === 'log') return <SendLogPanel />;
    if (sends.status === 'loading') return <Skeleton aria-label={t.common.loading} />;
    if (sends.status === 'error') {
      return <Banner tone="error" title={errorMessage(sends.error)} />;
    }
    return (
      <>
        <Banner tone="warning" title={t.sends.demoTitle}>
          {t.sends.demoHint}
        </Banner>
        <AllSendsFilters value={filter} authors={authorsOf(jobs)} onChange={setFilter} />
        <SendsList
          jobs={jobsInTab(matching, tab)}
          api={api}
          actor={actor}
          showAuthor
          onChanged={reload}
        />
      </>
    );
  };

  return (
    <Stack gap={4}>
      <Tabs
        items={[...tabItems(matching), { id: 'log' as const, label: t.sends.logTab }]}
        value={tab}
        onChange={setTab}
        hidePanel
        listAriaLabel={t.sends.tabsLabel}
      />
      {content()}
    </Stack>
  );
}
