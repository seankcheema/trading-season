import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';

export interface HlmToastMessage {
  id: number;
  message: string;
  variant: "success" | "error";
  closing: boolean;
  /**
   * Milliseconds before the toast starts closing; drives the countdown bar. Null for a toast
   * that stays until it is dismissed.
   */
  duration: number | null;
}

// The notifications at the bottom of the screen. Screen readers hear each message from one of
// two live regions that are always on the page (a polite one for success, an assertive one for
// errors), since a live region created together with its text is often not announced. They are
// bare aria-live regions rather than role="status" and role="alert", so an empty one is never
// mistaken for a page's own status or alert. Each toast has a Dismiss button, and pointing at
// or focusing a toast holds its countdown.
@Component({
  selector: "hlm-toaster",
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="toast-stack" aria-label="Notifications">
      <div class="sr-only" aria-live="polite" data-toast-live="polite">
        @for (toast of polite(); track toast.id) {
          <p>{{ toast.message }}</p>
        }
      </div>
      <div class="sr-only" aria-live="assertive" data-toast-live="assertive">
        @for (toast of assertive(); track toast.id) {
          <p>{{ toast.message }}</p>
        }
      </div>
      @for (toast of messages(); track toast.id) {
        <div
          class="toast text-card-foreground"
          [class.toast-error]="toast.variant === 'error'"
          [class.toast-closing]="toast.closing"
          [attr.data-toast-id]="toast.id"
          (mouseenter)="paused.emit(toast.id)"
          (mouseleave)="resumed.emit(toast.id)"
          (focusin)="paused.emit(toast.id)"
          (focusout)="resumed.emit(toast.id)"
        >
          <span class="toast-icon" aria-hidden="true">
            @if (toast.variant === 'error') {
              <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="2.25" stroke-linecap="round" stroke-linejoin="round">
                <path d="M10 5.5v5.5M10 14.25v.01" />
              </svg>
            } @else {
              <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="2.25" stroke-linecap="round" stroke-linejoin="round">
                <path d="m5.5 10.5 3 3 6-7" />
              </svg>
            }
          </span>
          <!-- Hidden from screen readers, which hear the message from the live regions above. -->
          <p class="text-base font-medium" aria-hidden="true">{{ toast.message }}</p>
          <button
            type="button"
            class="toast-dismiss"
            aria-label="Dismiss notification"
            (click)="dismissed.emit(toast.id)"
          >
            <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true">
              <path d="m6 6 8 8M14 6l-8 8" />
            </svg>
          </button>
          @if (toast.duration !== null) {
            <span class="toast-bar" aria-hidden="true" [style.animation-duration.ms]="toast.duration"></span>
          }
        </div>
      }
    </section>
  `,
  styles: `
    .toast-stack {
      position: fixed;
      z-index: 1000;
      bottom: max(3rem, env(safe-area-inset-bottom));
      left: 50%;
      transform: translateX(-50%);
      width: max-content;
      max-width: min(26rem, calc(100vw - 2rem));
      display: flex;
      flex-direction: column;
      gap: 0.75rem;
      pointer-events: none;
    }
    .toast {
      --toast-accent: var(--color-gain);
      position: relative;
      display: flex;
      align-items: center;
      gap: 0.875rem;
      min-width: min(18rem, calc(100vw - 2rem));
      padding: 1rem 1.25rem 1.125rem;
      border: 1px solid color-mix(in srgb, var(--toast-accent) 30%, var(--border));
      border-radius: 1rem;
      background: color-mix(in srgb, var(--toast-accent) 10%, var(--card));
      -webkit-backdrop-filter: blur(12px);
      backdrop-filter: blur(12px);
      overflow: hidden;
      overflow-wrap: anywhere;
      pointer-events: auto;
      opacity: 1;
      transform: translateY(0);
      transition:
        opacity 400ms ease,
        transform 400ms cubic-bezier(0.7, 0, 0.84, 0);
      animation: toast-rise 420ms cubic-bezier(0.16, 1, 0.3, 1);
    }
    .toast-error {
      --toast-accent: var(--destructive);
    }
    .toast-icon {
      flex: none;
      display: grid;
      place-items: center;
      width: 1.75rem;
      height: 1.75rem;
      border-radius: 9999px;
      color: var(--toast-accent);
      background: color-mix(in srgb, var(--toast-accent) 18%, transparent);
    }
    .toast-icon svg {
      width: 1rem;
      height: 1rem;
    }
    .toast p {
      flex: 1;
      margin: 0;
      min-width: 0;
      text-align: left;
    }
    .toast-dismiss {
      flex: none;
      display: grid;
      place-items: center;
      width: 1.75rem;
      height: 1.75rem;
      margin: -0.25rem -0.5rem -0.25rem 0;
      border-radius: 9999px;
      color: var(--muted-foreground);
      cursor: pointer;
    }
    .toast-dismiss:hover {
      color: var(--foreground);
      background: color-mix(in srgb, var(--foreground) 10%, transparent);
    }
    .toast-dismiss svg {
      width: 1rem;
      height: 1rem;
    }
    .toast-bar {
      position: absolute;
      left: 0;
      right: 0;
      bottom: 0;
      height: 3px;
      background: var(--toast-accent);
      opacity: 0.4;
      transform-origin: left center;
      animation: toast-countdown linear forwards;
    }
    /* Held while the toast is pointed at or focused, as its timer is. */
    .toast:hover .toast-bar,
    .toast:focus-within .toast-bar {
      animation-play-state: paused;
    }
    @keyframes toast-rise {
      from { opacity: 0; transform: translateY(calc(100% + 3rem)); }
      to { opacity: 1; transform: translateY(0); }
    }
    @keyframes toast-countdown {
      from { transform: scaleX(1); }
      to { transform: scaleX(0); }
    }
    .toast-closing {
      opacity: 0;
      transform: translateY(calc(100% + 3rem));
      pointer-events: none;
    }
    @media (prefers-reduced-motion: reduce) {
      .toast {
        transition: none;
        animation: none;
      }
    }
  `,
})
export class HlmToaster {
  readonly messages = input<readonly HlmToastMessage[]>([]);
  /** The toast's Dismiss button was pressed. */
  readonly dismissed = output<number>();
  /** The toast is pointed at or focused: hold its countdown. */
  readonly paused = output<number>();
  /** Pointer and focus have left the toast: let its countdown run again. */
  readonly resumed = output<number>();

  protected readonly polite = computed(() =>
    this.messages().filter((toast) => toast.variant === 'success' && !toast.closing),
  );
  protected readonly assertive = computed(() =>
    this.messages().filter((toast) => toast.variant === 'error' && !toast.closing),
  );
}
