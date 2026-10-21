import { CurrencyPipe, NgTemplateOutlet } from '@angular/common';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { lucideCheck, lucideChevronDown, lucideZap, lucideTrendingUp, lucideCircleStop, lucideGitBranch } from '@ng-icons/lucide';
import { DashboardHeaderDropdownComponent } from './dashboard-header-dropdown.component';
import { ChangeDetectionStrategy, Component, DestroyRef, ElementRef, computed, inject, input, signal, viewChild } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ExecutionType } from '../orders/order.models';
import { ExecutionSettingsService } from '../settings-dialog/execution-settings.service';
import { MenuKeyboardDirective } from './menu-keyboard.directive';

/** Compact stock execution controls shared by the dialog and full-screen ticket. */
@Component({
  selector: 'app-execution-controls',
  imports: [MenuKeyboardDirective, CurrencyPipe, NgTemplateOutlet, NgIcon, DashboardHeaderDropdownComponent],
  providers: [provideIcons({ lucideCheck, lucideChevronDown, lucideZap, lucideTrendingUp, lucideCircleStop, lucideGitBranch })],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="grid gap-3 text-xs">
      <div class="flex items-center justify-between gap-3">
        <span class="text-muted-foreground text-sm">Order type</span>
        <app-dashboard-header-dropdown
          #typeMenu ariaLabel="Order type" [label]="executionLabel()" [open]="typeOpen()"
          (openChange)="typeOpen.set($event)" containerClass="w-40" panelClass="w-full"
        >
          <span dropdownTrigger class="flex w-full items-center justify-between gap-2">
            <span class="flex items-center gap-2">
              <ng-icon [name]="executionIcon()" aria-hidden="true" class="text-primary text-[16px]" />
              {{ executionLabel() }}
            </span>
            <ng-icon name="lucideChevronDown" class="text-muted-foreground text-[14px]" />
          </span>
          <div role="menu" aria-label="Order types">
            @for (option of types; track option.value) {
              <button type="button" role="menuitemradio"
                class="hover:bg-muted flex h-9 w-full cursor-pointer items-center justify-between gap-2 rounded-lg px-2 text-left text-sm transition-colors"
                [attr.aria-checked]="executionType() === option.value" (click)="selectType(option.value)">
                <span class="flex items-center gap-2">
                  <ng-icon [name]="option.icon" aria-hidden="true" class="text-primary text-[16px]" />
                  {{ option.label }}
                </span>
                @if (executionType() === option.value) {
                  <ng-icon name="lucideCheck" class="text-primary text-[16px]" />
                }
              </button>
            }
          </div>
        </app-dashboard-header-dropdown>
      </div>

      <div class="border-border rounded-xl border p-3">
        <ng-content select="[shareHeader]" />
        <ng-content select="[shareQuantity]" />
        <div class="mt-2"><ng-content select="[shareSlider]" /></div>
      </div>

      <div class="bg-muted/60 space-y-2 rounded-xl p-3 text-sm">
        <dl>
        <div class="flex h-14 items-center justify-between gap-3">
          <dt class="text-muted-foreground shrink-0">{{ executionType() === 'MARKET' ? 'Market price' : executionLabel() + ' price' }}</dt>
          <dd class="min-w-0 max-w-[65%]" [class.w-32]="hasLimit() !== hasStop()" [class.w-52]="hasLimit() && hasStop()">
            @if (hasLimit() && hasStop()) {
              <div class="grid grid-cols-2 gap-2">
                <ng-container [ngTemplateOutlet]="stopField" />
                <ng-container [ngTemplateOutlet]="limitField" />
              </div>
            } @else if (hasLimit()) {
              <ng-container [ngTemplateOutlet]="limitField" />
            } @else if (hasStop()) {
              <ng-container [ngTemplateOutlet]="stopField" />
            } @else {
              <span class="text-base font-medium tabular-nums">{{ price() | currency: 'USD' }}</span>
            }
          </dd>
        </div>
        </dl>
        <ng-content select="[orderSummary]" />
      </div>

      @if (buffer() === null && !loadError()) {
        <span class="sr-only" role="status">Loading execution preference</span>
      } @else if (loadError()) {
        <p role="alert" class="text-loss">Unable to load trading preference.
          <button type="button" class="underline" (click)="load()">Retry</button></p>
      }
    </div>
    <ng-template #limitField>
      <div class="min-w-0">
        @if (hasLimit() && hasStop()) {
          <span class="text-muted-foreground block text-[10px]">Limit</span>
        }
        <div class="flex items-center gap-1.5">
          <span aria-hidden="true" class="text-muted-foreground text-base">$</span>
          <input aria-label="Limit price" aria-required="true" type="number" min="0.000001" step="0.000001"
            class="border-input bg-muted/40 text-foreground focus-visible:border-ring h-8 min-w-0 w-full rounded-lg border px-2 text-base font-medium tabular-nums"
            [class.border-primary]="limitPrice() === null" [class.bg-primary/10]="limitPrice() === null"
            [class.ring-1]="limitPrice() === null" [class.ring-primary/30]="limitPrice() === null"
            [attr.aria-invalid]="limitPrice() !== null && !validPrice(limitPrice())"
            [value]="limitPrice()" (input)="setPrice('limit', $event)" />
        </div>
      </div>
    </ng-template>
    <ng-template #stopField>
      <div class="min-w-0">
        @if (hasLimit() && hasStop()) {
          <span class="text-muted-foreground block text-[10px]">Stop</span>
        }
        <div class="flex items-center gap-1.5">
          <span aria-hidden="true" class="text-muted-foreground text-base">$</span>
          <input aria-label="Stop price" aria-required="true" type="number" min="0.000001" step="0.000001"
            class="border-input bg-muted/40 text-foreground focus-visible:border-ring h-8 min-w-0 w-full rounded-lg border px-2 text-base font-medium tabular-nums"
            [class.border-primary]="stopPrice() === null" [class.bg-primary/10]="stopPrice() === null"
            [class.ring-1]="stopPrice() === null" [class.ring-primary/30]="stopPrice() === null"
            [attr.aria-invalid]="stopPrice() !== null && !validPrice(stopPrice())"
            [value]="stopPrice()" (input)="setPrice('stop', $event)" />
        </div>
      </div>
    </ng-template>
  `,
})
export class ExecutionControlsComponent {
  readonly price = input.required<number>();
  readonly side = input.required<'buy' | 'sell'>();
  readonly quantity = input(0);
  readonly executionType = signal<ExecutionType>('MARKET');
  private readonly typeMenu = viewChild<DashboardHeaderDropdownComponent, ElementRef<HTMLElement>>('typeMenu', { read: ElementRef });
  protected readonly typeOpen = signal(false);
  protected readonly types: readonly { value: ExecutionType; label: string; icon: string }[] = [
    { value: 'MARKET', label: 'Market', icon: 'lucideZap' }, { value: 'LIMIT', label: 'Limit', icon: 'lucideTrendingUp' },
    { value: 'STOP', label: 'Stop', icon: 'lucideCircleStop' }, { value: 'STOP_LIMIT', label: 'Stop-Limit', icon: 'lucideGitBranch' },
  ];
  readonly executionLabel = computed(() => this.types.find((option) => option.value === this.executionType())!.label);
  readonly executionIcon = computed(() => this.types.find((option) => option.value === this.executionType())!.icon);
  readonly limitPrice = signal<number | null>(null);
  readonly stopPrice = signal<number | null>(null);
  readonly buffer = signal<number | null>(null);
  readonly loadError = signal(false);
  private readonly settings = inject(ExecutionSettingsService);
  private readonly destroyRef = inject(DestroyRef);
  readonly hasLimit = computed(() => ['LIMIT', 'STOP_LIMIT'].includes(this.executionType()));
  readonly hasStop = computed(() => ['STOP', 'STOP_LIMIT'].includes(this.executionType()));
  readonly bound = computed(() => {
    const raw = this.price() * (1 + (this.side() === 'buy' ? 1 : -1) * (this.buffer() ?? 1) / 100);
    return (this.side() === 'buy' ? Math.floor(raw * 1e6) : Math.ceil(raw * 1e6)) / 1e6;
  });
  readonly reservationPrice = computed(() => this.reservationPriceFor(this.price()));
  // Parents can calculate before child inputs have been bound, using their current quote.
  reservationPriceFor(price: number): number {
    if (!Number.isFinite(price) || price <= 0) {
      return 0;
    }
    return this.hasLimit() ? (this.limitPrice() ?? 0) : price * (1 + (this.buffer() ?? 1) / 100);
  }
  readonly valid = computed(
    () => this.buffer() !== null && !this.loadError() && this.pricesValid(),
  );
  readonly parameters = computed(() => ({ executionType: this.executionType(),
    ...(this.hasLimit() && this.limitPrice() !== null ? { limitPrice: this.limitPrice()! } : {}),
    ...(this.hasStop() && this.stopPrice() !== null ? { stopPrice: this.stopPrice()! } : {}),
  }));
  constructor() {
    this.settings.changed?.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((value) => this.buffer.set(value.executionBufferPercent));
    this.load();
  }
  load(): void {
    this.loadError.set(false);
    this.settings.load().pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (settings) => this.buffer.set(settings.executionBufferPercent),
      error: () => this.loadError.set(true),
    });
  }
  validPrice(value: number | null): boolean {
    if (value === null || !Number.isFinite(value)) {
      return false;
    }
    return value > 0 && value < 1e12 && Math.abs(value * 1e6 - Math.round(value * 1e6)) < 0.0001;
  }

  // A price that the chosen order type does not use cannot make the order invalid.
  private pricesValid(): boolean {
    const limitValid = !this.hasLimit() || this.validPrice(this.limitPrice());
    const stopValid = !this.hasStop() || this.validPrice(this.stopPrice());
    return limitValid && stopValid;
  }
  protected selectType(type: ExecutionType): void {
    this.executionType.set(type);
    this.typeOpen.set(false);
    this.typeMenu()?.nativeElement.querySelector('summary')?.focus();
  }
  protected setPrice(kind: 'limit' | 'stop', event: Event): void {
    const value = (event.target as HTMLInputElement).valueAsNumber;
    (kind === 'limit' ? this.limitPrice : this.stopPrice).set(Number.isFinite(value) ? value : null);
  }
}
