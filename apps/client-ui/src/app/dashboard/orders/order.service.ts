import { AuthService } from '../../core/auth/auth.service';
import { TokenStorageService } from '../../core/auth/token-storage.service';
import { HttpClient } from '@angular/common/http';
import { DestroyRef, Injectable, effect, inject, signal, untracked } from '@angular/core';
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
import { UnknownInstrumentError } from './order-error';
import {
  InstrumentRef,
  OrderAuditEntry,
  OrderResult,
  OrderStatus,
  OrderStatusFrame,
  OrderSubmission,
  OrderType,
} from './order.models';

// Delay before reopening a dropped order status stream, doubled per failure up to the cap.
export const STREAM_RECONNECT_MS = { initial: 2_000, max: 10_000 } as const;

// A status never moves backwards: the stream can deliver ACCEPTED after the submission
// response already reported FILLED, and both terminal statuses outrank the open ones.
const STATUS_RANK: Record<OrderStatus, number> = { PENDING: 0, ACCEPTED: 1, FILLED: 2, REJECTED: 2 };

// Submits orders and reads the caller's order history. While signed in it holds the order
// status stream open, so a status change reaches the screen the moment the backend commits
// it (BR-07) without the user doing anything.
//
// Shared across views and cleared synchronously on identity changes.
@Injectable({ providedIn: 'root' })
export class OrderService {
  private readonly _http = inject(HttpClient);
  private readonly _apiUrl = inject(BACKEND_API_URL);
  private readonly _auth = inject(AuthService);
  private readonly _storage = inject(TokenStorageService);

  // The catalogue does not change while the app is open, so it is fetched once and shared.
  // Loaded when recent activity or a submission needs instrument reference data.
  private revision = 0;
  private readonly cancelled = new Subject<void>();
  private historyRequest?: Observable<OrderResult[]>;
  readonly refreshing = signal(false);
  readonly historyError = signal('');
  // Emits an order the moment the stream reports it filled after it had been open, so views
  // can reload the cash and holdings it moved.
  readonly pendingFilled = new Subject<OrderResult>();
  // The open stream, or undefined while signed out or between reconnect attempts.
  private stream?: AbortController;
  private reconnectTimer?: ReturnType<typeof setTimeout>;
  private reconnectDelay: number = STREAM_RECONNECT_MS.initial;
  // Set while a reconnect is due: the registry replays nothing, so the next open connection
  // re-reads the history once to catch up on anything missed while disconnected.
  private catchUp = false;

  constructor() {
    this._storage.onIdentityChange(() => {
      this.revision++;
      this.cancelled.next();
      this.historyRequest = undefined;
      this._instruments = null;
      this._orders.set([]);
      this._catalogue.set([]);
      this.historyStatus.set('idle');
      this.historyError.set('');
      this.closeStream();
    });
    // The stream follows the session: opened on sign-in, closed on sign-out. An identity
    // change leaves the session signal true, so the reset above closes the old stream and
    // this effect reopens it for the new user.
    effect(() => {
      const signedIn = this._storage.hasSession();
      untracked(() => (signedIn ? this.connectStream() : this.closeStream()));
    });
    inject(DestroyRef).onDestroy(() => this.closeStream());
  }

  private _instruments: Observable<InstrumentRef[]> | null = null;

  private readonly _orders = signal<OrderResult[]>([]);
  private readonly _catalogue = signal<InstrumentRef[]>([]);
  readonly catalogue = this._catalogue.asReadonly();
  readonly historyStatus = signal<'idle' | 'loading' | 'ready' | 'error'>('idle');

