import { useEffect, useState } from 'react';

const ROUTES = [
  'home',
  'templates',
  'editor',
  'sends',
  'settings',
  'builder',
  'all-sends',
  'users',
  'groups',
  'audiences',
] as const;

export type Route = (typeof ROUTES)[number];

const ROUTE_PREFIX = '#/';
const DEFAULT_ROUTE: Route = 'home';
/** Старые ссылки: админ-панель раньше была одним разделом. */
const ALIASES: Record<string, Route> = { admin: 'users' };

/** Часть hash после «?»: параметры раздела, например открываемый шаблон. */
export function parseParams(hash: string): string {
  const start = hash.indexOf('?');
  return start === -1 ? '' : hash.slice(start + 1);
}

export function parseRoute(hash: string): Route {
  const path = hash.split('?')[0];
  const name = path.startsWith(ROUTE_PREFIX) ? path.slice(ROUTE_PREFIX.length) : '';
  return ROUTES.find((route) => route === name) ?? ALIASES[name] ?? DEFAULT_ROUTE;
}

/** Маршрут в hash: работает за любым префиксом платформы и без настройки сервера. */
export function useHashRoute(): [Route, (route: Route, params?: string) => void, string] {
  const [hash, setHash] = useState(() => window.location.hash);

  useEffect(() => {
    const onChange = () => setHash(window.location.hash);
    window.addEventListener('hashchange', onChange);
    return () => window.removeEventListener('hashchange', onChange);
  }, []);

  const navigate = (next: Route, params?: string) => {
    window.location.hash = `${ROUTE_PREFIX}${next}${params ? `?${params}` : ''}`;
  };
  return [parseRoute(hash), navigate, parseParams(hash)];
}
