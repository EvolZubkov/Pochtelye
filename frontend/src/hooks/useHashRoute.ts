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

export function parseRoute(hash: string): Route {
  const name = hash.startsWith(ROUTE_PREFIX) ? hash.slice(ROUTE_PREFIX.length) : '';
  return ROUTES.find((route) => route === name) ?? ALIASES[name] ?? DEFAULT_ROUTE;
}

/** Маршрут в hash: работает за любым префиксом платформы и без настройки сервера. */
export function useHashRoute(): [Route, (route: Route) => void] {
  const [route, setRoute] = useState<Route>(() => parseRoute(window.location.hash));

  useEffect(() => {
    const onChange = () => setRoute(parseRoute(window.location.hash));
    window.addEventListener('hashchange', onChange);
    return () => window.removeEventListener('hashchange', onChange);
  }, []);

  const navigate = (next: Route) => {
    window.location.hash = `${ROUTE_PREFIX}${next}`;
  };
  return [route, navigate];
}
