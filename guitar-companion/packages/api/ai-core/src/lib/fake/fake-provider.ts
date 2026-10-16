import {
  AiProvider,
  GenerateJsonInput,
  InterpretTabInput,
  RawInterpretResult,
  RawJsonResult,
} from '../ai-provider';
import type { CoachFacts } from '../coach';
import type { ExplainFacts } from '../explain';
import { FAKE_SCENARIOS, FakeScenario, isFakeScenario } from './scenarios';

/**
 * Deterministic, cost-free provider for local development and e2e. Returns
 * a synthetic (non-copyrighted) draft; `scenario` selects failure modes.
 */
export class FakeAiProvider implements AiProvider {
  readonly name = 'fake';

  async interpretTab(input: InterpretTabInput): Promise<RawInterpretResult> {
    const scenario: FakeScenario = isFakeScenario(input.scenario)
      ? input.scenario
      : 'default';
    const behaviour = FAKE_SCENARIOS[scenario];
    await failIfAsked(behaviour, input.signal);
    // failIfAsked has thrown for every other kind; this narrows the type.
    if (behaviour.kind !== 'draft') throw new Error('unreachable');
    return {
      draft: structuredClone(behaviour.draft),
      model: `fake-${scenario}`,
      usage: { inputTokens: 0, outputTokens: 0 },
    };
  }

  async generateJson(input: GenerateJsonInput): Promise<RawJsonResult> {
    if (isFakeScenario(input.scenario))
      await failIfAsked(FAKE_SCENARIOS[input.scenario], input.signal);
    if (input.task === 'coach-exercises')
      return {
        json: fakeCoaching(input.data as CoachFacts),
        model: 'fake-coach',
        usage: { inputTokens: 0, outputTokens: 0 },
      };
    return {
      json: fakeExplanation(input.data as ExplainFacts),
      model: 'fake-explain',
      usage: { inputTokens: 0, outputTokens: 0 },
    };
  }
}

/** Throws (or hangs until aborted) for the failure scenarios; otherwise returns. */
async function failIfAsked(
  behaviour: (typeof FAKE_SCENARIOS)[FakeScenario],
  signal?: AbortSignal,
): Promise<void> {
  if (behaviour.kind === 'throw') throw new Error(behaviour.message);
  if (behaviour.kind === 'hang') {
    await new Promise<void>((resolve) =>
      signal?.addEventListener('abort', () => resolve()),
    );
    throw new Error('aborted');
  }
}

/** A deterministic explanation built only from the given facts. */
function fakeExplanation(facts: ExplainFacts) {
  const first = facts.steps.find((s) => s.notes.some((n) => n.name));
  const note = first?.notes.find((n) => n.name);
  const points = [];
  if (first && note)
    points.push({
      kind: 'observation',
      text: `Opens on ${note.name}${note.role ? `, the ${note.role} of ${first.chord}` : ''}.`,
      eventIds: first.notes.map((n) => n.id),
      assumption: null,
    });
  points.push({
    kind: 'interpretation',
    text: 'Synthetic interpretation from the fake provider.',
    eventIds: [],
    assumption: {
      unknown: 'No chord placement was given.',
      assumed: 'One chord is assumed for the whole phrase.',
      placed: 'The chords are where the player placed them.',
    }[facts.chords.placement],
  });
  return {
    summary: `Synthetic explanation of "${facts.title}" (fake provider).`,
    points,
  };
}

/** One deterministic tip per exercise, naming its first note. */
function fakeCoaching(facts: CoachFacts) {
  return {
    exercises: facts.exercises.map((x) => ({
      id: x.id,
      tips: [
        `Synthetic tip: start from ${x.notes[0]?.name ?? 'the first note'} and stay relaxed.`,
      ],
    })),
  };
}
