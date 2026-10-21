import { Banner, Button, Modal } from '@universityrt/ui-kit';
import { useState } from 'react';
import { t } from '../../i18n';

interface InviteCodeModalProps {
  email: string | null;
  code: string;
  onClose: () => void;
}

export function InviteCodeModal({ email, code, onClose }: InviteCodeModalProps) {
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
    } catch {
      // Буфер недоступен (например, не-HTTPS): код остаётся на экране, его можно выделить вручную.
      setCopied(false);
    }
  };

  return (
    <Modal
      open
      size="s"
      title={t.admin.invite.title}
      description={`${t.admin.invite.forUser}: ${email ?? ''}`}
      onClose={onClose}
      footer={
        <>
          <Button variant="secondary" onClick={copy}>
            {copied ? t.common.copied : t.common.copy}
          </Button>
          <Button onClick={onClose}>{t.common.close}</Button>
        </>
      }
    >
      <p aria-label={t.admin.invite.title}>
        <strong>{code}</strong>
      </p>
      <Banner tone="info" title={t.admin.invite.once} />
    </Modal>
  );
}
