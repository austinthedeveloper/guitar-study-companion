import {
  AiProvider,
  GenerateJsonInput,
  InterpretTabInput,
  RawInterpretResult,
  RawJsonResult,
} from '../ai-provider';
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
    if (behaviour.kind === 'throw') throw new Error(behaviour.message);
    if (behaviour.kind === 'hang') {
      await new Promise<void>((resolve) =>
        input.signal?.addEventListener('abort', () => resolve()),
      );
      throw new Error('aborted');
    }
    return {
      draft: structuredClone(behaviour.draft),
      model: `fake-${scenario}`,
      usage: { inputTokens: 0, outputTokens: 0 },
    };
  }

  async generateJson(input: GenerateJsonInput): Promise<RawJsonResult> {
    const behaviour = isFakeScenario(input.scenario)
      ? FAKE_SCENARIOS[input.scenario]
      : null;
    if (behaviour?.kind === 'throw') throw new Error(behaviour.message);
    if (behaviour?.kind === 'hang') {
      await new Promise<void>((resolve) =>
        input.signal?.addEventListener('abort', () => resolve()),
      );
      throw new Error('aborted');
    }
    return {
      json: fakeExplanation(input.data as ExplainFacts),
      model: 'fake-explain',
      usage: { inputTokens: 0, outputTokens: 0 },
    };
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
