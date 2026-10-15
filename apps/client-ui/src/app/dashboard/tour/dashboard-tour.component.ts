import { DOCUMENT } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  Injector,
  OnDestroy,
  afterNextRender,
  computed,
  inject,
  output,
  signal,
  viewChild,
} from '@angular/core';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { lucideArrowRight, lucideSearch, lucideX } from '@ng-icons/lucide';
import { HlmButtonImports } from '@shared/ui-components/button';
import { TourProgressService } from './tour-progress.service';

export type TourPlacement = 'top' | 'bottom' | 'left' | 'right';

// How the tour ended: closed or skipped, or finished on its last step, which hands over to the
// stock search.
export type TourExit = 'dismissed' | 'find-stock';

export interface TourStep {
  // The element to spotlight, by its data-tour attribute; null centers the card on a scrim.
  target: string | null;
  title: string;
  body: string;
  place?: TourPlacement;
}

export interface TourRect {
  left: number;
  top: number;
  width: number;
  height: number;
}

// The first step introduces the tour and the last hands over to the search, so the counter
// and the progress dots cover the steps in between and the last.
export const TOUR_STEPS: readonly TourStep[] = [
  {
    target: null,
    title: 'Welcome to TradingSeason',
    body: 'Search stocks, place trades and watch your portfolio grow. This tour takes about 30 seconds.',
  },
  {
    target: 'search',
    title: 'Every trade starts with a search',
    body: 'Type a company or ticker, or press / from anywhere on the dashboard. Pick a result to open its order ticket.',
    place: 'bottom',
  },
  {
    target: 'net-worth',
    title: 'Your money',
    body: 'Net worth is your cash plus everything you own. Deposit or withdraw cash here at any time.',
    place: 'right',
  },
  {
    target: 'account',
    title: 'Accounts',
    body: 'Keep stocks in separate accounts, like Growth and Retirement. Your cash is shared by all of them; holdings and charts follow the account you pick.',
    place: 'bottom',
  },
  {
    target: 'portfolio',
    title: 'Track performance',
    body: 'See how the selected account has moved over a day, five days, a month or a year.',
    place: 'left',
  },
  {
    target: 'assets',
    title: 'Holdings and watch list',
    body: 'Click any row to trade it. Star a stock in its order ticket to keep it on your watch list.',
    place: 'top',
  },
  {
    target: 'search',
    title: "You're ready",
    body: 'Search for a stock and place your first trade.',
    place: 'bottom',
  },
];

// Space between the spotlight and its target, between the spotlight and the card, and the
// card's widest size and distance from the viewport edges.
const SPOTLIGHT_PADDING = 6;
const CARD_GAP = 14;
const CARD_WIDTH = 320;
const EDGE = 16;
const PLACEMENT_ORDER: readonly TourPlacement[] = ['bottom', 'top', 'right', 'left'];

// Where the card goes beside a spotlight: on the preferred side when it fits there, otherwise
// on the first side that does, and always kept inside the viewport. With no spotlight it is
// centered.
export function placeTourCard(
  rect: TourRect | null,
  preferred: TourPlacement | undefined,
  card: { width: number; height: number },
  viewport: { width: number; height: number },
): { left: number; top: number } {
  const { width, height } = card;
  const clamp = (left: number, top: number) => ({
    left: Math.max(EDGE, Math.min(viewport.width - width - EDGE, left)),
    top: Math.max(EDGE, Math.min(viewport.height - height - EDGE, top)),
  });
  if (!rect) {
    return clamp((viewport.width - width) / 2, (viewport.height - height) / 2);
  }
  const right = rect.left + rect.width;
  const bottom = rect.top + rect.height;
  const fits: Record<TourPlacement, boolean> = {
    bottom: bottom + CARD_GAP + height < viewport.height,
    top: rect.top - CARD_GAP - height > 0,
    right: right + CARD_GAP + width < viewport.width,
    left: rect.left - CARD_GAP - width > 0,
  };
  const side =
    preferred && fits[preferred]
      ? preferred
      : (PLACEMENT_ORDER.find((placement) => fits[placement]) ?? 'bottom');
  switch (side) {
    case 'bottom':
      return clamp(rect.left + rect.width / 2 - width / 2, bottom + CARD_GAP);
    case 'top':
      return clamp(rect.left + rect.width / 2 - width / 2, rect.top - CARD_GAP - height);
    case 'right':
      return clamp(right + CARD_GAP, rect.top + rect.height / 2 - height / 2);
    case 'left':
      return clamp(rect.left - CARD_GAP - width, rect.top + rect.height / 2 - height / 2);
  }
}

let nextTourId = 0;

