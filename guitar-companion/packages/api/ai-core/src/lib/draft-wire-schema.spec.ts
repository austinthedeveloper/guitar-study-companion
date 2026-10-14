import { TECHNIQUES } from '@gsc/contracts';
import { DRAFT_WIRE_JSON_SCHEMA } from './draft-wire-schema';

/** Strict structured-output modes require every property to be listed as required. */
function assertStrict(node: unknown, path = '$'): void {
  if (!node || typeof node !== 'object') return;
  const n = node as Record<string, unknown>;
  if (n['properties']) {
    expect(n['additionalProperties'], path).toBe(false);
    expect([...(n['required'] as string[])].sort(), path).toEqual(
      Object.keys(n['properties'] as object).sort(),
    );
    for (const [k, v] of Object.entries(n['properties'] as object))
      assertStrict(v, `${path}.${k}`);
  }
  if (n['items']) assertStrict(n['items'], `${path}[]`);
}

describe('DRAFT_WIRE_JSON_SCHEMA', () => {
  it('is strict-mode compatible', () => assertStrict(DRAFT_WIRE_JSON_SCHEMA));

  it('lists every contract technique', () => {
    expect(
      DRAFT_WIRE_JSON_SCHEMA.properties.events.items.properties.techniques.items
        .enum,
    ).toEqual([...TECHNIQUES]);
  });
});
