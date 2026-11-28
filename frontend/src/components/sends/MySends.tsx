import { Banner, Skeleton, Stack, Tabs } from '@universityrt/ui-kit';
import { useState } from 'react';
import { useAsync, useReload } from '../../hooks/useAsync';
import { errorMessage, t } from '../../i18n';
import { sendsApi } from '../../sends/api';
import type { SendsApi } from '../../sends/api';
import { jobsInTab, tabItems } from '../../sends/tabs';
import type { SendTab } from '../../sends/tabs';
import { SendsList } from './SendsList';

interface MySendsProps {
  actor: string;
  api?: SendsApi;
}

/** Свои отправки видны всегда, в том числе рассылки: право проверяется при создании. */
export function MySends({ actor, api = sendsApi }: MySendsProps) {
  const [version, reload] = useReload();
  const sends = useAsync(api.list, [version]);
  const [tab, setTab] = useState<SendTab>('queue');

  if (sends.status === 'error') return <Banner tone="error" title={errorMessage(sends.error)} />;
  if (sends.status === 'loading') return <Skeleton aria-label={t.common.loading} />;

  return (
    <Stack gap={4}>
      <Banner tone="warning" title={t.sends.demoTitle}>
        {t.sends.demoHint}
      </Banner>
      <Tabs
        items={tabItems(sends.data)}
        value={tab}
        onChange={setTab}
        hidePanel
        listAriaLabel={t.sends.tabsLabel}
      />
      <SendsList
        jobs={jobsInTab(sends.data, tab)}
        api={api}
        actor={actor}
        onChanged={reload}
      />
    </Stack>
  );
}