  // The caller's orders, newest first. Empty until loadOrders() succeeds.
  readonly orders = this._orders.asReadonly();

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
          ...(order.simulatedAt ? { simulatedAt: order.simulatedAt } : {}),
        };
        return this._http.post<OrderResult>(`${this._apiUrl}/orders`, submission);
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
    if (this.historyRequest) {
      return this.historyRequest;
    }
    if (!refresh && this.historyStatus() === 'ready') {
      return of(this._orders());
    }
    const revision = this.revision;
    if (this.historyStatus() === 'idle') {
      this.historyStatus.set('loading');
    }
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

  /** Reads the signed-in trader's immutable audit timeline for one order. */
  orderAudit(orderId: number): Observable<OrderAuditEntry[]> {
    return this._http
      .get<OrderAuditEntry[]>(`${this._apiUrl}/orders/${orderId}/audit`)
      .pipe(takeUntil(this.cancelled));
  }

  // Opens GET /api/orders/stream and keeps reading it until it drops or the session ends.
  // The stream needs the bearer header, which the browser's EventSource cannot send, so it is
  // read through fetch. Nothing happens during server rendering.
  private connectStream(): void {
    if (this.stream || typeof window === 'undefined' || typeof fetch !== 'function') {
      return;
    }
    const stream = new AbortController();
    this.stream = stream;
    this._auth.ensureValidSession().subscribe({
      next: (valid) => {
        if (valid && !stream.signal.aborted) {
          void this.readStream(stream);
        } else {
          this.streamEnded(stream);
        }
      },
      error: () => this.streamEnded(stream),
    });
  }

  private closeStream(): void {
    clearTimeout(this.reconnectTimer);
    this.reconnectTimer = undefined;
    this.reconnectDelay = STREAM_RECONNECT_MS.initial;
    this.catchUp = false;
    this.stream?.abort();
    this.stream = undefined;
  }

  private async readStream(stream: AbortController): Promise<void> {
    try {
      const response = await fetch(`${this._apiUrl}/orders/stream`, {
        headers: { Accept: 'text/event-stream', Authorization: `Bearer ${this._storage.accessToken}` },
        cache: 'no-store',
        signal: stream.signal,
      });
      if (!response.ok || !response.body) {
        throw new Error(`Order status stream answered ${response.status}`);
      }
      this.reconnectDelay = STREAM_RECONNECT_MS.initial;
      if (this.catchUp) {
        this.catchUp = false;
        this.loadOrders().subscribe({ error: () => undefined });
      }
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffered = '';
      for (;;) {
        const { value, done } = await reader.read();
        if (done) {
          break;
        }
        buffered += decoder.decode(value, { stream: true });
        // Everything before the last blank line is complete; the rest waits for more bytes.
        const frames = buffered.split(/\r?\n\r?\n/);
        buffered = frames.at(-1) as string;
        frames.slice(0, -1).forEach((frame) => this.handleFrame(frame));
      }
    } catch {
      // A dropped or refused stream is reopened below; an aborted one is not.
    }
    this.streamEnded(stream);
  }

  // Reopens a stream that ended on its own, waiting longer after each failure in a row.
  private streamEnded(stream: AbortController): void {
    if (this.stream !== stream || stream.signal.aborted) {
      return;
    }
    this.stream = undefined;
    this.catchUp = true;
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = undefined;
      this.connectStream();
    }, this.reconnectDelay);
    this.reconnectDelay = Math.min(this.reconnectDelay * 2, STREAM_RECONNECT_MS.max);
  }

  // One server-sent event: its `event:` name and the `data:` lines joined. Only order-status
  // frames carry anything; heartbeats and anything unparseable are ignored.
  private handleFrame(frame: string): void {
    let event = '';
    const data: string[] = [];
    for (const line of frame.split(/\r?\n/)) {
      if (line.startsWith('event:')) {
        event = line.slice('event:'.length).trim();
      } else if (line.startsWith('data:')) {
        data.push(line.slice('data:'.length).trimStart());
      }
    }
    if (event !== 'order-status') {
      return;
    }
    try {
      this.applyStatus(JSON.parse(data.join('\n')) as OrderStatusFrame);
    } catch {
      // A malformed frame is dropped; the next one or a catch-up read corrects the history.
    }
  }

  // Applies a pushed status to the history. An order the history does not hold yet, such as
  // one placed from another tab, is fetched with the rest of the history instead.
  private applyStatus(frame: OrderStatusFrame): void {
    if (typeof frame?.orderId !== 'number' || !(frame.status in STATUS_RANK)) {
      return;
    }
    const current = this._orders().find((order) => order.orderId === frame.orderId);
    if (!current) {
      this.loadOrders().subscribe({ error: () => undefined });
      return;
    }
    if (STATUS_RANK[frame.status] <= STATUS_RANK[current.status]) {
      return;
    }
    const updated: OrderResult = {
      ...current,
      status: frame.status,
      rejectionReason: frame.rejectionReason ?? null,
      resolvedAt: frame.order?.resolvedAt ?? current.resolvedAt,
    };
    this._orders.update((orders) =>
      orders.map((order) => (order.orderId === updated.orderId ? updated : order)),
    );
    if (updated.status === 'FILLED') {
      this.pendingFilled.next(updated);
    }
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
