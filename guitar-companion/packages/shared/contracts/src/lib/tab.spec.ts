import { InterpretRequestSchema } from './imports';
import { CreatePhraseRequestSchema } from './phrase';
import { TabEventSchema, TranscriptionDraftSchema } from './tab';

const event = {
  id: 'e1',
  order: 0,
  stringIndex: 1,
  fret: 17,
  durationTicks: null,
  techniques: ['bend'],
  bendSemitones: 2,
};

describe('TabEventSchema', () => {
  it('accepts a bend with unknown rhythm', () => {
    expect(TabEventSchema.parse(event)).toEqual(event);
  });

  it('defaults techniques to []', () => {
    expect(
      TabEventSchema.parse({
        ...event,
        techniques: undefined,
        bendSemitones: undefined,
      }).techniques,
    ).toEqual([]);
  });

  it.each([
    ['negative fret', { fret: -1 }],
    ['fret beyond 24', { fret: 25 }],
    ['fractional fret', { fret: 1.5 }],
    ['bend not in half steps', { bendSemitones: 0.75 }],
    ['unknown technique', { techniques: ['shred'] }],
    ['zero duration', { durationTicks: 0 }],
  ])('rejects %s', (_label, patch) => {
    expect(TabEventSchema.safeParse({ ...event, ...patch }).success).toBe(
      false,
    );
  });

  it('allows a null fret (dead note)', () => {
    expect(
      TabEventSchema.safeParse({
        ...event,
        fret: null,
        techniques: ['dead-note'],
        bendSemitones: undefined,
      }).success,
    ).toBe(true);
  });
});

describe('TranscriptionDraftSchema', () => {
  it('applies defaults', () => {
    const draft = TranscriptionDraftSchema.parse({
      stringCount: 6,
      rhythmKnown: false,
      events: [{ ...event, confidence: 0.9 }],
    });
    expect(draft.uncertainties).toEqual([]);
    expect(draft.notes).toBe('');
  });

  it('rejects confidence outside 0..1', () => {
    expect(
      TranscriptionDraftSchema.safeParse({
        stringCount: 6,
        rhythmKnown: false,
        events: [{ ...event, confidence: 2 }],
      }).success,
    ).toBe(false);
  });
});

describe('InterpretRequestSchema', () => {
  const req = {
    image: { mimeType: 'image/png', dataBase64: 'aGVsbG8=' },
    tuningMidi: [64, 59, 55, 50, 45, 40],
    consent: true,
  };

  it('requires explicit consent', () => {
    expect(InterpretRequestSchema.safeParse(req).success).toBe(true);
    expect(
      InterpretRequestSchema.safeParse({ ...req, consent: false }).success,
    ).toBe(false);
  });

  it('rejects HEIC (must be converted client-side)', () => {
    expect(
      InterpretRequestSchema.safeParse({
        ...req,
        image: { ...req.image, mimeType: 'image/heic' },
      }).success,
    ).toBe(false);
  });
});

describe('CreatePhraseRequestSchema', () => {
  it('requires at least one event and trims the title', () => {
    const base = {
      title: '  Solo lick ',
      source: { bookTitle: 'Book' },
      context: { tuningMidi: [64, 59, 55, 50, 45, 40] },
      rhythmKnown: false,
      events: [event],
    };
    const parsed = CreatePhraseRequestSchema.parse(base);
    expect(parsed.title).toBe('Solo lick');
    expect(parsed.context.capo).toBe(0);
    expect(
      CreatePhraseRequestSchema.safeParse({ ...base, events: [] }).success,
    ).toBe(false);
  });
});
