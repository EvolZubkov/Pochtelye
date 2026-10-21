import { Banner, Button, Card, CardBody, CardHeader, Input } from '@universityrt/ui-kit';
import { useState } from 'react';
import type { FormEvent } from 'react';
import { activate } from '../api/me';
import { errorMessage, t } from '../i18n';

interface ActivationFormProps {
  onActivated: () => void;
}

/** Первый вход: человек вводит одноразовый код, который выдал админ. */
export function ActivationForm({ onActivated }: ActivationFormProps) {
  const [code, setCode] = useState('');
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<unknown>(null);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setPending(true);
    setError(null);
    try {
      await activate(code.trim());
      onActivated();
    } catch (failure) {
      setError(failure);
    } finally {
      setPending(false);
    }
  };

  return (
    <Card>
      <CardHeader title={t.activation.title} subtitle={t.activation.description} />
      <CardBody>
        <form onSubmit={submit}>
          <Input
            label={t.activation.codeLabel}
            hint={t.activation.codeHint}
            value={code}
            onChange={(event) => setCode(event.target.value)}
            autoComplete="off"
            autoFocus
            fullWidth
          />
          {error !== null && <Banner tone="error" title={errorMessage(error)} />}
          <Button type="submit" loading={pending} disabled={code.trim() === ''}>
            {t.activation.submit}
          </Button>
        </form>
      </CardBody>
    </Card>
  );
}
