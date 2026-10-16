/**
 * Karplus-Strong plucked string: a noise burst circulating through a
 * delay line one period long, averaged each pass so it decays like a
 * string. Deterministic (seeded noise) so it can be tested.
 */
export function pluckSamples(
  frequency: number,
  sampleRate: number,
  seconds: number,
  options: { damping?: number; seed?: number } = {},
): Float32Array<ArrayBuffer> {
  const damping = options.damping ?? 0.996;
  const period = Math.max(2, Math.round(sampleRate / frequency));
  const out = new Float32Array(Math.max(1, Math.round(sampleRate * seconds)));
  const line = new Float32Array(period);
  let seed = options.seed ?? 1;
  for (let i = 0; i < period; i++) {
    // xorshift32: cheap, repeatable noise.
    seed ^= seed << 13;
    seed ^= seed >>> 17;
    seed ^= seed << 5;
    line[i] = ((seed >>> 0) / 0xffffffff) * 2 - 1;
  }
  for (let i = 0; i < out.length; i++) {
    const j = i % period;
    const next = line[(j + 1) % period];
    out[i] = line[j];
    line[j] = damping * 0.5 * (line[j] + next);
  }
  return out;
}
