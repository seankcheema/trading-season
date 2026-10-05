import { ChangeDetectionStrategy, Component, input } from '@angular/core';

export interface HlmToastMessage {
  id: number;
  message: string;
  variant: "success" | "error";
  closing: boolean;
}

@Component({
  selector: "hlm-toaster",
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { "aria-label": "Notifications" },
  template: `
    <div class="toast-stack">
      @for (toast of messages(); track toast.id) {
        <div
          class="toast bg-card text-card-foreground border-border rounded-xl border p-4 shadow-lg"
          [class.toast-error]="toast.variant === 'error'"
          [class.toast-closing]="toast.closing"
          [attr.data-toast-id]="toast.id"
        >
          <p
            class="text-base font-medium"
            [attr.role]="toast.variant === 'error' ? 'alert' : 'status'"
            aria-atomic="true"
          >
            {{ toast.message }}
          </p>

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
      position: relative;
      padding: 1.125rem 1.5rem;
      text-align: center;
      pointer-events: auto;
      background: color-mix(in srgb, var(--color-gain) 12%, var(--card));
      border-color: color-mix(in srgb, var(--color-gain) 25%, var(--border));
      overflow-wrap: anywhere;
      opacity: 1;
      transition: opacity 400ms ease;
      animation: toast-rise 240ms cubic-bezier(0.16, 1, 0.3, 1);
    }
    @keyframes toast-rise {
      from { opacity: 0; transform: translateY(16px); }
      to { opacity: 1; transform: translateY(0); }
    }
    .toast-error {
      background: color-mix(in srgb, var(--destructive) 12%, var(--card));
      border-color: color-mix(in srgb, var(--destructive) 25%, var(--border));
    }
    .toast-closing {
      opacity: 0;
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
