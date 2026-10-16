import {
  CreatePhraseRequestSchema,
  Phrase,
  PhraseSummary,
  UpdateHarmonyRequest,
  UpdateHarmonyRequestSchema,
} from '@gsc/contracts';
import { validateEvents } from '@gsc/music-domain';
import { apiError, HandlerResponse, zodIssues } from './http';

/** Persistence port; implemented by @gsc/api/data-access PhraseRepository. */
export interface PhraseStore {
  create(
    userId: string,
    input: ReturnType<typeof CreatePhraseRequestSchema.parse>,
  ): Promise<Phrase>;
  get(userId: string, id: string): Promise<Phrase | null>;
  list(userId: string): Promise<PhraseSummary[]>;
  updateHarmony(
    userId: string,
    id: string,
    update: UpdateHarmonyRequest,
  ): Promise<Phrase | 'not_found' | 'conflict'>;
}

export interface PhraseDeps {
  store: PhraseStore;
  userId: string;
}

export async function createPhrase(
  body: unknown,
  deps: PhraseDeps,
): Promise<HandlerResponse> {
  const parsed = CreatePhraseRequestSchema.safeParse(body);
  if (!parsed.success) {
    return apiError(400, 'validation_failed', 'Invalid phrase.', {
      issues: zodIssues(parsed.error),
    });
  }
  const { events, context, rhythmKnown } = parsed.data;
  const issues = validateEvents(events, {
    stringCount: context.tuningMidi.length,
    capo: context.capo,
    rhythmKnown,
  });
  if (issues.length > 0) {
    return apiError(
      422,
      'validation_failed',
      'The phrase has notes that need fixing.',
      {
        issues: issues.map((i) => ({
          path: i.eventId ? `events.${i.eventId}` : 'events',
          message: i.message,
        })),
      },
    );
  }
  return {
    status: 201,
    body: await deps.store.create(deps.userId, parsed.data),
  };
}

export async function getPhrase(
  id: string,
  deps: PhraseDeps,
): Promise<HandlerResponse> {
  const phrase = await deps.store.get(deps.userId, id);
  return phrase
    ? { status: 200, body: phrase }
    : apiError(404, 'not_found', 'Phrase not found.');
}

export async function listPhrases(deps: PhraseDeps): Promise<HandlerResponse> {
  return { status: 200, body: await deps.store.list(deps.userId) };
}

export async function updateHarmony(
  id: string,
  body: unknown,
  deps: PhraseDeps,
): Promise<HandlerResponse> {
  const parsed = UpdateHarmonyRequestSchema.safeParse(body);
  if (!parsed.success) {
    return apiError(400, 'validation_failed', 'Invalid harmony update.', {
      issues: zodIssues(parsed.error),
    });
  }
  const result = await deps.store.updateHarmony(deps.userId, id, parsed.data);
  if (result === 'not_found')
    return apiError(404, 'not_found', 'Phrase not found.');
  if (result === 'conflict')
    return apiError(
      409,
      'conflict',
      'This phrase changed since you opened it. Reload to see the latest version.',
    );
  return { status: 200, body: result };
}
