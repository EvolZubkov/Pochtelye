import { Banner, Button, Input, Modal, Select } from '@universityrt/ui-kit';
import { useState } from 'react';
import type { FormEvent } from 'react';
import { createUser, updateUser } from '../../api/admin';
import type { AdminUser, Audience, UserWithInvite } from '../../api/admin';
import type { Role } from '../../api/me';
import { errorMessage, t } from '../../i18n';

const ROLES: Role[] = ['editor', 'viewer', 'admin'];
const DEFAULT_ROLE: Role = 'editor';
const NO_AUDIENCE = '';

interface UserFormModalProps {
  /** Пользователь для правки; без него форма создаёт нового. */
  user?: AdminUser;
  audiences: Audience[];
  onClose: () => void;
  onSaved: (created?: UserWithInvite) => void;
}

export function UserFormModal({ user, audiences, onClose, onSaved }: UserFormModalProps) {
  const [email, setEmail] = useState(user?.email ?? '');
  const [displayName, setDisplayName] = useState(user?.displayName ?? '');
  const [role, setRole] = useState<Role>(user?.role ?? DEFAULT_ROLE);
  const [audienceId, setAudienceId] = useState(user?.audienceId ?? NO_AUDIENCE);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<unknown>(null);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setPending(true);
    setError(null);
    const input = {
      email: email.trim(),
      displayName: displayName.trim() || null,
      role,
      audienceId: audienceId || null,
    };
    try {
      if (user) {
        await updateUser(user.id, input);
        onSaved();
      } else {
        onSaved(await createUser(input));
      }
    } catch (failure) {
      setError(failure);
      setPending(false);
    }
  };

  const audienceOptions = [
    { value: NO_AUDIENCE, label: t.admin.users.defaultAudience },
    ...audiences.map((audience) => ({ value: audience.id, label: audience.name })),
  ];

  return (
    <Modal
      open
      size="m"
      title={user ? t.admin.users.form.editTitle : t.admin.users.form.createTitle}
      onClose={onClose}
    >
      <form onSubmit={submit}>
        <Input
          label={t.admin.users.form.email}
          type="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          required
          fullWidth
        />
        <Input
          label={t.admin.users.form.name}
          value={displayName}
          onChange={(event) => setDisplayName(event.target.value)}
          fullWidth
        />
        <Select<Role>
          label={t.admin.users.form.role}
          value={role}
          onChange={setRole}
          options={ROLES.map((value) => ({ value, label: t.roles[value] }))}
          fullWidth
        />
        <Select
          label={t.admin.users.form.audience}
          value={audienceId}
          onChange={setAudienceId}
          options={audienceOptions}
          fullWidth
        />
        {error !== null && <Banner tone="error" title={errorMessage(error)} />}
        <Button variant="secondary" type="button" onClick={onClose} disabled={pending}>
          {t.common.cancel}
        </Button>
        <Button type="submit" loading={pending} disabled={email.trim() === ''}>
          {t.common.save}
        </Button>
      </form>
    </Modal>
  );
}
