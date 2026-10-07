import { TokenStorageService } from '../../core/auth/token-storage.service';
import { HttpClient } from '@angular/common/http';
import { DestroyRef, Injectable, computed, effect, inject, signal, untracked } from '@angular/core';
import {
  Observable,
  Subject,
  finalize,
  of,
  takeUntil,
  map,
  shareReplay,
  switchMap,
  tap,
  throwError,
} from 'rxjs';
import { BACKEND_API_URL } from '../../core/api.config';
import { UnknownInstrumentError, TradeEligibilityError } from './order-error';
import {
  InstrumentRef,
  OrderCheckResult,
  OrderResult,
  OrderSubmission,
  OrderType,
} from './order.models';

// How often to re-read the history while an order is still pending.
export const PENDING_ORDER_POLL_MS = 5_000;

// Submits orders and reads the caller's order history. While any order is pending it re-reads
// the history on a timer, so statuses update without the user doing anything.
//
// Shared across views and cleared synchronously on identity changes.
@Injectable({ providedIn: 'root' })
export class OrderService {
  private readonly _http = inject(HttpClient);
  private readonly _apiUrl = inject(BACKEND_API_URL);

  // The catalogue does not change while the app is open, so it is fetched once and shared.
  // Loaded when recent activity or a submission needs instrument reference data.
  private revision = 0;
  private readonly cancelled = new Subject<void>();
  private historyRequest?: Observable<OrderResult[]>;
  readonly refreshing = signal(false);
  readonly historyError = signal('');
  // Emits an order the moment a poll finds it filled after it had been pending, so views can
  // reload the cash and holdings it moved.
  readonly pendingFilled = new Subject<OrderResult>();
  private pollTimer?: ReturnType<typeof setInterval>;

  constructor() {
    inject(TokenStorageService).onIdentityChange(() => {
      this.revision++;
      this.cancelled.next();
      this.historyRequest = undefined;
      this._instruments = null;
      this._orders.set([]);
      this._catalogue.set([]);
      this.historyStatus.set('idle');
      this.historyError.set('');
    });
    effect(() => {
      const pending = this.hasPendingOrders();
      untracked(() => (pending ? this.startPolling() : this.stopPolling()));
    });
    inject(DestroyRef).onDestroy(() => this.stopPolling());
  }

  private _instruments: Observable<InstrumentRef[]> | null = null;

  private readonly _orders = signal<OrderResult[]>([]);
  private readonly _catalogue = signal<InstrumentRef[]>([]);
  readonly catalogue = this._catalogue.asReadonly();
  readonly historyStatus = signal<'idle' | 'loading' | 'ready' | 'error'>('idle');

  // The caller's orders, newest first. Empty until loadOrders() succeeds.
  readonly orders = this._orders.asReadonly();
  private readonly hasPendingOrders = computed(() =>
    this._orders().some((order) => order.status === 'PENDING'),
  );

  // Every instrument, ordered by ticker. Repeated calls share one request.
  instruments(): Observable<InstrumentRef[]> {
    this._instruments ??= this._http.get<InstrumentRef[]>(`${this._apiUrl}/instruments`).pipe(
      tap((instruments) => this._catalogue.set(instruments)),
      takeUntil(this.cancelled),
      shareReplay({ bufferSize: 1, refCount: true }),
    );
    return this._instruments;
  }

  // Submits a buy or sell for the symbol a trader picked, resolving the instrument first.
  //
  // A trading-rule rejection is not an error: it arrives as a successful response whose status
  // is REJECTED and whose rejectionReason says why. Only a request the backend could not
  // process at all fails this observable.
  submitOrder(order: {
    accountId: number;
    simulatedAt?: string;
    sessionId?: number;
    bufferPercent?: number;
    symbol: string;
    orderType: OrderType;
    quantity: number;
    indicativePrice: number;
  }): Observable<OrderResult> {
    return this.instruments().pipe(
      switchMap((instruments) => {
        const instrument = findInstrumentBySymbol(instruments, order.symbol);
        if (!instrument) {
          return throwError(() => new UnknownInstrumentError(order.symbol));
        }
        const submission: OrderSubmission = {
          accountId: order.accountId,
          instrumentId: instrument.instrumentId,
          orderType: order.orderType,
          quantity: order.quantity,
          indicativePrice: order.indicativePrice,
          clientReference: newClientReference(),
          ...(order.sessionId != null ? { sessionId: order.sessionId } : {}),
          ...(order.bufferPercent != null ? { bufferPercent: order.bufferPercent } : {}),
          ...(order.simulatedAt ? { simulatedAt: order.simulatedAt } : {}),
        };
        const { clientReference: _reference, ...check } = submission;
        return this._http
          .post<OrderCheckResult>(`${this._apiUrl}/orders/check`, check)
          .pipe(
            switchMap((assessment) =>
              assessment.eligible
                ? this._http.post<OrderResult>(`${this._apiUrl}/orders`, submission)
                : throwError(
                    () =>
                      new TradeEligibilityError(
                        assessment.rejectionReason ?? 'This trade is not currently eligible.',
                      ),
                  ),
            ),
          );
      }),
      takeUntil(this.cancelled),
      // A fill moves funds and holdings, so the history the dashboard shows is stale
      // the moment one lands.
      tap((result) => {
        this.revision++;
        this.historyRequest = undefined;
        this._orders.update((orders) => [
          result,
          ...orders.filter((order) => order.orderId !== result.orderId),
        ]);
      }),
    );
  }

