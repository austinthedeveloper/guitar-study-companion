import { Phrase, PracticePlan, PracticeSession } from '@gsc/contracts';
import { PhraseStore } from './phrases';
import { PracticeStore } from './practice';

/** In-memory PhraseStore for handler tests. */
export function memoryStore(): PhraseStore {
  const rows: (Phrase & { userId: string })[] = [];
  return {
    async create(userId, input) {
      const p = {
        ...input,
        id: String(rows.length + 1),
        revision: 1,
        favorite: false,
        createdAt: '2026-10-13T00:00:00.000Z',
        updatedAt: '2026-10-13T00:00:00.000Z',
      };
      rows.push({ ...p, userId });
      return p;
    },
    async get(userId, id) {
      const row = rows.find((r) => r.id === id && r.userId === userId);
      if (!row) return null;
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { userId: _u, ...p } = row;
      return p;
    },
    async updateHarmony(userId, id, update) {
      const row = rows.find((r) => r.id === id && r.userId === userId);
      if (!row) return 'not_found';
      if (row.revision !== update.revision) return 'conflict';
      row.revision += 1;
      row.context = {
        ...row.context,
        key: update.key,
        chords: update.chords,
        chordChanges: update.chordChanges,
      };
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { userId: _u, ...p } = row;
      return p;
    },
    async saveExplanation(userId, id, explanation) {
      const row = rows.find((r) => r.id === id && r.userId === userId);
      if (!row) return 'not_found';
      if (row.revision !== explanation.phraseRevision) return 'conflict';
      row.explanation = explanation;
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { userId: _u, ...p } = row;
      return p;
    },
    async list(userId) {
      return rows
        .filter((r) => r.userId === userId)
        .reverse()
        .map(({ userId: _u, ...p }) => p);
    },
    async updateMeta(userId, id, meta) {
      const row = rows.find((r) => r.id === id && r.userId === userId);
      if (!row) return null;
      Object.assign(row, meta);
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { userId: _u, ...p } = row;
      return p;
    },
  };
}

/** In-memory PracticeStore for handler tests. */
export function memoryPracticeStore(): PracticeStore {
  const plans: (PracticePlan & { userId: string })[] = [];
  const sessions = new Map<string, PracticeSession>();
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const strip = ({ userId, ...p }: PracticePlan & { userId: string }) => p;
  return {
    async createPlan(userId, plan) {
      const p = {
        ...plan,
        id: `plan${plans.length + 1}`,
        createdAt: '2026-10-16T00:00:00.000Z',
        userId,
      };
      plans.push(p);
      return strip(p);
    },
    async getPlan(userId, planId) {
      const p = plans.find((x) => x.id === planId && x.userId === userId);
      return p ? strip(p) : null;
    },
    async latestPlan(userId, phraseId) {
      const p = plans
        .filter((x) => x.phraseId === phraseId && x.userId === userId)
        .at(-1);
      return p ? strip(p) : null;
    },
    async getSession(userId, planId) {
      return sessions.get(`${userId}:${planId}`) ?? null;
    },
    async saveSession(userId, planId, update) {
      const s = { planId, ...update, updatedAt: '2026-10-16T00:00:00.000Z' };
      sessions.set(`${userId}:${planId}`, s);
      return s;
    },
  };
}
