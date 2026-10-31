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
            class="rounded-full border px-3 py-1 font-medium"
            [class]="
              i === current()
                ? 'border-brand bg-brand font-semibold text-on-brand'
                : i < current()
                  ? 'border-rule-strong bg-paper-raised text-ink'
                  : 'border-transparent bg-paper-sunk text-ink-muted'
            "
            [attr.aria-current]="i === current() ? 'step' : null"
          >
            <span class="font-mono">{{ i + 1 }}.</span> {{ label }}
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
