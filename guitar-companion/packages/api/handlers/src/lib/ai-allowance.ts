import { AiUsage } from '@gsc/contracts';
import { apiError, HandlerResponse } from './http';

/** Today's AI use for one user (UTC day). */
export interface UsageTotals {
  requests: number;
  inputTokens: number;
  outputTokens: number;
}

/** Persistence port; implemented by @gsc/api/data-access UsageRepository. */
export interface UsageStore {
  get(userId: string, day: string): Promise<UsageTotals>;
  add(userId: string, day: string, delta: UsageTotals): Promise<void>;
}

export interface AiLimits {
  /** AI requests per user per UTC day (a 2-pass recognition counts 2). */
  requests: number;
  /** Input + output tokens per user per UTC day. */
  tokens: number;
}

export const DEFAULT_AI_LIMITS: AiLimits = { requests: 50, tokens: 300_000 };

/** Fake scenario that simulates a used-up allowance (E2E_MODE only). */
export const OVER_LIMIT_SCENARIO = 'over-limit';

/**
 * Per-user daily AI allowance, so one account can't run up unbounded
 * provider costs. Checked before an AI call, recorded after it.
 */
export class AiAllowance {
  constructor(
    private readonly store: UsageStore,
    readonly limits: AiLimits = DEFAULT_AI_LIMITS,
    private readonly now: () => Date = () => new Date(),
  ) {}

  private day(): string {
    return this.now().toISOString().slice(0, 10);
  }

  /** A 429 response when the allowance is used up; null when the call may go ahead. */
  async check(
    userId: string,
    scenario?: string,
  ): Promise<HandlerResponse | null> {
    const used = await this.store.get(userId, this.day());
    const over =
      scenario === OVER_LIMIT_SCENARIO ||
      used.requests >= this.limits.requests ||
      used.inputTokens + used.outputTokens >= this.limits.tokens;
    return over
      ? apiError(
          429,
          'rate_limited',
          `You've used today's AI allowance (${this.limits.requests} requests). It resets at midnight UTC. Everything else keeps working, and you can enter notes by hand.`,
        )
      : null;
  }

  async record(
    userId: string,
    requests: number,
    usage?: AiUsage,
  ): Promise<void> {
    await this.store.add(userId, this.day(), {
      requests,
      inputTokens: usage?.inputTokens ?? 0,
      outputTokens: usage?.outputTokens ?? 0,
    });
  }
}

/** In-memory store for tests and for running without a database. */
export function memoryUsageStore(): UsageStore {
  const rows = new Map<string, UsageTotals>();
  const empty = (): UsageTotals => ({
    requests: 0,
    inputTokens: 0,
    outputTokens: 0,
  });
  return {
    async get(userId, day) {
      return rows.get(`${userId}:${day}`) ?? empty();
    },
    async add(userId, day, d) {
      const cur = rows.get(`${userId}:${day}`) ?? empty();
      rows.set(`${userId}:${day}`, {
        requests: cur.requests + d.requests,
        inputTokens: cur.inputTokens + d.inputTokens,
        outputTokens: cur.outputTokens + d.outputTokens,
      });
    },
  };
}
