import {
  CreatePhraseRequestSchema,
  Explanation,
  Phrase,
  PhraseSummary,
  UpdateHarmonyRequest,
  UpdateHarmonyRequestSchema,
  UpdatePhraseMetaRequest,
  UpdatePhraseMetaRequestSchema,
  PhraseQuerySchema,
} from '@gsc/contracts';
import {
  formatKey,
  matchesIntervalPattern,
  parseIntervalPattern,
  parseKey,
  phraseFacets,
  validateEvents,
} from '@gsc/music-domain';
import { apiError, HandlerResponse, staleRevision, zodIssues } from './http';

/** Persistence port; implemented by @gsc/api/data-access PhraseRepository. */
export interface PhraseStore {
  create(
    userId: string,
    input: ReturnType<typeof CreatePhraseRequestSchema.parse>,
  ): Promise<Phrase>;
  get(userId: string, id: string): Promise<Phrase | null>;
  /** All of a user's phrases, newest first. */
  list(userId: string): Promise<Phrase[]>;
  updateMeta(
    userId: string,
    id: string,
    meta: UpdatePhraseMetaRequest,
  ): Promise<Phrase | null>;
  updateHarmony(
    userId: string,
    id: string,
    update: UpdateHarmonyRequest,
  ): Promise<Phrase | 'not_found' | 'conflict'>;
  /** Stores an explanation if the phrase is still at explanation.phraseRevision. */
  saveExplanation(
    userId: string,
    id: string,
    explanation: Explanation,
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

/**
 * The library: every phrase with its computed facets, filtered by the
 * query. Facets come from the verified notes each time, so they can't
 * drift from the music.
 */
export async function listPhrases(
  query: Record<string, string | undefined>,
  deps: PhraseDeps,
): Promise<HandlerResponse> {
  const parsed = PhraseQuerySchema.safeParse(query);
  if (!parsed.success)
    return apiError(400, 'validation_failed', 'Invalid search.', {
      issues: zodIssues(parsed.error),
    });
  const q = parsed.data;
  const pattern = q.interval ? parseIntervalPattern(q.interval) : null;
  if (q.interval && !pattern)
    return apiError(
      400,
      'validation_failed',
      'Interval pattern not understood.',
      {
        issues: [
          {
            path: 'interval',
            message:
              'Use interval names like "m3 down, M2 up" (P1 m2 M2 m3 M3 P4 TT P5 ...).',
          },
        ],
      },
    );
  const wantKey = q.key ? parseKey(q.key) : null;
  if (q.key && !wantKey)
    return apiError(400, 'validation_failed', 'Key not understood.', {
      issues: [{ path: 'key', message: 'Use a key like A, F#m, or Bb minor.' }],
    });
  const words = (q.q ?? '').toLowerCase().split(/\s+/).filter(Boolean);

  const summaries: PhraseSummary[] = [];
  for (const p of await deps.store.list(deps.userId)) {
    const facets = phraseFacets({
      events: p.events,
      tuningMidi: p.context.tuningMidi,
      capo: p.context.capo,
      key: p.context.key,
    });
    const text = [
      p.title,
      p.source.bookTitle,
      p.source.songTitle,
      p.source.author,
      p.notes,
      ...p.tags,
    ]
      .filter(Boolean)
      .join(' ')
      .toLowerCase();
    if (words.some((w) => !text.includes(w))) continue;
    if (wantKey && facets.key !== formatKey(wantKey)) continue;
    if (q.technique && !facets.techniques.includes(q.technique)) continue;
    if (q.tag && !p.tags.includes(q.tag)) continue;
    if (q.favorite !== undefined && p.favorite !== q.favorite) continue;
    if (pattern && !matchesIntervalPattern(facets.steps, pattern)) continue;
    summaries.push({
      id: p.id,
      title: p.title,
      source: p.source,
      createdAt: p.createdAt,
      tags: p.tags,
      favorite: p.favorite,
      facets,
    });
  }
  return { status: 200, body: summaries };
}

export async function updatePhraseMeta(
  id: string,
  body: unknown,
  deps: PhraseDeps,
): Promise<HandlerResponse> {
  const parsed = UpdatePhraseMetaRequestSchema.safeParse(body);
  if (!parsed.success)
    return apiError(400, 'validation_failed', 'Invalid update.', {
      issues: zodIssues(parsed.error),
    });
  const phrase = await deps.store.updateMeta(deps.userId, id, parsed.data);
  return phrase
    ? { status: 200, body: phrase }
    : apiError(404, 'not_found', 'Phrase not found.');
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
  if (result === 'conflict') return staleRevision();
  return { status: 200, body: result };
}
