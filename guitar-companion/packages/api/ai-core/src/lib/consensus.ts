import { DraftEvent, Uncertainty } from '@gsc/contracts';

/** Events grouped into left-to-right columns (same order = same column). */
function groupColumns(events: readonly DraftEvent[]): DraftEvent[][] {
  const byOrder = new Map<number, DraftEvent[]>();
  for (const e of events)
    byOrder.set(e.order, [...(byOrder.get(e.order) ?? []), e]);
  return [...byOrder.entries()].sort(([a], [b]) => a - b).map(([, v]) => v);
}

/** A column's content, ignoring spacing, ids, and confidence. */
function columnKey(column: readonly DraftEvent[]): string {
  return column
    .map((e) => `${e.stringIndex}:${e.fret ?? 'x'}`)
    .sort()
    .join('+');
}

/** Indexes of a's items that belong to a longest common subsequence with b. */
function matchedIndexes(
  a: readonly string[],
  b: readonly string[],
): Set<number> {
  const dp = Array.from({ length: a.length + 1 }, () =>
    new Array<number>(b.length + 1).fill(0),
  );
  for (let i = 1; i <= a.length; i++)
    for (let j = 1; j <= b.length; j++)
      dp[i][j] =
        a[i - 1] === b[j - 1]
          ? dp[i - 1][j - 1] + 1
          : Math.max(dp[i - 1][j], dp[i][j - 1]);
  const matched = new Set<number>();
  for (let i = a.length, j = b.length; i > 0 && j > 0;) {
    if (a[i - 1] === b[j - 1]) {
      matched.add(i - 1);
      i--;
      j--;
    } else if (dp[i - 1][j] >= dp[i][j - 1]) i--;
    else j--;
  }
  return matched;
}

/**
 * Compares a draft with independent readings of the same image. Columns the
 * other readings did not reproduce become uncertainties, so the editor
 * highlights them for review. Model self-reported confidence proved a poor
 * signal (fixture eval 2026-10-16); disagreement between readings is better.
 */
export function disagreements(
  primary: readonly DraftEvent[],
  others: readonly (readonly DraftEvent[])[],
): Uncertainty[] {
  const columns = groupColumns(primary);
  const keys = columns.map(columnKey);
  const disputed = new Set<number>();
  let missed = false;
  for (const other of others) {
    const otherKeys = groupColumns(other).map(columnKey);
    const matched = matchedIndexes(keys, otherKeys);
    keys.forEach((_, i) => matched.has(i) || disputed.add(i));
    if (otherKeys.length > matched.size) missed = true;
  }
  const out: Uncertainty[] = [];
  if (disputed.size > 0)
    out.push({
      eventIds: [...disputed].flatMap((i) => columns[i].map((e) => e.id)),
      reason:
        'A second reading of the image disagreed on these notes. Check them against the page.',
    });
  else if (missed)
    out.push({
      eventIds: [],
      reason:
        'A second reading of the image found notes that are not in this draft. Check for missing notes.',
    });
  return out;
}
