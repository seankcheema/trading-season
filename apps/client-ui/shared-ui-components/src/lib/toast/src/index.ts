import { ChangeDetectionStrategy, Component, input } from '@angular/core';

export interface HlmToastMessage {
  id: number;
  message: string;
  variant: "success" | "error";
  closing: boolean;
  /** Milliseconds before the toast starts closing; drives the countdown bar. */
  duration: number;
}

@Component({
  selector: "hlm-toaster",
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { "aria-label": "Notifications" },
  template: `
    <div class="toast-stack">
      @for (toast of messages(); track toast.id) {
        <div
          class="toast text-card-foreground"
          [class.toast-error]="toast.variant === 'error'"
          [class.toast-closing]="toast.closing"
          [attr.data-toast-id]="toast.id"
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
          <p
            class="text-base font-medium"
            [attr.role]="toast.variant === 'error' ? 'alert' : 'status'"
            aria-atomic="true"
          >
            {{ toast.message }}
          </p>
          <span class="toast-bar" aria-hidden="true" [style.animation-duration.ms]="toast.duration"></span>
        </div>
      }
    </div>
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
      margin: 0;
      min-width: 0;
      text-align: left;
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
}