// First-run spotlight tour of the dashboard, from the TradingSeason design system. Each step
// dims the page around one element and explains it in a card beside it. Esc closes, the arrow
// keys move between steps, and the step is saved so a reload resumes it. Clicks outside the
// card are blocked. The host makes the page behind inert while the tour is open and moves
// focus once it ends, as only it knows where focus should go.
@Component({
  selector: 'app-dashboard-tour',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [HlmButtonImports, NgIcon],
  providers: [provideIcons({ lucideArrowRight, lucideSearch, lucideX })],
  host: {
    '(document:keydown)': 'onKeydown($event)',
    '(window:resize)': 'measure()',
    '(window:scroll)': 'measure()',
  },
  template: `
    <div role="presentation" class="fixed inset-0 z-[80]" data-testid="dashboard-tour">
      @if (rect(); as spot) {
        <div
          aria-hidden="true"
          class="tour-spotlight pointer-events-none fixed rounded-2xl"
          data-testid="tour-spotlight"
          [style.left.px]="spot.left"
          [style.top.px]="spot.top"
          [style.width.px]="spot.width"
          [style.height.px]="spot.height"
        ></div>
      } @else {
        <div aria-hidden="true" class="tour-scrim fixed inset-0 bg-black/60 backdrop-blur-sm"></div>
      }

      <!-- One card per step, so each step pops in afresh. -->
      @for (current of [step()]; track current) {
        <section
          #card
          role="dialog"
          aria-modal="true"
          [attr.aria-labelledby]="titleId"
          [attr.aria-describedby]="bodyId"
          class="tour-card border-border bg-card fixed rounded-2xl border p-5 shadow-2xl shadow-black/50"
          [style.left.px]="position().left"
          [style.top.px]="position().top"
          [style.width.px]="cardWidth()"
        >
          @if (!rect()) {
            <img src="2b-waves.svg" alt="" class="mb-3 size-10" />
          }
          <div class="flex items-center justify-between gap-3">
            <span
              class="text-muted-foreground text-xs font-medium tracking-[0.04em] uppercase tabular-nums"
              data-testid="tour-progress"
            >
              {{ current === 0 ? 'Quick tour' : current + ' of ' + (steps.length - 1) }}
            </span>
            <button
              type="button"
              class="text-muted-foreground hover:bg-muted hover:text-foreground -mt-1.5 -mr-2 flex size-7 cursor-pointer items-center justify-center rounded-lg transition-colors"
              aria-label="Close tour"
              (click)="dismiss()"
            >
              <ng-icon name="lucideX" class="text-[16px]" />
            </button>
          </div>
          <h2 [id]="titleId" class="mt-1.5 text-lg font-semibold tracking-tight">
            {{ steps[current].title }}
          </h2>
          <p [id]="bodyId" class="text-muted-foreground mt-1.5 text-sm/normal text-pretty">
            {{ steps[current].body }}
          </p>
          <div class="mt-[18px] flex items-center justify-between gap-3">
            <div aria-hidden="true" class="flex gap-1">
              @for (dot of dots; track dot) {
                <span
                  class="tour-dot h-1.5 rounded-full"
                  data-testid="tour-dot"
                  [class]="
                    (dot === current ? 'w-4 ' : 'w-1.5 ') +
                    (dot <= current ? 'bg-primary' : 'bg-white/15')
                  "
                ></span>
              }
            </div>
            <div class="flex gap-2">
              @if (current === 0) {
                <button
                  hlmBtn
                  variant="ghost"
                  type="button"
                  class="cursor-pointer"
                  (click)="dismiss()"
                >
                  Skip
                </button>
              } @else {
                <button
                  hlmBtn
                  variant="ghost"
                  type="button"
                  class="cursor-pointer"
                  (click)="back()"
                >
                  Back
                </button>
              }
              <button
                #primary
                hlmBtn
                type="button"
                class="cursor-pointer rounded-[5px]"
                data-testid="tour-next"
                (click)="next()"
              >
                {{ current === 0 ? 'Start tour' : isLast() ? 'Find a stock' : 'Next' }}
                @if (isLast()) {
                  <ng-icon name="lucideSearch" class="text-[16px]" />
                } @else if (current > 0) {
                  <ng-icon name="lucideArrowRight" class="text-[16px]" />
                }
              </button>
            </div>
          </div>
        </section>
      }
    </div>
  `,
  styles: [
    `
      :host {
        display: contents;
      }

      .tour-spotlight {
        box-shadow:
          0 0 0 2px var(--primary),
          0 0 0 9999px rgb(0 0 0 / 0.62);
        transition: all 260ms cubic-bezier(0.16, 1, 0.3, 1);
      }

      .tour-scrim {
        animation: tour-fade-in 150ms ease-out both;
      }

      .tour-card {
        animation: tour-pop-in 200ms cubic-bezier(0.16, 1, 0.3, 1) both;
      }

      .tour-dot {
        transition: all 200ms;
      }

      @keyframes tour-fade-in {
        from {
          opacity: 0;
        }
      }

      @keyframes tour-pop-in {
        from {
          opacity: 0;
          transform: translateY(8px) scale(0.98);
        }
      }

      @media (prefers-reduced-motion: reduce) {
        .tour-spotlight,
        .tour-dot {
          transition: none;
        }

        .tour-scrim,
        .tour-card {
          animation: none;
        }
      }
    `,
  ],
})
export class DashboardTourComponent implements OnDestroy {
  private readonly _document = inject(DOCUMENT);
  private readonly _injector = inject(Injector);
  private readonly _progress = inject(TourProgressService);
  private readonly _card = viewChild<ElementRef<HTMLElement>>('card');
  private readonly _primary = viewChild<ElementRef<HTMLElement>>('primary');
  // Set once the tour has ended, so a late resize or render no longer measures.
  private _closed = false;

