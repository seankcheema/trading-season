import { CdkTrapFocus } from '@angular/cdk/a11y';
import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { SessionTimeoutService } from './session-timeout.service';

// The warning a minute before an inactivity sign-out (WCAG 2.2.1): an alert dialog that takes
// focus on its button, so keyboard and screen reader users hear it and can answer at once. Any
// input also keeps the session, which takes the dialog down; focus then returns where it was.
@Component({
  selector: 'app-session-warning',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CdkTrapFocus],
  template: `
    @if (session.warning()) {
      <div class="fixed inset-0 z-[90] flex items-center justify-center bg-black/60 px-4">
        <section
          cdkTrapFocus
          [cdkTrapFocusAutoCapture]="true"
          role="alertdialog"
          aria-modal="true"
          aria-labelledby="session-warning-title"
          aria-describedby="session-warning-text"
          class="border-border bg-card w-full max-w-sm rounded-2xl border p-5 shadow-2xl"
          data-testid="session-warning"
        >
          <h2 id="session-warning-title" class="text-base font-semibold">Still there?</h2>
          <p id="session-warning-text" class="text-muted-foreground mt-2 text-sm">
            For your security you will be signed out in about a minute because you have been
            inactive.
          </p>
          <div class="mt-5 flex justify-end">
            <button
              type="button"
              class="bg-primary text-primary-foreground hover:bg-primary/85 h-9 cursor-pointer rounded-lg px-4 text-sm font-medium"
              (click)="session.staySignedIn()"
            >
              Stay signed in
            </button>
          </div>
        </section>
      </div>
    }
  `,
})
export class SessionWarningComponent {
  protected readonly session = inject(SessionTimeoutService);
}
