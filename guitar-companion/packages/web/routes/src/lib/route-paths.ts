/**
 * Every navigable route in the web app. Framework-free so the e2e
 * route-coverage guard can import it. Each entry must be covered by at
 * least one e2e spec tagged `@route:<path>`.
 */
export const ROUTE_PATHS = {
  home: '/',
  import: '/import',
  phrases: '/phrases',
  phrase: '/phrases/:id',
  practice: '/phrases/:id/practice',
  transpose: '/phrases/:id/transpose',
  notFound: '/**',
} as const;

export type RouteKey = keyof typeof ROUTE_PATHS;
export type RoutePath = (typeof ROUTE_PATHS)[RouteKey];

/** Playwright tag for a route, e.g. `@route:/`. */
export function routeTag(path: RoutePath): string {
  return `@route:${path}`;
}

/** Angular Router path (no leading slash). */
export function routerPath(path: RoutePath): string {
  return path.replace(/^\//, '');
}
