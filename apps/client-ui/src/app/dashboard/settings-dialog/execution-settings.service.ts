import { TokenStorageService } from '../../core/auth/token-storage.service';
import { inject, Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, Subject, tap, takeUntil } from 'rxjs';
import { BACKEND_API_URL } from '../../core/api.config';

export interface ExecutionSettings {
  executionBufferPercent: number;
}

@Injectable({ providedIn: 'root' })
export class ExecutionSettingsService {
  readonly changed = new Subject<ExecutionSettings>();
  private readonly cancelled = new Subject<void>();
  constructor() {
    inject(TokenStorageService).onIdentityChange(() => this.cancelled.next());
  }
  private readonly http = inject(HttpClient);
  private readonly url = `${inject(BACKEND_API_URL)}/users/me/execution-settings`;
  load(): Observable<ExecutionSettings> {
    return this.http.get<ExecutionSettings>(this.url).pipe(takeUntil(this.cancelled), tap((value) => this.changed.next(value)));
  }
  save(executionBufferPercent: number): Observable<ExecutionSettings> {
    return this.http.put<ExecutionSettings>(this.url, { executionBufferPercent }).pipe(takeUntil(this.cancelled), tap((value) => this.changed.next(value)));
  }
}
