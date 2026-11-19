import {
  NoteAnalysis,
  NoteFact,
  NoteRole,
  NoteRoles,
  shortStep,
} from '@gsc/music-domain';

/** Role text with music symbols: "b7" reads "♭7", "#11" reads "♯11". */
export function displayRole(label: string): string {
  return label.replace(/b(?=\d)/g, '♭').replace(/#/g, '♯');
}

/** How a note sits against its chord: the colour family it uses. */
export function roleKind(
  role: NoteRole | null | undefined,
): 'root' | 'chord' | 'other' | null {
  if (!role) return null;
  if (role.label === 'R') return 'root';
  return role.chordTone ? 'chord' : 'other';
}

/** Facts for one tab column, shown as rows under the strings. */
export interface TabColumnAnnotation {
  /** Note names sounding at the column, lowest first. */
  notes: string[];
  /** Roles of those notes over the chord in effect (may be empty). */
  roles: NoteRole[];
  /** Short melodic step from the previous column, e.g. "↓m3". */
  step: string | null;
}

/** A note's display name: "x" when dead, "G→A" for a bend. */
export function noteText(n: NoteFact): string {
  if (n.dead) return 'x';
  const name = n.name ?? '?';
  return n.bendToName ? `${name}→${n.bendToName}` : name;
}

/** Annotations for each tab column (by order), from computed facts. */
export function tabAnnotations(
  orders: readonly number[],
  analysis: NoteAnalysis,
  roles: Readonly<Record<string, NoteRoles>>,
): TabColumnAnnotation[] {
  const byOrder = new Map(analysis.columns.map((c) => [c.order, c]));
  return orders.map((order) => {
    const col = byOrder.get(order);
    const notes = col?.notes ?? [];
    return {
      notes: notes.map(noteText),
      roles: notes.flatMap((n) => roles[n.eventId]?.note ?? []),
      step: col ? shortStep(col.fromPrevious, col.chordIntervals) : null,
    };
  });
}
