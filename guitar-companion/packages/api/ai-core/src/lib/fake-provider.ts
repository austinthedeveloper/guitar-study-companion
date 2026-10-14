import { AiProvider } from './ai-provider';

/** Deterministic, cost-free provider for local development and e2e tests. */
export class FakeAiProvider implements AiProvider {
  readonly name = 'fake';
}
