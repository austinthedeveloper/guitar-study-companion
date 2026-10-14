import { TECHNIQUES } from '@gsc/contracts';

/**
 * JSON Schema sent to providers for structured output. Written to satisfy
 * strict modes (every property required, optional values nullable, no
 * additional properties). Range checks happen afterwards in zod and
 * music-domain validation, never trusted from the provider.
 */
const box = {
  type: ['object', 'null'],
  additionalProperties: false,
  required: ['x', 'y', 'width', 'height'],
  properties: {
    x: { type: 'number' },
    y: { type: 'number' },
    width: { type: 'number' },
    height: { type: 'number' },
  },
} as const;

export const DRAFT_WIRE_JSON_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: [
    'stringCount',
    'rhythmKnown',
    'events',
    'uncertainties',
    'detectedSymbols',
    'notes',
  ],
  properties: {
    stringCount: { type: 'integer' },
    rhythmKnown: { type: 'boolean' },
    events: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: [
          'id',
          'order',
          'stringIndex',
          'fret',
          'durationTicks',
          'techniques',
          'bendSemitones',
          'confidence',
          'box',
        ],
        properties: {
          id: { type: 'string' },
          order: { type: 'integer' },
          stringIndex: { type: 'integer' },
          fret: { type: ['integer', 'null'] },
          durationTicks: { type: ['integer', 'null'] },
          techniques: {
            type: 'array',
            items: { type: 'string', enum: [...TECHNIQUES] },
          },
          bendSemitones: { type: ['number', 'null'] },
          confidence: { type: 'number' },
          box,
        },
      },
    },
    uncertainties: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['eventIds', 'reason', 'box'],
        properties: {
          eventIds: { type: 'array', items: { type: 'string' } },
          reason: { type: 'string' },
          box,
        },
      },
    },
    detectedSymbols: { type: 'array', items: { type: 'string' } },
    notes: { type: 'string' },
  },
} as const;

/** Converts wire nulls to the optional fields the contract schema expects. */
export function wireToDraft(wire: unknown): unknown {
  if (!wire || typeof wire !== 'object') return wire;
  const w = wire as Record<string, unknown>;
  const stripNull = (o: unknown) =>
    o && typeof o === 'object'
      ? Object.fromEntries(
          Object.entries(o).filter(([, v]) => v !== null || false),
        )
      : o;
  const events = Array.isArray(w['events'])
    ? w['events'].map((e) => {
        const ev = { ...(e as Record<string, unknown>) };
        if (ev['bendSemitones'] === null) delete ev['bendSemitones'];
        if (ev['box'] === null) delete ev['box'];
        return ev;
      })
    : w['events'];
  const uncertainties = Array.isArray(w['uncertainties'])
    ? w['uncertainties'].map(stripNull)
    : w['uncertainties'];
  return { ...w, events, uncertainties };
}
