import { Banner, Button, Input, Modal, Stack, Textarea } from '@universityrt/ui-kit';
import { useState } from 'react';
import type { FormEvent } from 'react';
import { fromLocalInput, toLocalInput } from '../../format';
import { errorMessage, t } from '../../i18n';
import { canEditDetails, parseRecipients } from '../../sends/rules';
import type { SendChanges, SendJob } from '../../sends/types';

interface SendEditModalProps {
  job: SendJob;
  onSave: (changes: SendChanges) => Promise<void>;
  onSaved: () => void;
  onClose: () => void;
}

export function SendEditModal({ job, onSave, onSaved, onClose }: SendEditModalProps) {
  const labels = t.sends.form;
  const editable = canEditDetails(job);
  const [subject, setSubject] = useState(job.subject);
  const [time, setTime] = useState(() => toLocalInput(job.sendAt));
  const [recipients, setRecipients] = useState(() =>
    job.recipients
      .filter((r) => r.status === 'pending')
      .map((r) => r.email)
      .join('\n'),
  );
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<unknown>(null);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setPending(true);
    setError(null);
    // Неизменённое время не отправляем: в поле ввода нет секунд.
    const timeChanged = time !== toLocalInput(job.sendAt);
    try {
      await onSave({
        recipients: parseRecipients(recipients),
        ...(editable ? { subject } : {}),
        ...(editable && timeChanged ? { sendAt: fromLocalInput(time) } : {}),
      });
      onSaved();
    } catch (failure) {
      setError(failure);
      setPending(false);
    }
  };

  return (
    <Modal open size="m" title={labels.title} onClose={onClose}>
      <form onSubmit={submit}>
        <Stack gap={4}>
          {!editable && <Banner tone="info" title={labels.startedHint} />}
          <Input
            label={labels.subject}
            value={subject}
            onChange={(event) => setSubject(event.target.value)}
            disabled={!editable}
            fullWidth
          />
          <Input
            type="datetime-local"
            label={labels.sendAt}
            value={time}
            onChange={(event) => setTime(event.target.value)}
            disabled={!editable}
            fullWidth
          />
          <Textarea
            label={labels.recipients}
            hint={labels.recipientsHint}
            value={recipients}
            onChange={(event) => setRecipients(event.target.value)}
            rows={6}
            fullWidth
          />
          {error !== null && <Banner tone="error" title={errorMessage(error)} />}
          <Button type="submit" loading={pending}>
            {t.common.save}
          </Button>
          <Button type="button" variant="secondary" onClick={onClose} disabled={pending}>
            {t.common.cancel}
          </Button>
        </Stack>
      </form>
    </Modal>
  );
}
