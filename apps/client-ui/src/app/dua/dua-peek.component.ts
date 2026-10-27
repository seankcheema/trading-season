import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { DuaFigureComponent, DuaMood } from './dua-figure.component';

// The name, in a data-secret attribute, of the masked field wrapper an element sits in, so a
// form can tell when focus is on a field Dua should look away from. Null elsewhere.
export function secretFieldOf(target: EventTarget | null): string | null {
  return target instanceof Element
    ? (target.closest('[data-secret]')?.getAttribute('data-secret') ?? null)
    : null;
}

// Dua peeking over the top edge of a card, such as the sign-in form. The host page puts it as
// the first child of a relatively positioned wrapper around the card, which then paints over
// Dua's lower half; Dua rises into view once the page loads.
@Component({
  selector: 'app-dua-peek',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [DuaFigureComponent],
  host: { 'aria-hidden': 'true', 'data-testid': 'dua-peek', '[attr.data-mood]': 'mood()' },
  template: `<app-dua-figure [framed]="false" [mood]="mood()" [sweating]="sweating()" />`,
  styles: `
    :host {
      position: absolute;
      top: 0;
      left: 50%;
      width: 160px;
      height: 160px;
      pointer-events: none;
      /* The card's edge falls just below Dua's smile. */
      transform: translate(-50%, -92%);
      animation: dua-peek-rise 640ms cubic-bezier(0.34, 1.56, 0.64, 1) 250ms both;
    }

    app-dua-figure {
      width: 100%;
      height: 100%;
    }

    @keyframes dua-peek-rise {
      from {
        transform: translate(-50%, -20%);
      }
    }

    @media (prefers-reduced-motion: reduce) {
      :host {
        animation: none;
      }
    }
  `,
})
export class DuaPeekComponent {
  readonly mood = input<DuaMood>('happy');
  // Passed to the figure: the worried drop runs and forms again while this is on.
  readonly sweating = input(false);
}
