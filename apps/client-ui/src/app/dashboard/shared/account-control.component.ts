import { CurrencyPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { NgIcon, provideIcons } from '@ng-icons/core';
import {
  lucideBriefcaseBusiness,
  lucideCheck,
  lucideChevronDown,
  lucideEllipsis,
  lucidePlus,
} from '@ng-icons/lucide';
import { DashboardHeaderDropdownComponent } from './dashboard-header-dropdown.component';
import { AccountStore } from '../accounts/account-store.service';
import { Account } from '../accounts/account.models';

@Component({
  selector: 'app-account-control',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    class: 'block w-60 min-w-0 max-w-full',
    '[class.account-control-expanded]': 'expanded()',
  },
  styles: [
    `
      :host(.account-control-expanded) {
        width: 100%;
      }
    `,
  ],
  imports: [CurrencyPipe, NgIcon, DashboardHeaderDropdownComponent],
  providers: [
    provideIcons({
      lucideBriefcaseBusiness,
      lucideCheck,
      lucideChevronDown,
      lucideEllipsis,
      lucidePlus,
    }),
  ],

  template: `
    <app-dashboard-header-dropdown
      class="block"
      iconName="lucideBriefcaseBusiness"
      [label]="label()"
      [loading]="loading()"
      ariaLabel="Select account"
      [open]="open()"
      (openChange)="openChange.emit($event)"
      containerClass="w-full"
      [panelClass]="expanded() ? 'w-full max-h-[40dvh] overflow-y-auto' : 'w-full'"
      [triggerClass]="
        expanded()
          ? 'border-border bg-card hover:bg-muted h-10 w-full gap-3 rounded-lg border px-3 text-sm'
          : triggerClass()
      "
    >
      <div class="p-1" role="menu" aria-label="Accounts">
        @switch (store().status()) {
          @case ('error') {
            <p class="text-loss px-2 py-1.5 text-xs">We couldn't load your accounts.</p>

            <button
              type="button"
              role="menuitem"
              class="hover:bg-muted flex h-9 w-full cursor-pointer items-center gap-2 rounded-lg px-2 text-left text-sm transition-colors"
              (click)="store().load()"
            >
              Try again
            </button>
          }

          @case ('ready') {
            @for (account of store().accounts(); track account.accountId) {
              <div class="flex items-center gap-1">
                <button
                  type="button"
                  role="menuitemradio"
                  class="hover:bg-muted flex min-h-9 min-w-0 flex-1 cursor-pointer items-center gap-2 rounded-lg px-2 py-1.5 text-left text-sm transition-colors"
                  [attr.aria-checked]="account.accountId === store().selectedAccountId()"
                  (click)="selected.emit(account.accountId)"
                >
                  <span class="min-w-0 flex-1">
                    <span class="block truncate">{{ account.name }}</span>

                    <span class="text-muted-foreground block text-xs tabular-nums">
                      Portfolio

                      {{ portfolioValues().get(account.accountId) ?? 0 | currency: 'USD' }}
                    </span>
                  </span>

                  @if (account.accountId === store().selectedAccountId()) {
                    <ng-icon name="lucideCheck" class="text-primary shrink-0 text-[16px]" />
                  }
                </button>

                <button
                  type="button"
                  role="menuitem"
                  class="text-muted-foreground hover:bg-muted hover:text-foreground flex size-8 shrink-0 cursor-pointer items-center justify-center rounded-lg transition-colors"
                  [attr.aria-label]="'Settings for ' + account.name"
                  (click)="rename.emit(account)"
                >
                  <ng-icon name="lucideEllipsis" class="text-[14px]" />
                </button>
              </div>
            } @empty {
              <p class="text-muted-foreground px-2 py-1.5 text-xs">
                You don't have any accounts yet.
              </p>
            }

            <div class="border-border my-1 border-t"></div>

            <button
              type="button"
              role="menuitem"
              class="text-primary hover:bg-muted flex h-9 w-full cursor-pointer items-center gap-2 rounded-lg px-2 text-left text-sm transition-colors"
              (click)="create.emit()"
            >
              <ng-icon name="lucidePlus" class="shrink-0 text-[16px]" />

              <span>New account</span>
            </button>
          }

          @default {
            <p class="sr-only" role="status">Loading accounts…</p>
            @for (row of [1, 2]; track row) {
              <div
                class="flex min-h-9 flex-col justify-center gap-1.5 px-2 py-1.5"
                aria-hidden="true"
                data-testid="account-skeleton"
              >
                <span class="skeleton h-4 w-32"></span>
                <span class="skeleton h-3 w-24"></span>
              </div>
            }
          }
        }
      </div>
    </app-dashboard-header-dropdown>
  `,
})
export class AccountControlComponent {
  readonly store = input.required<AccountStore>();
  readonly expanded = input(false);
  readonly triggerClass = input('');
  readonly portfolioValues = input<ReadonlyMap<number, number>>(new Map());
  readonly open = input(false);
  readonly openChange = output<boolean>();
  readonly selected = output<number>();
  readonly create = output<void>();
  readonly rename = output<Account>();

  protected readonly loading = computed(
    () => this.store().status() === 'idle' || this.store().status() === 'loading',
  );

  protected readonly label = computed(() =>
    this.store().status() === 'ready'
      ? (this.store().selectedAccount()?.name ?? 'No accounts')
      : this.store().status() === 'error'
        ? 'Accounts unavailable'
        : 'Loading accounts…',
  );
}
