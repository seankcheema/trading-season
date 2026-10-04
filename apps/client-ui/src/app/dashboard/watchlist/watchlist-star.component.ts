import { ChangeDetectionStrategy, Component, inject, input } from '@angular/core';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { lucideStar } from '@ng-icons/lucide';
import { WatchlistStore } from './watchlist-store.service';

@Component({
  selector: 'app-watchlist-star',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [NgIcon],
  providers: [provideIcons({ lucideStar })],
  template: `
    <button
      type="button"
      class="inline-flex size-8 items-center justify-center rounded hover:bg-muted disabled:opacity-50"
      [attr.aria-label]="
        (store.has(symbol()) ? 'Remove ' : 'Add ') +
        symbol() +
        (store.has(symbol()) ? ' from watchlist' : ' to watchlist')
      "
      [attr.aria-pressed]="store.has(symbol())"
      [disabled]="
        store.pending().has(symbol()) || store.status() === 'idle' || store.status() === 'loading'
      "
      (click)="toggle()"
    >
      <ng-icon
        name="lucideStar"
        [class]="store.has(symbol()) ? 'text-primary [&_svg]:fill-current' : ''"
      />
    </button>
    @if (store.error()) {
      <span role="status" class="text-loss text-xs"
        >{{ store.error() }}
        <button type="button" class="underline" (click)="retry()">Retry loading</button></span
      >
    }
  `,
})
export class WatchlistStarComponent {
  readonly symbol = input.required<string>();
  protected readonly store = inject(WatchlistStore);
  protected toggle(): void {
    this.store.toggle(this.symbol()).subscribe({ error: () => undefined });
  }
  protected retry(): void {
    this.store.load(true).subscribe({ error: () => undefined });
  }
}