  // Replaces the cached history with the caller's orders as the backend has them.
  loadOrders(refresh = true): Observable<OrderResult[]> {
    if (this.historyRequest) return this.historyRequest;
    if (!refresh && this.historyStatus() === 'ready') return of(this._orders());
    const revision = this.revision;
    if (this.historyStatus() === 'idle') this.historyStatus.set('loading');
    this.refreshing.set(true);
    const request = this._http.get<OrderResult[]>(`${this._apiUrl}/orders`).pipe(
      switchMap((orders) => (revision === this.revision ? of(orders) : this.loadOrders())),
      tap({
        next: (orders) => {
          this._orders.set(orders);
          this.historyStatus.set('ready');
          this.historyError.set('');
        },
        error: () => {
          this.historyError.set('Unable to refresh recent orders.');
          this.historyStatus.set('error');
        },
      }),
      takeUntil(this.cancelled),
      finalize(() => {
        if (this.historyRequest === request) {
          this.historyRequest = undefined;
          this.refreshing.set(false);
        }
      }),
      shareReplay({ bufferSize: 1, refCount: true }),
    );
    this.historyRequest = request;
    return request;
  }

  private startPolling(): void {
    this.pollTimer ??= setInterval(() => this.pollPending(), PENDING_ORDER_POLL_MS);
  }

  private stopPolling(): void {
    clearInterval(this.pollTimer);
    this.pollTimer = undefined;
  }

  // A hidden tab skips the read; the next tick after it is shown catches up.
  private pollPending(): void {
    if (typeof document !== 'undefined' && document.hidden) return;
    const pending = new Set(
      this._orders()
        .filter((order) => order.status === 'PENDING')
        .map((order) => order.orderId),
    );
    this.loadOrders().subscribe({
      next: (orders) => {
        for (const order of orders) {
          if (order.status === 'FILLED' && pending.has(order.orderId))
            this.pendingFilled.next(order);
        }
      },
      error: () => undefined,
    });
  }

  // Resolves a market-data symbol to the instrument behind it, for callers that need the id
  // before deciding whether a symbol can be traded at all.
  instrumentFor(symbol: string): Observable<InstrumentRef | null> {
    return this.instruments().pipe(
      map((instruments) => findInstrumentBySymbol(instruments, symbol)),
    );
  }
}

// Market data reports simulatedStockSymbol, so that is the match that counts; the ticker is
// the fallback for an instrument nothing simulates. Both are compared case-insensitively
// because a symbol can reach here from a route parameter.
function findInstrumentBySymbol(
  instruments: readonly InstrumentRef[],
  symbol: string,
): InstrumentRef | null {
  const wanted = symbol.trim().toUpperCase();
  if (!wanted) {
    return null;
  }
  return (
    instruments.find((instrument) => instrument.simulatedStockSymbol?.toUpperCase() === wanted) ??
    instruments.find((instrument) => instrument.ticker.toUpperCase() === wanted) ??
    null
  );
}

// The idempotency key the backend dedupes retries on. crypto.randomUUID needs a secure
// context, which the dev server over plain HTTP on a non-localhost host is not, so fall back
// rather than fail the order: the key only has to be unique per submission.
function newClientReference(): string {
  const webCrypto = globalThis.crypto;
  if (typeof webCrypto?.randomUUID === 'function') {
    return webCrypto.randomUUID();
  }
  const bytes = new Uint8Array(16);
  if (typeof webCrypto?.getRandomValues === 'function') {
    webCrypto.getRandomValues(bytes);
  } else {
    for (let index = 0; index < bytes.length; index += 1) {
      bytes[index] = Math.floor(Math.random() * 256);
    }
  }
  // Set the version and variant bits so the value is a well-formed v4 UUID; the backend
  // parses this field as one.
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
  return [
    hex.slice(0, 8),
    hex.slice(8, 12),
    hex.slice(12, 16),
    hex.slice(16, 20),
    hex.slice(20),
  ].join('-');
}
