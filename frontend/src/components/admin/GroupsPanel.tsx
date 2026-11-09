import { Banner, Button, Cluster, EmptyState, Skeleton, Stack, Table } from '@universityrt/ui-kit';
import { useState } from 'react';
import { deleteGroup, fetchAudiences, fetchGroups } from '../../api/admin';
import type { Audience, Group } from '../../api/admin';
import { useAsync, useReload } from '../../hooks/useAsync';
import { errorMessage, t } from '../../i18n';
import { ConfirmModal } from '../ConfirmModal';
import { GroupFormModal } from './GroupFormModal';

type Dialog = { kind: 'create' } | { kind: 'edit'; group: Group } | { kind: 'delete'; group: Group };

const categoriesText = (group: Group): string =>
  group.categories === null ? t.admin.groups.allCategories : group.categories.join(', ') || t.common.none;

/** Группы внутри аудитории: какие функции и категории общих шаблонов видят люди. */
export function GroupsPanel() {
  const [version, reload] = useReload();
  const [dialog, setDialog] = useState<Dialog | null>(null);
  const groups = useAsync(fetchGroups, [version]);
  const audiencesState = useAsync(fetchAudiences, [version]);
  const audiences: Audience[] = audiencesState.status === 'ready' ? audiencesState.data : [];
  const audienceName = (id: string) => audiences.find((a) => a.id === id)?.name ?? t.common.none;

  const columns = [
    { key: 'name', header: t.admin.groups.columns.name, render: (g: Group) => g.name },
    { key: 'audience', header: t.admin.groups.columns.audience, render: (g: Group) => audienceName(g.audienceId) },
    { key: 'categories', header: t.admin.groups.columns.categories, render: categoriesText },
    { key: 'users', header: t.admin.groups.columns.users, numeric: true, render: (g: Group) => g.userCount },
    {
      key: 'actions',
      header: t.admin.groups.columns.actions,
      render: (g: Group) => (
        <Cluster gap={2}>
          <Button size="s" variant="secondary" onClick={() => setDialog({ kind: 'edit', group: g })}>
            {t.common.edit}
          </Button>
          <Button size="s" variant="ghost" onClick={() => setDialog({ kind: 'delete', group: g })}>
            {t.common.delete}
          </Button>
        </Cluster>
      ),
    },
  ];

  return (
    <Stack gap={4}>
      <Cluster gap={3}>
        <Button onClick={() => setDialog({ kind: 'create' })} disabled={audiences.length === 0}>
          {t.admin.groups.add}
        </Button>
      </Cluster>

      {groups.status === 'loading' && <Skeleton aria-label={t.common.loading} />}
      {groups.status === 'error' && <Banner tone="error" title={errorMessage(groups.error)} />}
      {groups.status === 'ready' &&
        (groups.data.length === 0 ? (
          <EmptyState title={t.admin.groups.empty} />
        ) : (
          <Table columns={columns} rows={groups.data} rowKey={(g) => g.id} />
        ))}

      {(dialog?.kind === 'create' || dialog?.kind === 'edit') && (
        <GroupFormModal
          group={dialog.kind === 'edit' ? dialog.group : undefined}
          audiences={audiences}
          onClose={() => setDialog(null)}
          onSaved={() => {
            setDialog(null);
            reload();
          }}
        />
      )}
      {dialog?.kind === 'delete' && (
        <ConfirmModal
          title={t.admin.groups.deleteTitle}
          text={`${dialog.group.name}. ${t.admin.groups.deleteText}`}
          onClose={() => setDialog(null)}
          onConfirm={async () => {
            await deleteGroup(dialog.group.id);
            setDialog(null);
            reload();
          }}
        />
      )}
    </Stack>
  );
}
