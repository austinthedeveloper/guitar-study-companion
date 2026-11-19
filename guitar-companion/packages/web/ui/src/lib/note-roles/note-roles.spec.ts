import { displayRole, roleKind } from './note-roles';

describe('note roles', () => {
  it('writes flats and sharps as music symbols', () => {
    expect(displayRole('b7')).toBe('♭7');
    expect(displayRole('#11')).toBe('♯11');
    expect(displayRole('b7→R')).toBe('♭7→R');
    expect(displayRole('R')).toBe('R');
  });

  it('sorts roles into root, chord tone, and outside the chord', () => {
    expect(roleKind({ label: 'R', chordTone: true })).toBe('root');
    expect(roleKind({ label: 'b3', chordTone: true })).toBe('chord');
    expect(roleKind({ label: '4', chordTone: false })).toBe('other');
    expect(roleKind(null)).toBeNull();
  });
});
