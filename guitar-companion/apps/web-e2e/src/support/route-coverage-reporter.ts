import type {
  FullConfig,
  FullResult,
  Reporter,
  Suite,
} from '@playwright/test/reporter';
import { ROUTE_PATHS, routeTag } from '@gsc/web/routes';

/**
 * Whole-site coverage guard: every route in ROUTE_PATHS must have at least
 * one test tagged `@route:<path>`. Fails the run in CI or when
 * ROUTE_COVERAGE=1; otherwise only warns (so running one spec locally works).
 * ROUTE_COVERAGE=0 turns it off, for filtered runs such as the deployed smoke.
 */
export default class RouteCoverageReporter implements Reporter {
  private missing: string[] = [];
  private readonly off = process.env['ROUTE_COVERAGE'] === '0';
  private readonly strict =
    !!process.env['CI'] || process.env['ROUTE_COVERAGE'] === '1';

  onBegin(_config: FullConfig, suite: Suite): void {
    const tags = new Set(suite.allTests().flatMap((t) => t.tags));
    this.missing = Object.values(ROUTE_PATHS).filter(
      (p) => !tags.has(routeTag(p)),
    );
  }

  onEnd(result: FullResult): { status?: FullResult['status'] } | void {
    if (this.off || this.missing.length === 0) return;
    const msg = `Routes without e2e coverage: ${this.missing.join(', ')}`;
    if (this.strict) {
      console.error(`\n✖ ${msg}`);
      return { status: 'failed' };
    }
    console.warn(`\n⚠ ${msg} (set ROUTE_COVERAGE=1 to enforce)`);
    return { status: result.status };
  }

  printsToStdio(): boolean {
    return false;
  }
}
