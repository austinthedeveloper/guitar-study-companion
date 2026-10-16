import { ExplainRequestSchema, Explanation } from '@gsc/contracts';
import { AiError, AiProvider, explainPhrase } from '@gsc/api/ai-core';
import { apiError, HandlerResponse, zodIssues } from './http';
import { PhraseStore } from './phrases';

export interface ExplainDeps {
  store: PhraseStore;
  userId: string;
  ai: AiProvider;
  timeoutMs?: number;
  /** Fake-provider scenario; only passed through when E2E_MODE is enabled. */
  scenario?: string;
  log?: (message: string, data?: Record<string, unknown>) => void;
  now?: () => Date;
}

const AI_STATUS: Record<AiError['code'], { status: number; message: string }> =
  {
    ai_timeout: {
      status: 504,
      message: 'The explanation took too long. Try again.',
    },
    ai_unavailable: {
      status: 502,
      message:
        'The explanation service is unavailable. Your phrase is safe; try again shortly.',
    },
    ai_invalid_output: {
      status: 502,
      message: 'The explanation came back unusable. Try again.',
    },
  };

const STALE_MESSAGE =
  'This phrase changed since you opened it. Reload to see the latest version.';

/**
 * Explains the stored phrase (never client-sent notes) at the revision the
 * user is looking at, and stores the result against that revision.
 */
export async function explainPhraseHandler(
  id: string,
  body: unknown,
  deps: ExplainDeps,
): Promise<HandlerResponse> {
  const parsed = ExplainRequestSchema.safeParse(body);
  if (!parsed.success)
    return apiError(400, 'validation_failed', 'Invalid request.', {
      issues: zodIssues(parsed.error),
    });
  const phrase = await deps.store.get(deps.userId, id);
  if (!phrase) return apiError(404, 'not_found', 'Phrase not found.');
  if (phrase.revision !== parsed.data.revision)
    return apiError(409, 'conflict', STALE_MESSAGE);

  try {
    const result = await explainPhrase(deps.ai, phrase, {
      timeoutMs: deps.timeoutMs,
      scenario: deps.scenario,
    });
    // Log usage and counts only, never musical content.
    deps.log?.('explain.ok', {
      provider: deps.ai.name,
      model: result.model,
      points: result.points.length,
      dropped: result.droppedPoints,
      inputTokens: result.usage?.inputTokens,
      outputTokens: result.usage?.outputTokens,
    });
    const explanation: Explanation = {
      summary: result.summary,
      points: result.points,
      phraseRevision: phrase.revision,
      provider: deps.ai.name,
      model: result.model,
      createdAt: (deps.now?.() ?? new Date()).toISOString(),
    };
    const saved = await deps.store.saveExplanation(
      deps.userId,
      id,
      explanation,
    );
    if (saved === 'not_found')
      return apiError(404, 'not_found', 'Phrase not found.');
    if (saved === 'conflict') return apiError(409, 'conflict', STALE_MESSAGE);
    return { status: 200, body: saved };
  } catch (err) {
    if (err instanceof AiError) {
      deps.log?.('explain.ai_error', {
        code: err.code,
        provider: deps.ai.name,
      });
      const mapped = AI_STATUS[err.code];
      return apiError(mapped.status, err.code, mapped.message, {
        retryable: true,
      });
    }
    throw err;
  }
}
