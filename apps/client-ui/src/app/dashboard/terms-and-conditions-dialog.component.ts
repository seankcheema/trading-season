import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { DashboardDialogComponent } from './shared/dashboard-dialog.component';

@Component({
  selector: 'app-terms-and-conditions-dialog',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FormsModule, DashboardDialogComponent],
  template: `
    <app-dashboard-dialog
      dialogTitle="Terms and Conditions"
      closeLabel="Decline terms and sign out"
      (closed)="declined.emit()"
    >
      <div class="space-y-4 text-sm leading-6">
        <p class="text-muted-foreground">
          TradingSeason is a simulated trading platform. You must review and accept these terms
          before the dashboard becomes available.
        </p>

        <div class="bg-muted/40 border-border max-h-[45vh] overflow-y-auto rounded-xl border p-4">
          <div class="space-y-4">
            @for (section of sections(); track section.title) {
              <section>
                <h3 class="text-foreground text-sm font-semibold">{{ section.title }}</h3>
                @for (paragraph of section.paragraphs; track paragraph) {
                  <p class="text-muted-foreground mt-2">{{ paragraph }}</p>
                }
              </section>
            }
          </div>
        </div>

        <div class="rounded-xl border border-amber-500/30 bg-amber-500/8 p-3 text-sm">
          <p class="font-medium text-amber-200">Signature requirement</p>
          <p class="text-muted-foreground mt-1">
            Type your full name exactly as shown below to confirm you reviewed the platform terms.
          </p>
          <p class="mt-2 font-semibold">{{ signatureName() }}</p>
        </div>

        <label class="block">
          <span class="text-foreground mb-2 block text-sm font-medium">Typed signature</span>
          <input
            type="text"
            class="border-border bg-background h-11 w-full rounded-lg border px-3"
            [ngModel]="signatureValue()"
            (ngModelChange)="updateSignature($event)"
            autocomplete="name"
          />
        </label>

        @if (errorMessage()) {
          <p class="text-loss text-sm">{{ errorMessage() }}</p>
        }

        <div class="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <button
            type="button"
            class="border-border hover:bg-muted h-11 rounded-lg border px-4 text-sm font-medium"
            (click)="declined.emit()"
          >
            Sign out
          </button>
          <button
            type="button"
            class="bg-primary text-primary-foreground h-11 rounded-lg px-4 text-sm font-semibold disabled:opacity-50"
            [disabled]="!canAccept() || submitting()"
            (click)="accepted.emit()"
          >
            {{ submitting() ? 'Saving…' : 'Accept terms' }}
          </button>
        </div>
      </div>
    </app-dashboard-dialog>
  `,
})
export class TermsAndConditionsDialogComponent {
  readonly signatureName = input.required<string>();
  readonly signature = input.required<{ (): string; set(value: string): void }>();
  readonly submitting = input(false);
  readonly errorMessage = input<string | null>(null);
  readonly accepted = output<void>();
  readonly declined = output<void>();

  protected readonly canAccept = computed(
    () =>
      this.signatureValue().trim() === this.signatureName().trim() &&
      this.signatureName().trim().length > 0,
  );

  protected readonly sections = computed(() => [
    {
      title: '1. Educational simulation only',
      paragraphs: [
        'TradingSeason provides a simulated environment for learning and practicing investment decisions. It does not provide brokerage, custody, investment advisory, or execution services.',
        'Prices, portfolio values, fills, and account balances shown in the application are generated for simulation and training purposes only and must not be treated as live market quotations or financial records.',
      ],
    },
    {
      title: '2. No financial, legal, or tax advice',
      paragraphs: [
        'Content in the platform is for general informational use and does not constitute a recommendation to buy, sell, or hold any security or strategy.',
        'You remain solely responsible for any real-world investment, tax, legal, or compliance decisions you make outside this simulation.',
      ],
    },
    {
      title: '3. Risk acknowledgement',
      paragraphs: [
        'You acknowledge that securities trading involves risk, including the possibility of loss, volatility, illiquidity, delayed data, and model or system error.',
        'Any margin, leverage, execution, gain/loss, or account outcome examples in the platform are educational illustrations only and may differ materially from real-world results.',
      ],
    },
    {
      title: '4. User responsibilities',
      paragraphs: [
        'You agree to provide accurate registration information, protect your credentials, and use the platform only for lawful and authorized purposes.',
        'You must not attempt to interfere with other users, reverse engineer restricted services, scrape protected data, or use the platform to test abusive or fraudulent activity.',
      ],
    },
    {
      title: '5. Platform controls and records',
      paragraphs: [
        'The platform may suspend access, invalidate sessions, or restrict features to protect users, data integrity, or system operations.',
        'The platform records acceptance of these terms by user account and timestamp. Continued use after acceptance is treated as ongoing agreement to the current platform terms.',
      ],
    },
  ]);

  protected signatureValue(): string {
    return this.signature()();
  }

  protected updateSignature(value: string): void {
    this.signature().set(value);
  }
}