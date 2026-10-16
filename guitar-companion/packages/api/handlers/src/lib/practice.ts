import {
  CreatePlanRequestSchema,
  Exercise,
  PracticePlan,
  PracticeSession,
  UpdateSessionRequest,
  UpdateSessionRequestSchema,
} from '@gsc/contracts';
import { AiError, AiProvider, coachExercises } from '@gsc/api/ai-core';
import { planForPhrase } from '@gsc/music-domain';
import { apiError, HandlerResponse, staleRevision, zodIssues } from './http';
import { PhraseStore } from './phrases';

/** Persistence port; implemented by @gsc/api/data-access PracticeRepository. */
export interface PracticeStore {
  createPlan(
    userId: string,
    plan: Omit<PracticePlan, 'id' | 'createdAt'>,
  ): Promise<PracticePlan>;
  getPlan(userId: string, planId: string): Promise<PracticePlan | null>;
  latestPlan(userId: string, phraseId: string): Promise<PracticePlan | null>;
  getSession(userId: string, planId: string): Promise<PracticeSession | null>;
  saveSession(
    userId: string,
    planId: string,
    update: UpdateSessionRequest,
  ): Promise<PracticeSession>;
}

export interface PracticeDeps {
  phrases: PhraseStore;
  practice: PracticeStore;
  userId: string;
  ai: AiProvider;
  timeoutMs?: number;
  /** Fake-provider scenario; only passed through when E2E_MODE is enabled. */
  scenario?: string;
  log?: (message: string, data?: Record<string, unknown>) => void;
}

/**
 * Builds a plan from the stored phrase with rules, drops exercises the
 * review rejects, then asks AI for coaching tips. If coaching fails the
 * plan is still saved, with rule steps only (coachedBy: null).
 */
export async function createPlan(
  phraseId: string,
  body: unknown,
  deps: PracticeDeps,
): Promise<HandlerResponse> {
  const parsed = CreatePlanRequestSchema.safeParse(body);
  if (!parsed.success)
    return apiError(400, 'validation_failed', 'Invalid plan request.', {
      issues: zodIssues(parsed.error),
    });
  const phrase = await deps.phrases.get(deps.userId, phraseId);
  if (!phrase) return apiError(404, 'not_found', 'Phrase not found.');
  if (phrase.revision !== parsed.data.revision) return staleRevision();

  const { accepted, rejected } = planForPhrase({
    events: phrase.events,
    rhythmKnown: phrase.rhythmKnown,
    context: phrase.context,
    settings: parsed.data.settings,
  });
  if (accepted.length === 0)
    return apiError(
      422,
      'validation_failed',
      'This phrase has no playable notes to practise.',
    );
  let exercises: Exercise[] = accepted.map((x) => ({ ...x, coaching: [] }));

  let coachedBy: PracticePlan['coachedBy'] = null;
  try {
    const coaching = await coachExercises(deps.ai, phrase, exercises, {
      timeoutMs: deps.timeoutMs,
      scenario: deps.scenario,
    });
    exercises = exercises.map((x) => ({
      ...x,
      coaching: coaching.tips[x.id] ?? [],
    }));
    coachedBy = { provider: deps.ai.name, model: coaching.model };
    deps.log?.('coach.ok', {
      provider: deps.ai.name,
      model: coaching.model,
      exercises: exercises.length,
      droppedTips: coaching.droppedTips,
      inputTokens: coaching.usage?.inputTokens,
      outputTokens: coaching.usage?.outputTokens,
    });
  } catch (err) {
    if (!(err instanceof AiError)) throw err;
    deps.log?.('coach.ai_error', { code: err.code, provider: deps.ai.name });
  }

  const plan = await deps.practice.createPlan(deps.userId, {
    phraseId: phrase.id,
    phraseRevision: phrase.revision,
    settings: parsed.data.settings,
    exercises,
    rejected,
    coachedBy,
  });
  return { status: 201, body: plan };
}

export async function getLatestPlan(
  phraseId: string,
  deps: Pick<PracticeDeps, 'practice' | 'userId'>,
): Promise<HandlerResponse> {
  const plan = await deps.practice.latestPlan(deps.userId, phraseId);
  return plan
    ? { status: 200, body: plan }
    : apiError(404, 'not_found', 'No practice plan yet.');
}

export async function getSession(
  planId: string,
  deps: Pick<PracticeDeps, 'practice' | 'userId'>,
  now = () => new Date(),
): Promise<HandlerResponse> {
  const plan = await deps.practice.getPlan(deps.userId, planId);
  if (!plan) return apiError(404, 'not_found', 'Practice plan not found.');
  const session = await deps.practice.getSession(deps.userId, planId);
  const empty: PracticeSession = {
    planId,
    progress: {},
    notes: '',
    updatedAt: now().toISOString(),
  };
  return { status: 200, body: session ?? empty };
}

export async function saveSession(
  planId: string,
  body: unknown,
  deps: Pick<PracticeDeps, 'practice' | 'userId'>,
): Promise<HandlerResponse> {
  const parsed = UpdateSessionRequestSchema.safeParse(body);
  if (!parsed.success)
    return apiError(400, 'validation_failed', 'Invalid progress.', {
      issues: zodIssues(parsed.error),
    });
  const plan = await deps.practice.getPlan(deps.userId, planId);
  if (!plan) return apiError(404, 'not_found', 'Practice plan not found.');
  const ids = new Set(plan.exercises.map((x) => x.id));
  const unknown = Object.keys(parsed.data.progress).filter(
    (id) => !ids.has(id),
  );
  if (unknown.length)
    return apiError(
      400,
      'validation_failed',
      'Progress for unknown exercises.',
      {
        issues: unknown.map((id) => ({
          path: `progress.${id}`,
          message: 'Not an exercise in this plan',
        })),
      },
    );
  return {
    status: 200,
    body: await deps.practice.saveSession(deps.userId, planId, parsed.data),
  };
}
