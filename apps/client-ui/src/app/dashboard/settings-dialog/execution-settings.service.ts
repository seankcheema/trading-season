import { inject, Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { BACKEND_API_URL } from '../../core/api.config';

export interface ExecutionSettings {
  executionBufferPercent: number;
}

@Injectable({ providedIn: 'root' })
export class ExecutionSettingsService {
  private readonly http = inject(HttpClient);
  private readonly url = `${inject(BACKEND_API_URL)}/users/me/execution-settings`;
  load(): Observable<ExecutionSettings> {
    return this.http.get<ExecutionSettings>(this.url);
  }
  save(executionBufferPercent: number): Observable<ExecutionSettings> {
    return this.http.put<ExecutionSettings>(this.url, { executionBufferPercent });
  }
}
