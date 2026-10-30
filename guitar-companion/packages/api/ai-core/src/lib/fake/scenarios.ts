/**
 * Synthetic recognition results. The lick is invented for testing and is
 * not taken from any publication.
 */
const lick = {
  stringCount: 6,
  rhythmKnown: false,
  events: [
    {
      id: 'e1',
      order: 0,
      stringIndex: 1,
      fret: 15,
      durationTicks: null,
      techniques: ['bend'],
      bendSemitones: 2,
      confidence: 0.94,
    },
    {
      id: 'e2',
      order: 1,
      stringIndex: 0,
      fret: 15,
      durationTicks: null,
      techniques: [],
      confidence: 0.97,
    },
    {
      id: 'e3',
      order: 2,
      stringIndex: 0,
      fret: 17,
      durationTicks: null,
      techniques: ['vibrato'],
      confidence: 0.9,
    },
    {
      id: 'e4',
      order: 3,
      stringIndex: 1,
      fret: 17,
      durationTicks: null,
      techniques: ['slide'],
      confidence: 0.55,
    },
    {
      id: 'e5',
      order: 4,
      stringIndex: 1,
      fret: 15,
      durationTicks: null,
      techniques: [],
      confidence: 0.92,
    },
    {
      id: 'e6',
      order: 5,
      stringIndex: 2,
      fret: 14,
      durationTicks: null,
      techniques: [],
      confidence: 0.88,
    },
    {
      id: 'e7',
      order: 5,
      stringIndex: 1,
      fret: 15,
      durationTicks: null,
      techniques: [],
      confidence: 0.86,
    },
  ],
  uncertainties: [
    {
      eventIds: ['e4'],
      reason: 'Slide marking is faint; it may be a legato slur.',
    },
  ],
  detectedSymbols: ['8va', 'hold bend'],
  notes: 'Synthetic draft from the fake provider.',
};

export const FAKE_SCENARIOS = {
  default: { kind: 'draft', draft: lick },
  'rhythm-known': {
    kind: 'draft',
    draft: {
      ...lick,
      rhythmKnown: true,
      events: lick.events.map((e) => ({ ...e, durationTicks: 240 })),
      uncertainties: [],
    },
  },
  'partial-rhythm': {
    kind: 'draft',
    draft: {
      ...lick,
      rhythmKnown: true,
      events: lick.events.map((e, i) => ({
        ...e,
        durationTicks: i === 0 ? null : 240,
      })),
    },
  },
  'invalid-events': {
    kind: 'draft',
    draft: {
      ...lick,
      events: [
        ...lick.events,
        {
          id: 'e8',
          order: 6,
          stringIndex: 8,
          fret: 3,
          durationTicks: null,
          techniques: [],
          confidence: 0.4,
        },
        {
          id: 'e9',
          order: 7,
          stringIndex: 0,
          fret: 31,
          durationTicks: null,
          techniques: [],
          confidence: 0.3,
        },
      ],
    },
  },
  empty: {
    kind: 'draft',
    draft: {
      ...lick,
      events: [],
      uncertainties: [
        { eventIds: [], reason: 'No tablature found in the selected area.' },
      ],
    },
  },
  'poor-quality': {
    kind: 'draft',
    draft: {
      ...lick,
      imageQuality: 'poor',
      imageQualityReason: 'Glare covers part of the second string.',
    },
  },
  unreadable: {
    kind: 'draft',
    draft: {
      ...lick,
      imageQuality: 'unreadable',
      imageQualityReason:
        'The photo is blurred, so stacked fret numbers run together.',
    },
  },
  'invalid-output': { kind: 'draft', draft: { hello: 'not a transcription' } },
  unavailable: { kind: 'throw', message: 'Simulated provider outage' },
  timeout: { kind: 'hang' },
} as const satisfies Record<
  string,
  | { kind: 'draft'; draft: unknown }
  | { kind: 'throw'; message: string }
  | { kind: 'hang' }
>;

export type FakeScenario = keyof typeof FAKE_SCENARIOS;

export function isFakeScenario(
  value: string | undefined,
): value is FakeScenario {
  return !!value && value in FAKE_SCENARIOS;
}
