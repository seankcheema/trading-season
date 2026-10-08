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
          These platform terms govern TradingSeason access for business clients and their
          authorised users. You must review and accept them before the dashboard becomes
          available.
        </p>

        <p class="text-muted-foreground text-xs uppercase tracking-[0.24em]">
          Effective date: 8 October 2026
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
            Type your full name exactly as shown below to confirm that you reviewed these terms
            and accept them for your use of the platform.
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
      title: '1. Business use and authorised access',
      paragraphs: [
        'These terms apply to business clients and the individual users they authorise to access TradingSeason for training, evaluation, and workflow familiarisation.',
        'By accepting them, you confirm that you are acting on your own behalf and, where applicable, with authority to use the platform for your employer or client organisation.',
      ],
    },
    {
      title: '2. Simulation-only platform',
      paragraphs: [
        'TradingSeason is a simulated environment only. It is not a brokerage, execution venue, custodian, clearing service, settlement platform, or investment advisory service.',
        'Orders, prices, balances, fills, and portfolio values shown in the application are generated or replayed for simulation purposes and must not be treated as live market instructions, executable prices, or records of any real account.',
      ],
    },
    {
      title: '3. No advice and no live-market reliance',
      paragraphs: [
        'Nothing in TradingSeason constitutes financial, investment, legal, tax, accounting, regulatory, or compliance advice.',
        'You and your organisation remain solely responsible for any real-world investment, treasury, legal, or compliance decision made outside the platform.',
      ],
    },
    {
      title: '4. Client and user responsibilities',
      paragraphs: [
        'You must provide accurate registration details, protect your credentials, and use the platform only for legitimate and authorised business purposes.',
        'You must not interfere with platform security, scrape protected data, impersonate another person, or use the platform to test abusive, manipulative, or unlawful trading conduct.',
      ],
    },
    {
      title: '5. Records and platform controls',
      paragraphs: [
        'The platform records your acceptance of these terms against your user profile together with an acceptance timestamp.',
        'Every order you confirm, its fill price, and the resulting cash and holding changes are permanently recorded against your account and cannot be edited or deleted.',
        'The operator may suspend access, invalidate sessions, or restrict features where necessary to protect users, data integrity, or service operations.',
      ],
    },
    {
      title: '6. Availability and risk notice',
      paragraphs: [
        'Availability, replay completeness, and simulation accuracy are not guaranteed, and simulated results may differ materially from live-market outcomes.',
        'You should independently verify any concept, workflow, or output before using it in a live investing, brokerage, finance, or compliance setting.',
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