  readonly finished = output<TourExit>();

  protected readonly steps = TOUR_STEPS;
  protected readonly dots = TOUR_STEPS.slice(1).map((_, index) => index + 1);
  protected readonly titleId = `dashboard-tour-title-${nextTourId}`;
  protected readonly bodyId = `dashboard-tour-body-${nextTourId++}`;

  protected readonly step = signal(this._progress.savedStep(TOUR_STEPS.length));
  protected readonly isLast = computed(() => this.step() === TOUR_STEPS.length - 1);
  protected readonly rect = signal<TourRect | null>(null);
  private readonly _cardHeight = signal(190);
  private readonly _viewport = signal({ width: CARD_WIDTH + EDGE * 2, height: 0 });
  protected readonly cardWidth = computed(() =>
    Math.min(CARD_WIDTH, this._viewport().width - EDGE * 2),
  );
  protected readonly position = computed(() =>
    placeTourCard(
      this.rect(),
      TOUR_STEPS[this.step()].place,
      { width: this.cardWidth(), height: this._cardHeight() },
      this._viewport(),
    ),
  );

  constructor() {
    this.show(this.step());
  }

  ngOnDestroy(): void {
    this._closed = true;
  }

  protected next(): void {
    if (this.isLast()) {
      this.close('find-stock');
    } else {
      this.show(this.step() + 1);
    }
  }

  protected back(): void {
    this.show(Math.max(0, this.step() - 1));
  }

  protected dismiss(): void {
    this.close('dismissed');
  }

  protected onKeydown(event: KeyboardEvent): void {
    if (event.altKey || event.ctrlKey || event.metaKey) {
      return;
    }
    switch (event.key) {
      case 'Escape':
        event.preventDefault();
        this.dismiss();
        break;
      case 'ArrowRight':
        event.preventDefault();
        this.next();
        break;
      case 'ArrowLeft':
        event.preventDefault();
        this.back();
        break;
    }
  }

  // Spotlights the step's target, scrolling it into view first when the page scrolls (narrow
  // screens), and sizes the card. A target that is missing leaves the card centered.
  protected measure(): void {
    if (this._closed) {
      return;
    }
    const view = this._document.defaultView;
    this._viewport.set({ width: view?.innerWidth ?? 0, height: view?.innerHeight ?? 0 });
    const target = this.target();
    const box = target?.getBoundingClientRect();
    this.rect.set(
      box
        ? {
            left: box.left - SPOTLIGHT_PADDING,
            top: box.top - SPOTLIGHT_PADDING,
            width: box.width + SPOTLIGHT_PADDING * 2,
            height: box.height + SPOTLIGHT_PADDING * 2,
          }
        : null,
    );
    const card = this._card()?.nativeElement;
    if (card?.offsetHeight) {
      this._cardHeight.set(card.offsetHeight);
    }
  }

  private show(step: number): void {
    this.step.set(step);
    this._progress.saveStep(step);
    afterNextRender(
      () => {
        this.revealTarget();
        this.measure();
        this._primary()?.nativeElement.focus();
      },
      { injector: this._injector },
    );
  }

  private target(): HTMLElement | null {
    const name = TOUR_STEPS[this.step()].target;
    return name ? this._document.querySelector<HTMLElement>(`[data-tour="${name}"]`) : null;
  }

  private revealTarget(): void {
    const target = this.target();
    const view = this._document.defaultView;
    if (!target || !view) {
      return;
    }
    const box = target.getBoundingClientRect();
    if (box.top < 0 || box.bottom > view.innerHeight) {
      target.scrollIntoView?.({ block: 'center' });
    }
  }

  private close(exit: TourExit): void {
    this._progress.finish();
    this._closed = true;
    this.finished.emit(exit);
  }
}
