import { DraftEvent } from '@gsc/contracts';
import { disagreements } from './consensus';

/** Builds events from "order:string:fret" specs ("x" = dead note). */
const events = (...specs: string[]): DraftEvent[] =>
  specs.map((spec, i) => {
    const [order, stringIndex, fret] = spec.split(':');
    return {
      id: `e${i + 1}`,
      order: Number(order),
      stringIndex: Number(stringIndex),
      fret: fret === 'x' ? null : Number(fret),
      durationTicks: null,
      techniques: [],
      confidence: 0.9,
    };
  });

describe('disagreements', () => {
  it('flags nothing when readings agree, regardless of spacing and ids', () => {
    const a = events('0:4:7', '0:5:5', '1:4:5');
    const b = events('2:5:5', '2:4:7', '5:4:5');
    expect(disagreements(a, [b])).toEqual([]);
  });

  it('flags every note in a column the other reading did not reproduce', () => {
    // Second reading puts the chord one string higher (tilted photo).
    const a = events('0:5:0', '1:4:7', '1:5:5', '2:4:5');
    const b = events('0:5:0', '1:3:7', '1:4:5', '2:4:5');
    const [u] = disagreements(a, [b]);
    expect(u.eventIds).toEqual(['e2', 'e3']);
    expect(u.reason).toMatch(/second reading .* disagreed/);
  });

  it('flags a column where one reading saw fewer stacked notes', () => {
    const a = events('0:4:x', '0:5:x', '1:5:0');
    const b = events('0:4:x', '1:5:0');
    expect(disagreements(a, [b])[0].eventIds).toEqual(['e1', 'e2']);
  });

  it('reports notes only the other reading found, without event ids', () => {
    const a = events('0:3:5', '1:3:7');
    const b = events('0:3:5', '1:3:7', '2:4:5');
    expect(disagreements(a, [b])).toEqual([
      { eventIds: [], reason: expect.stringMatching(/not in this draft/) },
    ]);
  });

  it('combines several other readings', () => {
    const a = events('0:3:5', '1:3:7', '2:4:5');
    expect(
      disagreements(a, [
        events('0:3:6', '1:3:7', '2:4:5'),
        events('0:3:5', '1:3:7', '2:4:3'),
      ])[0].eventIds,
    ).toEqual(['e1', 'e3']);
  });
});
