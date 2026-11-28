import {
  Banner,
  Button,
  Card,
  CardBody,
  Cluster,
  Input,
  Skeleton,
  Stack,
  Textarea,
} from '@universityrt/ui-kit';
import { useState } from 'react';
import type { FormEvent } from 'react';
import { useAsync } from '../hooks/useAsync';
import { errorMessage, t } from '../i18n';
import { mailSettingsApi } from '../sends/mailSettings';
import type { MailSettings, MailSettingsApi } from '../sends/mailSettings';
import { parseRecipients } from '../sends/rules';

export function Settings({ api = mailSettingsApi }: { api?: MailSettingsApi }) {
  const state = useAsync(api.load);

  if (state.status === 'loading') return <Skeleton aria-label={t.common.loading} />;
  if (state.status === 'error') return <Banner tone="error" title={errorMessage(state.error)} />;
  return (
    <Stack gap={4}>
      <Banner tone="warning" title={t.settings.demoTitle}>
        {t.settings.demoHint}
      </Banner>
      <MailForm initial={state.data} save={api.save} />
    </Stack>
  );
}

interface MailFormProps {
  initial: MailSettings;
  save: MailSettingsApi['save'];
}

function MailForm({ initial, save }: MailFormProps) {
  const labels = t.settings.form;
  const [server, setServer] = useState(initial.server);
  const [login, setLogin] = useState(initial.login);
  const [password, setPassword] = useState('');
  const [addresses, setAddresses] = useState(initial.fromAddresses.join('\n'));
  const [hasPassword, setHasPassword] = useState(initial.hasPassword);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<unknown>(null);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setSaved(false);
    setError(null);
    try {
      const stored = await save({
        server,
        login,
        password,
        fromAddresses: parseRecipients(addresses),
      });
      setHasPassword(stored.hasPassword);
      setPassword('');
      setSaved(true);
    } catch (failure) {
      setError(failure);
    }
  };

  return (
    <Card>
      <CardBody>
        <form onSubmit={submit}>
          <Stack gap={4}>
            <Input
              label={labels.server}
              hint={labels.serverHint}
              value={server}
              onChange={(event) => setServer(event.target.value)}
              fullWidth
            />
            <Input
              label={labels.login}
              hint={labels.loginHint}
              value={login}
              onChange={(event) => setLogin(event.target.value)}
              autoComplete="off"
              fullWidth
            />
            <Input
              type="password"
              label={labels.password}
              hint={hasPassword ? labels.passwordKept : undefined}
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              autoComplete="new-password"
              fullWidth
            />
            <Textarea
              label={labels.from}
              hint={labels.fromHint}
              value={addresses}
              onChange={(event) => setAddresses(event.target.value)}
              rows={3}
              fullWidth
            />
            {error !== null && <Banner tone="error" title={errorMessage(error)} />}
            {saved && <Banner tone="success" title={t.settings.saved} />}
            <Cluster gap={3}>
              <Button type="submit">{t.common.save}</Button>
            </Cluster>
          </Stack>
        </form>
      </CardBody>
    </Card>
  );
}
