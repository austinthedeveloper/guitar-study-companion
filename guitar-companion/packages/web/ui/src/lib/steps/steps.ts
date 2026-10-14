import { ChangeDetectionStrategy, Component, input } from '@angular/core';

/** Progress indicator for multi-step flows. */
@Component({
  selector: 'gsc-steps',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <nav aria-label="Progress">
      <ol class="flex flex-wrap gap-2 text-sm">
        @for (label of steps(); track label; let i = $index) {
          <li
            class="rounded-full px-3 py-1"
            [class]="
              i === current()
                ? 'bg-brand-700 text-white'
                : i < current()
                  ? 'bg-stone-200 text-stone-800'
                  : 'bg-stone-100 text-stone-700'
            "
            [attr.aria-current]="i === current() ? 'step' : null"
          >
            {{ i + 1 }}. {{ label }}
          </li>
        }
      </ol>
    </nav>
  `,
})
export class StepsComponent {
  readonly steps = input.required<string[]>();
  readonly current = input(0);
}
