import { Phrase } from '@gsc/contracts';
import { PhraseStore } from './phrases';

/** In-memory PhraseStore for handler tests. */
export function memoryStore(): PhraseStore {
  const rows: (Phrase & { userId: string })[] = [];
  return {
    async create(userId, input) {
      const p = {
        ...input,
        id: String(rows.length + 1),
        revision: 1,
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
        .map(({ id, title, source, createdAt }) => ({
          id,
          title,
          source,
          createdAt,
        }));
    },
  };
}
