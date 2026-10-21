import { HttpClient } from '@angular/common/http';
import { Injectable, inject, signal } from '@angular/core';
import { Observable, of, shareReplay, tap } from 'rxjs';
import { PlatformSignals } from './platform-signals';

/** The signal file's path under the app's public assets. */
export const PLATFORM_SIGNALS_URL = '/forecast/platform-signals.json';

/** Loads the platform risk signal file once per app session and keeps it. */
@Injectable({ providedIn: 'root' })
export class PlatformSignalsService {
  private readonly http = inject(HttpClient);
  private request?: Observable<PlatformSignals>;
  readonly signals = signal<PlatformSignals | null>(null);
  readonly status = signal<'idle' | 'loading' | 'ready' | 'error'>('idle');

  load(): Observable<PlatformSignals> {
    const loaded = this.signals();
    if (loaded) {
      return of(loaded);
    }
    if (!this.request) {
      this.status.set('loading');
      this.request = this.http.get<PlatformSignals>(PLATFORM_SIGNALS_URL).pipe(
        tap({
          next: (document) => {
            this.signals.set(document);
            this.status.set('ready');
          },
          error: () => {
            this.request = undefined;
            this.status.set('error');
          },
        }),
        shareReplay(1),
      );
    }
    return this.request;
  }
}
