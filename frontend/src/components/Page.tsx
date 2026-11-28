import { AppShellPageHead } from '@universityrt/ui-kit';
import type { ReactNode } from 'react';

interface PageProps {
  title: string;
  children: ReactNode;
}

/** Раздел приложения: заголовок и содержимое. */
export function Page({ title, children }: PageProps) {
  return (
    <>
      <AppShellPageHead title={title} />
      {children}
    </>
  );
}
