import { useEffect, useState } from 'react';

export type Route = 'home' | 'editor' | 'builder' | 'admin';

const ROUTE_PREFIX = '#/';
const DEFAULT_ROUTE: Route = 'home';
const ROUTES: readonly Route[] = ['home', 'editor', 'builder', 'admin'];

export function parseRoute(hash: string): Route {
  const name = hash.startsWith(ROUTE_PREFIX) ? hash.slice(ROUTE_PREFIX.length) : '';
  return ROUTES.find((route) => route === name) ?? DEFAULT_ROUTE;
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
