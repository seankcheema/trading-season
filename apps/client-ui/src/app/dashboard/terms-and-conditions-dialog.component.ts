import {
  ChangeDetectionStrategy,
  Component,
  computed,
  input,
  output,
  signal,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { lucideChevronDown } from '@ng-icons/lucide';
import { DashboardDialogComponent } from './shared/dashboard-dialog.component';

@Component({
  selector: 'app-terms-and-conditions-dialog',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FormsModule, NgIcon, DashboardDialogComponent],
  providers: [provideIcons({ lucideChevronDown })],
  template: `
    <app-dashboard-dialog
      dialogTitle="Terms and Conditions"
      size="wide"
      [showClose]="false"
      [dismissOnBackdrop]="false"
      (closed)="declined.emit()"
    >
      <div class="space-y-4 text-sm leading-6">
        <p class="text-muted-foreground">
          TradingSeason is a simulated trading platform. Review and accept these terms to continue.
        </p>

        <!--
          The visible list sits over an invisible copy holding every header plus the tallest section
          body, so the dialog keeps one height while the list itself fits whichever section is open.
        -->
        <div class="relative">
          <div class="invisible rounded-xl border border-transparent" aria-hidden="true">
            <div class="divide-y">
              @for (section of sections(); track section.title) {
                <div class="h-11"></div>
              }
            </div>
            <div class="grid border-t border-transparent">
              @for (section of sections(); track section.title) {
                <div class="col-start-1 row-start-1 space-y-2 px-4 pt-1 pb-4">
                  @for (paragraph of section.paragraphs; track paragraph) {
                    <p>{{ paragraph }}</p>
                  }
                </div>
              }
            </div>
          </div>

          <div
            class="border-border absolute inset-x-0 top-0 divide-y overflow-hidden rounded-xl border"
          >
            @for (section of sections(); track section.title; let i = $index) {
              <div>
                <h3>
                  <button
                    type="button"
                    class="hover:bg-muted/40 focus-visible:ring-ring/50 flex h-11 w-full cursor-pointer items-center justify-between gap-3 px-4 text-left text-sm font-semibold outline-none focus-visible:ring-2 focus-visible:ring-inset"
                    [attr.id]="'terms-section-' + i"
                    [attr.aria-expanded]="openSection() === i"
                    [attr.aria-controls]="'terms-panel-' + i"
                    (click)="toggleSection(i)"
                  >
                    {{ section.title }}
                    <ng-icon
                      name="lucideChevronDown"
                      class="text-muted-foreground text-[16px] transition-transform"
                      [class.rotate-180]="openSection() === i"
                    />
                  </button>
                </h3>
                @if (openSection() === i) {
                  <div
                    role="region"
                    class="text-muted-foreground space-y-2 px-4 pt-1 pb-4"
                    [attr.id]="'terms-panel-' + i"
                    [attr.aria-labelledby]="'terms-section-' + i"
                  >
                    @for (paragraph of section.paragraphs; track paragraph) {
                      <p>{{ paragraph }}</p>
                    }
                  </div>
                }
              </div>
            }
          </div>
        </div>

        <div class="space-y-2">
          <p class="text-muted-foreground">
            Sign by typing your full name:
            <strong class="text-foreground font-semibold">{{ signatureName() }}</strong>
          </p>
          <div class="flex flex-col gap-2 sm:flex-row">
            <input
              type="text"
              aria-label="Typed signature"
              class="border-border bg-background h-10 w-full rounded-lg border px-3 sm:flex-1"
              [ngModel]="signatureValue()"
              (ngModelChange)="updateSignature($event)"
              autocomplete="name"
            />
            <div class="flex gap-2">
              <button
                type="button"
                class="border-border hover:bg-muted h-10 flex-1 cursor-pointer rounded-lg border px-4 text-sm font-medium sm:w-28 sm:flex-none"
                (click)="declined.emit()"
              >
                Sign out
              </button>
              <button
                type="button"
                class="bg-primary text-primary-foreground h-10 flex-1 cursor-pointer rounded-lg px-4 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-50 sm:w-28 sm:flex-none"
                [disabled]="!canAccept() || submitting()"
                (click)="accepted.emit()"
              >
                {{ submitting() ? 'Saving…' : 'Accept' }}
              </button>
            </div>
          </div>
          <p class="text-loss min-h-5 text-sm">{{ errorMessage() }}</p>
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

  // One section is open at a time; the first starts open.
  protected readonly openSection = signal<number | null>(0);

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

  protected toggleSection(index: number): void {
    this.openSection.update((open) => (open === index ? null : index));
  }

  protected signatureValue(): string {
    return this.signature()();
  }

  protected updateSignature(value: string): void {
    this.signature().set(value);
  }
}