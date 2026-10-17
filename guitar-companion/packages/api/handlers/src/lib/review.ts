import {
  Phrase,
  PracticeHistoryEntry,
  PracticePlan,
  PracticeSession,
  REVIEW_KINDS,
  ReviewItem,
} from '@gsc/contracts';
import { apiError, HandlerResponse } from './http';
import { PhraseStore } from './phrases';
import { PracticeStore } from './practice';

/** A finished plan comes back for review after this long without practice. */
export const REVIEW_AFTER_DAYS = 7;
/** Phrases never practised are listed, newest first, up to this many. */
const NOT_STARTED_LIMIT = 5;
const DAY = 24 * 60 * 60 * 1000;

function summarize(
  phrase: Phrase,
  plan: PracticePlan,
  session: PracticeSession | undefined,
): PracticeHistoryEntry {
  const progress = Object.values(session?.progress ?? {});
  const ids = new Set(plan.exercises.map((x) => x.id));
  return {
    planId: plan.id,
    createdAt: plan.createdAt,
    settings: plan.settings,
    exercises: plan.exercises.length,
    completed: Object.entries(session?.progress ?? {}).filter(
      ([id, p]) => ids.has(id) && p.completedAt,
    ).length,
    lastPracticed: progress.length && session ? session.updatedAt : null,
    stale: plan.phraseRevision < phrase.revision,
  };
}

/**
 * What needs attention, most urgent first: unfinished practice, finished
 * plans due for another run, plans or explanations built for an older
 * version of the phrase, then a few phrases never practised.
 */
export function buildReviewQueue(
  phrases: readonly Phrase[],
  plans: readonly PracticePlan[],
  sessions: readonly PracticeSession[],
  now: Date,
): ReviewItem[] {
  const latest = new Map<string, PracticePlan>();
  for (const p of plans) {
    const prev = latest.get(p.phraseId);
    if (!prev || p.createdAt > prev.createdAt) latest.set(p.phraseId, p);
  }
  const sessionOf = new Map(sessions.map((s) => [s.planId, s]));
  const items: ReviewItem[] = [];
  let notStarted = 0;
  for (const phrase of phrases) {
    const base = { phraseId: phrase.id, title: phrase.title };
    const plan = latest.get(phrase.id);
    if (
      phrase.explanation &&
      phrase.explanation.phraseRevision < phrase.revision
    )
      items.push({
        ...base,
        kind: 'stale-explanation',
        detail: 'The explanation was written for an earlier version.',
        at: phrase.explanation.createdAt,
      });
    if (!plan) {
      if (notStarted++ < NOT_STARTED_LIMIT)
        items.push({
          ...base,
          kind: 'not-started',
          detail: 'No practice plan yet.',
          at: null,
        });
      continue;
    }
    const h = summarize(phrase, plan, sessionOf.get(plan.id));
    const last = h.lastPracticed ?? h.createdAt;
    if (h.stale)
      items.push({
        ...base,
        kind: 'stale-plan',
        detail: 'The practice plan was built for an earlier version.',
        at: h.createdAt,
      });
    else if (h.completed < h.exercises)
      items.push({
        ...base,
        kind: 'unfinished',
        detail: `${h.completed} of ${h.exercises} exercises done.`,
        at: last,
      });
    else {
      const days = Math.floor((now.getTime() - Date.parse(last)) / DAY);
      if (days >= REVIEW_AFTER_DAYS)
        items.push({
          ...base,
          kind: 'due',
          detail: `Finished ${days} days ago; time for a review run.`,
          at: last,
        });
    }
  }
  const rank = (k: ReviewItem['kind']) => REVIEW_KINDS.indexOf(k);
  return items.sort(
    (a, b) =>
      rank(a.kind) - rank(b.kind) || (b.at ?? '').localeCompare(a.at ?? ''),
  );
}

export interface ReviewDeps {
  phrases: PhraseStore;
  practice: PracticeStore;
  userId: string;
  now?: () => Date;
}

export async function getReview(deps: ReviewDeps): Promise<HandlerResponse> {
  const [phrases, plans, sessions] = await Promise.all([
    deps.phrases.list(deps.userId),
    deps.practice.plansForUser(deps.userId),
    deps.practice.sessionsForUser(deps.userId),
  ]);
  return {
    status: 200,
    body: buildReviewQueue(
      phrases,
      plans,
      sessions,
      deps.now?.() ?? new Date(),
    ),
  };
}

/** Every plan built for a phrase, newest first, with progress. */
export async function getPracticeHistory(
  phraseId: string,
  deps: ReviewDeps,
): Promise<HandlerResponse> {
  const phrase = await deps.phrases.get(deps.userId, phraseId);
  if (!phrase) return apiError(404, 'not_found', 'Phrase not found.');
  const [plans, sessions] = await Promise.all([
    deps.practice.plansForUser(deps.userId),
    deps.practice.sessionsForUser(deps.userId),
  ]);
  const sessionOf = new Map(sessions.map((s) => [s.planId, s]));
  return {
    status: 200,
    body: plans
      .filter((p) => p.phraseId === phraseId)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .map((p) => summarize(phrase, p, sessionOf.get(p.id))),
  };
}
