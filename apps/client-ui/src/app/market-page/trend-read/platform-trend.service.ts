import { HttpClient } from '@angular/common/http';
import { Injectable, inject, signal } from '@angular/core';
import { Observable, of, shareReplay, tap } from 'rxjs';
import { PlatformTrend } from './platform-trend';

/** The trend signal file's path under the app's public assets. */
export const PLATFORM_TREND_URL = '/forecast/platform-trend.json';

/** Loads the platform trend signal file once per app session and keeps it. */
@Injectable({ providedIn: 'root' })
export class PlatformTrendService {
  private readonly http = inject(HttpClient);
  private request?: Observable<PlatformTrend>;
  readonly trend = signal<PlatformTrend | null>(null);
  readonly status = signal<'idle' | 'loading' | 'ready' | 'error'>('idle');

  load(): Observable<PlatformTrend> {
    const loaded = this.trend();
    if (loaded) {
      return of(loaded);
    }
    if (!this.request) {
      this.status.set('loading');
      this.request = this.http.get<PlatformTrend>(PLATFORM_TREND_URL).pipe(
        tap({
          next: (document) => {
            this.trend.set(document);
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
