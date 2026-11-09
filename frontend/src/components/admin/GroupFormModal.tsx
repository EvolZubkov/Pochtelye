import { Banner, Button, Input, Modal, Select, Switch, Textarea } from '@universityrt/ui-kit';
import { useState } from 'react';
import type { FormEvent } from 'react';
import { createGroup, updateGroup } from '../../api/admin';
import type { Audience, Group } from '../../api/admin';
import { errorMessage, t } from '../../i18n';

const FEATURES = ['bulk_mail', 'exchange_send'] as const;

type FeatureChoice = 'inherit' | 'on' | 'off';

const choiceOf = (features: Record<string, boolean>, feature: string): FeatureChoice =>
  feature in features ? (features[feature] ? 'on' : 'off') : 'inherit';

/** «Как в аудитории» убирает ключ: он не перекрывает функцию аудитории. */
function withFeature(
  features: Record<string, boolean>,
  feature: string,
  choice: FeatureChoice,
): Record<string, boolean> {
  const { [feature]: _removed, ...rest } = features;
  return choice === 'inherit' ? rest : { ...rest, [feature]: choice === 'on' };
}

interface GroupFormModalProps {
  /** Группа для правки; без неё форма создаёт новую. */
  group?: Group;
  audiences: Audience[];
  onClose: () => void;
  onSaved: () => void;
}

const parseCategories = (text: string): string[] => [
  ...new Set(
    text
      .split('\n')
      .map((line) => line.trim())
      .filter((line) => line !== ''),
  ),
];

const UNCATEGORIZED = '';

export function GroupFormModal({ group, audiences, onClose, onSaved }: GroupFormModalProps) {
  const labels = t.admin.groups.form;
  const [name, setName] = useState(group?.name ?? '');
  const [audienceId, setAudienceId] = useState(group?.audienceId ?? audiences[0]?.id ?? '');
  const [features, setFeatures] = useState<Record<string, boolean>>(group?.features ?? {});
  const [allCategories, setAllCategories] = useState(group ? group.categories === null : true);
  const [categoriesText, setCategoriesText] = useState(
    (group?.categories ?? []).filter((category) => category !== UNCATEGORIZED).join('\n'),
  );
  const [withUncategorized, setWithUncategorized] = useState(
    group?.categories?.includes(UNCATEGORIZED) ?? false,
  );
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<unknown>(null);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setPending(true);
    setError(null);
    const categories = allCategories
      ? null
      : [...parseCategories(categoriesText), ...(withUncategorized ? [UNCATEGORIZED] : [])];
    try {
      if (group) {
        await updateGroup(group.id, { name: name.trim(), features, categories });
      } else {
        await createGroup({ audienceId, name: name.trim(), features, categories, limits: {} });
      }
      onSaved();
    } catch (failure) {
      setError(failure);
      setPending(false);
    }
  };

  return (
    <Modal open size="m" title={group ? labels.editTitle : labels.createTitle} onClose={onClose}>
      <form onSubmit={submit}>
        <Input
          label={labels.name}
          value={name}
          onChange={(event) => setName(event.target.value)}
          required
          fullWidth
        />
        <Select
          label={labels.audience}
          value={audienceId}
          onChange={setAudienceId}
          options={audiences.map((audience) => ({ value: audience.id, label: audience.name }))}
          disabled={group !== undefined}
          fullWidth
        />

        <fieldset>
          <legend>{labels.features}</legend>
          <p>{labels.featuresHint}</p>
          {FEATURES.map((feature) => (
            <Select<FeatureChoice>
              key={feature}
              label={t.admin.audiences.features[feature]}
              value={choiceOf(features, feature)}
              onChange={(choice) => setFeatures(withFeature(features, feature, choice))}
              options={[
                { value: 'inherit', label: labels.featureInherit },
                { value: 'on', label: labels.featureOn },
                { value: 'off', label: labels.featureOff },
              ]}
              fullWidth
            />
          ))}
        </fieldset>

        <Switch
          label={labels.allCategories}
          checked={allCategories}
          onChange={(event) => setAllCategories(event.target.checked)}
        />
        {!allCategories && (
          <Switch
            label={labels.uncategorized}
            checked={withUncategorized}
            onChange={(event) => setWithUncategorized(event.target.checked)}
          />
        )}
        {!allCategories && (
          <Textarea
            label={labels.categories}
            hint={labels.categoriesHint}
            value={categoriesText}
            onChange={(event) => setCategoriesText(event.target.value)}
            rows={5}
            fullWidth
          />
        )}

        {error !== null && <Banner tone="error" title={errorMessage(error)} />}
        <Button variant="secondary" type="button" onClick={onClose} disabled={pending}>
          {t.common.cancel}
        </Button>
        <Button type="submit" loading={pending} disabled={name.trim() === '' || audienceId === ''}>
          {t.common.save}
        </Button>
      </form>
    </Modal>
  );
}
