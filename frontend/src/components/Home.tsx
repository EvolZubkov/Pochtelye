import { Card, CardBody } from '@universityrt/ui-kit';
import type { Me } from '../api/me';
import { t } from '../i18n';

export function Home({ user }: { user: Me }) {
  return (
    <Card>
      <CardBody>
        <p>
          {t.home.greeting}: {user.displayName ?? user.email ?? user.sub}
        </p>
        <p>
          {t.home.role}: {t.roles[user.role]}
        </p>
      </CardBody>
    </Card>
  );
}
