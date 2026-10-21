import { Banner, Button, Cluster, EmptyState, Skeleton, Stack, Table, Tag } from '@universityrt/ui-kit';
import { useState } from 'react';
import { deleteAudience, fetchAudiences, updateAudience } from '../../api/admin';
import type { Audience } from '../../api/admin';
import { useAsync, useReload } from '../../hooks/useAsync';
import { errorMessage, t } from '../../i18n';
import { ConfirmModal } from '../ConfirmModal';
import { AudienceFormModal } from './AudienceFormModal';

type Dialog = { kind: 'create' } | { kind: 'edit'; audience: Audience } | { kind: 'delete'; audience: Audience };

export function AudiencesPanel() {
  const [version, reload] = useReload();
  const [dialog, setDialog] = useState<Dialog | null>(null);
  const [actionError, setActionError] = useState<unknown>(null);
  const state = useAsync(fetchAudiences, [version]);

  const makeDefault = async (audience: Audience) => {
    setActionError(null);
    try {
      await updateAudience(audience.id, { isDefault: true });
      reload();
    } catch (failure) {
      setActionError(failure);
    }
  };

  const columns = [
    {
      key: 'name',
      header: t.admin.audiences.columns.name,
      render: (a: Audience) => (
        <Cluster gap={2}>
          {a.name}
          {a.isDefault && <Tag tone="info">{t.admin.audiences.defaultTag}</Tag>}
        </Cluster>
      ),
    },
    { key: 'users', header: t.admin.audiences.columns.users, numeric: true, render: (a: Audience) => a.userCount },
    {
      key: 'actions',
      header: t.admin.audiences.columns.actions,
      render: (a: Audience) => (
        <Cluster gap={2}>
          <Button size="s" variant="secondary" onClick={() => setDialog({ kind: 'edit', audience: a })}>
            {t.common.edit}
          </Button>
          {!a.isDefault && (
            <>
              <Button size="s" variant="secondary" onClick={() => makeDefault(a)}>
                {t.admin.audiences.makeDefault}
              </Button>
              <Button size="s" variant="ghost" onClick={() => setDialog({ kind: 'delete', audience: a })}>
                {t.common.delete}
              </Button>
            </>
          )}
        </Cluster>
      ),
    },
  ];

  const defaultProfile = state.status === 'ready' ? state.data.find((a) => a.isDefault)?.profile : undefined;

  return (
    <Stack gap={4}>
      <Cluster gap={3}>
        <Button onClick={() => setDialog({ kind: 'create' })}>{t.admin.audiences.add}</Button>
      </Cluster>

      {actionError !== null && <Banner tone="error" title={errorMessage(actionError)} />}
      {state.status === 'loading' && <Skeleton aria-label={t.common.loading} />}
      {state.status === 'error' && <Banner tone="error" title={errorMessage(state.error)} />}
      {state.status === 'ready' &&
        (state.data.length === 0 ? (
          <EmptyState title={t.admin.audiences.empty} />
        ) : (
          <Table columns={columns} rows={state.data} rowKey={(a) => a.id} />
        ))}

      {(dialog?.kind === 'create' || dialog?.kind === 'edit') && (
        <AudienceFormModal
          audience={dialog.kind === 'edit' ? dialog.audience : undefined}
          template={defaultProfile}
          onClose={() => setDialog(null)}
          onSaved={() => {
            setDialog(null);
            reload();
          }}
        />
      )}
      {dialog?.kind === 'delete' && (
        <ConfirmModal
          title={t.admin.audiences.deleteTitle}
          text={`${dialog.audience.name}. ${t.admin.audiences.deleteText}`}
          onClose={() => setDialog(null)}
          onConfirm={async () => {
            await deleteAudience(dialog.audience.id);
            setDialog(null);
            reload();
          }}
        />
      )}
    </Stack>
  );
}
