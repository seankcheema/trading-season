import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { DuaFigureComponent, DuaMood } from './dua-figure.component';

// An empty list or chart with Dua above its message, so an empty state reads as Dua pointing
// the way rather than a blank. The message is projected, and stays the element's only text.
@Component({
  selector: 'app-dua-empty',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [DuaFigureComponent],
  host: { class: 'flex flex-col items-center gap-2 text-center' },
  template: `
    <app-dua-figure class="size-12" [mood]="mood()" />
    <ng-content />
  `,
})
export class DuaEmptyComponent {
  readonly mood = input<DuaMood>('happy');
}
