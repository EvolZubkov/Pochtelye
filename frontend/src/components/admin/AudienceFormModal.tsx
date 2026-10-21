import { Banner, Button, Checkbox, Input, Modal, Switch } from '@universityrt/ui-kit';
import { useState } from 'react';
import type { FormEvent } from 'react';
import { createAudience, updateAudience } from '../../api/admin';
import type { Audience, AudienceProfile, BlockProfile } from '../../api/admin';
import { errorMessage, t } from '../../i18n';

const BLOCK_TYPES = [
  'banner',
  'text',
  'heading',
  'button',
  'list',
  'expert',
  'important',
  'divider',
  'image',
  'spacer',
  'table',
  'canvas',
] as const;
const CAPABILITIES = ['background', 'border', 'clickable', 'free'] as const;
const FEATURES = ['bulk_mail', 'exchange_send'] as const;

interface AudienceFormModalProps {
  /** Аудитория для правки; без неё форма создаёт новую на основе `template`. */
  audience?: Audience;
  template?: AudienceProfile;
  onClose: () => void;
  onSaved: () => void;
}

const blockOf = (profile: AudienceProfile, type: string): BlockProfile =>
  profile.blocks[type] ?? { enabled: true, capabilities: [] };

/** Неизвестные ключи профиля (defaults, hidden и др.) сохраняются: форма меняет только своё. */
function withBlock(profile: AudienceProfile, type: string, change: Partial<BlockProfile>): AudienceProfile {
  return { ...profile, blocks: { ...profile.blocks, [type]: { ...blockOf(profile, type), ...change } } };
}

export function AudienceFormModal({ audience, template, onClose, onSaved }: AudienceFormModalProps) {
  const [name, setName] = useState(audience?.name ?? '');
  const [isDefault, setIsDefault] = useState(audience?.isDefault ?? false);
  const [profile, setProfile] = useState<AudienceProfile>(
    audience?.profile ?? template ?? { blocks: {} },
  );
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<unknown>(null);

  const toggleCapability = (type: string, capability: string, on: boolean) => {
    const current = blockOf(profile, type).capabilities;
    const next = on ? [...current, capability] : current.filter((item) => item !== capability);
    setProfile(withBlock(profile, type, { capabilities: next }));
  };

  const setFeature = (feature: string, on: boolean) =>
    setProfile({ ...profile, features: { ...profile.features, [feature]: on } });

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setPending(true);
    setError(null);
    try {
      const input = { name: name.trim(), profile, isDefault };
      if (audience) await updateAudience(audience.id, input);
      else await createAudience(input);
      onSaved();
    } catch (failure) {
      setError(failure);
      setPending(false);
    }
  };

  const labels = t.admin.audiences;
  return (
    <Modal
      open
      size="l"
      title={audience ? labels.form.editTitle : labels.form.createTitle}
      onClose={onClose}
    >
      <form onSubmit={submit}>
        <Input
          label={labels.form.name}
          value={name}
          onChange={(event) => setName(event.target.value)}
          required
          fullWidth
        />
        <Switch
          label={labels.form.isDefault}
          checked={isDefault}
          disabled={audience?.isDefault}
          onChange={(event) => setIsDefault(event.target.checked)}
        />

        <fieldset>
          <legend>{labels.form.features}</legend>
          {FEATURES.map((feature) => (
            <Switch
              key={feature}
              label={labels.features[feature]}
              checked={profile.features?.[feature] ?? false}
              onChange={(event) => setFeature(feature, event.target.checked)}
            />
          ))}
        </fieldset>

        <Input
          label={labels.form.contentPadding}
          type="number"
          min={0}
          max={200}
          value={profile.contentPadding ?? ''}
          onChange={(event) => {
            const { contentPadding: _removed, ...rest } = profile;
            setProfile(event.target.value === '' ? rest : { ...rest, contentPadding: Number(event.target.value) });
          }}
        />

        <fieldset>
          <legend>{labels.form.blocks}</legend>
          {BLOCK_TYPES.map((type) => {
            const block = blockOf(profile, type);
            return (
              <div key={type}>
                <Switch
                  label={labels.blocks[type]}
                  checked={block.enabled}
                  onChange={(event) => setProfile(withBlock(profile, type, { enabled: event.target.checked }))}
                />
                {block.enabled &&
                  CAPABILITIES.map((capability) => (
                    <Checkbox
                      key={capability}
                      label={labels.capabilities[capability]}
                      aria-label={`${labels.blocks[type]}: ${labels.capabilities[capability]}`}
                      checked={block.capabilities.includes(capability)}
                      onChange={(event) => toggleCapability(type, capability, event.target.checked)}
                    />
                  ))}
              </div>
            );
          })}
        </fieldset>

        {error !== null && <Banner tone="error" title={errorMessage(error)} />}
        <Button variant="secondary" type="button" onClick={onClose} disabled={pending}>
          {t.common.cancel}
        </Button>
        <Button type="submit" loading={pending} disabled={name.trim() === ''}>
          {t.common.save}
        </Button>
      </form>
    </Modal>
  );
}
