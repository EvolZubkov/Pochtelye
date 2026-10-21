import {
  Banner,
  Button,
  Cluster,
  EmptyState,
  Pagination,
  SearchField,
  Skeleton,
  Stack,
  Table,
  TableChip,
  Tag,
} from '@universityrt/ui-kit';
import { useState } from 'react';
import {
  USERS_PAGE_SIZE,
  deleteUser,
  fetchAudiences,
  fetchUsers,
  reissueInvite,
} from '../../api/admin';
import type { AdminUser, Audience, UserWithInvite } from '../../api/admin';
import { formatDateTime, totalPages } from '../../format';
import { useAsync, useReload } from '../../hooks/useAsync';
import { useDebounced } from '../../hooks/useDebounced';
import { errorMessage, t } from '../../i18n';
import { ConfirmModal } from '../ConfirmModal';
import { InviteCodeModal } from './InviteCodeModal';
import { UserFormModal } from './UserFormModal';

type Dialog =
  | { kind: 'create' }
  | { kind: 'edit'; user: AdminUser }
  | { kind: 'delete'; user: AdminUser }
  | { kind: 'invite'; email: string | null; code: string };

const SEARCH_DEBOUNCE_MS = 300;

function inviteDialog({ user, inviteCode }: UserWithInvite): Dialog {
  return { kind: 'invite', email: user.email, code: inviteCode };
}

export function UsersPanel() {
  const [page, setPage] = useState(1);
  const [searchText, setSearchText] = useState('');
  const search = useDebounced(searchText, SEARCH_DEBOUNCE_MS);
  const [version, reload] = useReload();
  const [dialog, setDialog] = useState<Dialog | null>(null);
  const [actionError, setActionError] = useState<unknown>(null);

  const users = useAsync(() => fetchUsers(page, search), [page, search, version]);
  const audiencesState = useAsync(fetchAudiences, [version]);
  const audiences: Audience[] = audiencesState.status === 'ready' ? audiencesState.data : [];
  const audienceName = (id: string | null) =>
    id ? (audiences.find((a) => a.id === id)?.name ?? t.common.none) : t.admin.users.defaultAudience;

  const closeAndReload = () => {
    setDialog(null);
    reload();
  };

  const reissue = async (user: AdminUser) => {
    setActionError(null);
    try {
      setDialog(inviteDialog(await reissueInvite(user.id)));
      reload();
    } catch (failure) {
      setActionError(failure);
    }
  };

  const columns = [
    { key: 'email', header: t.admin.users.columns.email, render: (u: AdminUser) => u.email ?? t.common.none },
    { key: 'name', header: t.admin.users.columns.name, render: (u: AdminUser) => u.displayName ?? t.common.none },
    { key: 'role', header: t.admin.users.columns.role, render: (u: AdminUser) => <Tag>{t.roles[u.role]}</Tag> },
    { key: 'audience', header: t.admin.users.columns.audience, render: (u: AdminUser) => audienceName(u.audienceId) },
    {
      key: 'status',
      header: t.admin.users.columns.status,
      render: (u: AdminUser) => (
        <TableChip tone={u.status === 'active' ? 'success' : 'warning'}>
          {t.admin.users.status[u.status]}
        </TableChip>
      ),
    },
    { key: 'lastSeen', header: t.admin.users.columns.lastSeen, render: (u: AdminUser) => formatDateTime(u.lastSeenAt) },
    {
      key: 'actions',
      header: t.admin.users.columns.actions,
      render: (u: AdminUser) => (
        <Cluster gap={2}>
          <Button size="s" variant="secondary" onClick={() => setDialog({ kind: 'edit', user: u })}>
            {t.common.edit}
          </Button>
          {u.status === 'invited' && (
            <Button size="s" variant="secondary" onClick={() => reissue(u)}>
              {t.admin.users.reissue}
            </Button>
          )}
          <Button size="s" variant="ghost" onClick={() => setDialog({ kind: 'delete', user: u })}>
            {t.common.delete}
          </Button>
        </Cluster>
      ),
    },
  ];

  return (
    <Stack gap={4}>
      <Cluster gap={3}>
        <SearchField
          value={searchText}
          onChange={(event) => {
            setSearchText(event.target.value);
            setPage(1);
          }}
          placeholder={t.admin.users.searchPlaceholder}
          aria-label={t.common.search}
        />
        <Button onClick={() => setDialog({ kind: 'create' })}>{t.admin.users.add}</Button>
      </Cluster>

      {actionError !== null && <Banner tone="error" title={errorMessage(actionError)} />}
      {users.status === 'loading' && <Skeleton aria-label={t.common.loading} />}
      {users.status === 'error' && <Banner tone="error" title={errorMessage(users.error)} />}
      {users.status === 'ready' &&
        (users.data.items.length === 0 ? (
          <EmptyState title={t.admin.users.empty} />
        ) : (
          <>
            <Table columns={columns} rows={users.data.items} rowKey={(u) => u.id} />
            <Pagination
              page={page}
              totalPages={totalPages(users.data.total, USERS_PAGE_SIZE)}
              onChange={setPage}
            />
          </>
        ))}

      {(dialog?.kind === 'create' || dialog?.kind === 'edit') && (
        <UserFormModal
          user={dialog.kind === 'edit' ? dialog.user : undefined}
          audiences={audiences}
          onClose={() => setDialog(null)}
          onSaved={(created) => {
            if (created) setDialog(inviteDialog(created));
            else setDialog(null);
            reload();
          }}
        />
      )}
      {dialog?.kind === 'delete' && (
        <ConfirmModal
          title={t.admin.users.deleteTitle}
          text={`${dialog.user.email ?? ''}. ${t.admin.users.deleteText}`}
          onClose={() => setDialog(null)}
          onConfirm={async () => {
            await deleteUser(dialog.user.id);
            closeAndReload();
          }}
        />
      )}
      {dialog?.kind === 'invite' && (
        <InviteCodeModal email={dialog.email} code={dialog.code} onClose={() => setDialog(null)} />
      )}
    </Stack>
  );
}
