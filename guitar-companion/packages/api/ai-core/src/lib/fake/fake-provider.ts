import {
  AiProvider,
  InterpretTabInput,
  RawInterpretResult,
} from '../ai-provider';
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
}
