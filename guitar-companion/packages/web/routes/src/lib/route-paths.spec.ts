import { ROUTE_PATHS, routeTag } from './route-paths';

describe('route paths', () => {
  it('builds Playwright route tags', () => {
    expect(routeTag(ROUTE_PATHS.home)).toBe('@route:/');
  });

  it('has unique paths starting with /', () => {
    const paths = Object.values(ROUTE_PATHS);
    expect(new Set(paths).size).toBe(paths.length);
    expect(paths.every((p) => p.startsWith('/'))).toBe(true);
  });
});
