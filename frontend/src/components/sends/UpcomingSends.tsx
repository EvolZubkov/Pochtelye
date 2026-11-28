import { Button, Card, CardBody, Cluster, Heading, Stack, Tag } from '@universityrt/ui-kit';
import { formatDateTime } from '../../format';
import { useAsync } from '../../hooks/useAsync';
import { t } from '../../i18n';
import { sendsApi } from '../../sends/api';
import { statusOf } from '../../sends/rules';

const SHOWN = 3;

/** Ближайшие запланированные письма. Массовые рассылки здесь не показываются. */
export function UpcomingSends({ onShowAll }: { onShowAll: () => void }) {
  const state = useAsync(sendsApi.list);
  if (state.status !== 'ready') return null;

  const upcoming = state.data
    .filter((job) => job.kind !== 'bulk' && statusOf(job) === 'scheduled')
    .sort((a, b) => a.sendAt.localeCompare(b.sendAt))
    .slice(0, SHOWN);

  return (
    <Stack gap={3}>
      <Cluster gap={3}>
        <Heading level={2}>{t.home.upcoming}</Heading>
        <Tag>{t.home.demoMark}</Tag>
      </Cluster>
      <Card>
        <CardBody>
          {upcoming.length === 0 && <p>{t.home.noUpcoming}</p>}
          <ul>
            {upcoming.map((job) => (
              <li key={job.id}>
                <span>{job.subject}</span>: {formatDateTime(job.sendAt)}
              </li>
            ))}
          </ul>
          <Button variant="secondary" size="s" onClick={onShowAll}>
            {t.home.allSends}
          </Button>
        </CardBody>
      </Card>
    </Stack>
  );
}
