import { NgTemplateOutlet } from '@angular/common';
import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { DuaSpeech } from './dua-speech.service';

// The bubble beside Dua's launcher holding what Dua is saying, with rising bubbles for a
// celebration. Each bubble is drawn inside one of two live regions that are always present,
// polite for most lines and an alert for errors, so screen readers announce it once.
@Component({
  selector: 'app-dua-speech-bubble',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [NgTemplateOutlet],
  template: `
    <!-- The regions are always present, so a line placed in one is announced. -->
    <div class="dua-says" role="status" aria-atomic="true" data-testid="dua-says">
      @if (speech.line(); as line) {
        @if (line.tone !== 'error') {
          <ng-container *ngTemplateOutlet="bubble; context: { $implicit: line }" />
        }
      }
    </div>
    <div class="dua-says" role="alert" aria-atomic="true" data-testid="dua-warns">
      @if (speech.line(); as line) {
        @if (line.tone === 'error') {
          <ng-container *ngTemplateOutlet="bubble; context: { $implicit: line }" />
        }
      }
    </div>

    <ng-template #bubble let-line>
      <!-- One bubble per line, so each pops in afresh. -->
      @for (current of [line]; track current.id) {
        <div
          class="dua-bubble"
          [class]="'tone-' + current.tone"
          data-testid="dua-bubble"
          [attr.data-line-id]="current.id"
        >
          <p>{{ current.text }}</p>
          @if (current.duration) {
            <span
              class="bubble-bar"
              aria-hidden="true"
              [style.animation-duration.ms]="current.duration"
            ></span>
          }
        </div>
        @if (current.tone === 'celebrate') {
          <span class="dua-burst" aria-hidden="true">
            @for (bubble of bubbles; track bubble) {
              <span></span>
            }
          </span>
        }
      }
    </ng-template>
  `,
  styleUrl: './dua-speech-bubble.component.css',
})
export class DuaSpeechBubbleComponent {
  protected readonly speech = inject(DuaSpeech);
  protected readonly bubbles = [1, 2, 3, 4, 5, 6, 7];
}
