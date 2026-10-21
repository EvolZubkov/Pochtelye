import { Banner, Button, Modal } from '@universityrt/ui-kit';
import { useState } from 'react';
import { errorMessage, t } from '../i18n';

interface ConfirmModalProps {
  title: string;
  text: string;
  confirmLabel?: string;
  onConfirm: () => Promise<void>;
  onClose: () => void;
}

/** Подтверждение необратимого действия; ошибку действия показывает внутри окна. */
export function ConfirmModal({ title, text, confirmLabel, onConfirm, onClose }: ConfirmModalProps) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<unknown>(null);

  const confirm = async () => {
    setPending(true);
    setError(null);
    try {
      await onConfirm();
    } catch (failure) {
      setError(failure);
      setPending(false);
    }
  };

  return (
    <Modal
      open
      size="s"
      title={title}
      description={text}
      iconTone="danger"
      onClose={onClose}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={pending}>
            {t.common.cancel}
          </Button>
          <Button variant="destructive" onClick={confirm} loading={pending}>
            {confirmLabel ?? t.common.delete}
          </Button>
        </>
      }
    >
      {error !== null && <Banner tone="error" title={errorMessage(error)} />}
    </Modal>
  );
}
