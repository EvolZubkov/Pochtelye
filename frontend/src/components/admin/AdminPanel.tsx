import { AppShellPageHead, Tabs } from '@universityrt/ui-kit';
import { useState } from 'react';
import { t } from '../../i18n';
import { AudiencesPanel } from './AudiencesPanel';
import { GroupsPanel } from './GroupsPanel';
import { SendLogPanel } from './SendLogPanel';
import { UsersPanel } from './UsersPanel';

type Section = 'users' | 'audiences' | 'groups' | 'sendLog';

const SECTIONS: { id: Section; label: string }[] = [
  { id: 'users', label: t.admin.tabs.users },
  { id: 'audiences', label: t.admin.tabs.audiences },
  { id: 'groups', label: t.admin.tabs.groups },
  { id: 'sendLog', label: t.admin.tabs.sendLog },
];

/** Админ-панель: люди, роли и аудитории, журнал отправок. Права проверяет API, не интерфейс. */
export function AdminPanel() {
  const [section, setSection] = useState<Section>('users');

  return (
    <>
      <AppShellPageHead title={t.admin.title} />
      <Tabs
        items={SECTIONS}
        value={section}
        onChange={setSection}
        hidePanel
        listAriaLabel={t.admin.tabsLabel}
      />
      {section === 'users' && <UsersPanel />}
      {section === 'audiences' && <AudiencesPanel />}
      {section === 'groups' && <GroupsPanel />}
      {section === 'sendLog' && <SendLogPanel />}
    </>
  );
}
