import { ChangeDetectionStrategy, Component, input } from '@angular/core';

export interface CompareRow {
  step: number;
  before: { notes: string; roles: string; chord: string | null };
  after: { notes: string; roles: string; chord: string | null };
}

/**
 * Each note before and after transposition with its role over the chord,
 * so it's visible that the musical function didn't change.
 */
@Component({
  selector: 'gsc-transpose-compare',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="overflow-x-auto">
      <table class="w-full text-left text-sm" data-testid="transpose-compare">
        <caption class="sr-only">
          Notes and chord-tone roles before and after transposing
        </caption>
        <thead class="text-stone-600">
          <tr>
            <th scope="col" class="py-1 pr-4 font-medium">#</th>
            <th scope="col" class="py-1 pr-4 font-medium">
              {{ beforeLabel() }}
            </th>
            <th scope="col" class="py-1 font-medium">{{ afterLabel() }}</th>
          </tr>
        </thead>
        <tbody>
          @for (r of rows(); track r.step) {
            <tr class="border-t border-stone-200" data-testid="compare-row">
              <td class="py-1 pr-4 tabular-nums text-stone-500">
                {{ r.step }}
              </td>
              <td class="py-1 pr-4">
                {{ r.before.notes }}
                @if (r.before.roles) {
                  <span class="text-stone-600"
                    >({{ r.before.roles }} of {{ r.before.chord }})</span
                  >
                }
              </td>
              <td class="py-1">
                {{ r.after.notes }}
                @if (r.after.roles) {
                  <span class="text-stone-600"
                    >({{ r.after.roles }} of {{ r.after.chord }})</span
                  >
                }
              </td>
            </tr>
          }
        </tbody>
      </table>
    </div>
  `,
})
export class TransposeCompareComponent {
  readonly rows = input.required<readonly CompareRow[]>();
  readonly beforeLabel = input('Original');
  readonly afterLabel = input('Transposed');
}
