import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { REPORTING_API_URL } from '../core/api.config';
import {
  Activity,
  ActivityRange,
  CustomerDetail,
  CustomerList,
  OrderDetail,
  OrderList,
} from './console.models';
import { Report, RunList, SchedulerStatus, UserProfile } from './report.models';

// One method per Reporting Service endpoint. The bearer token is added by authInterceptor.
@Injectable({ providedIn: 'root' })
export class ReportingApiService {
  private readonly _http = inject(HttpClient);
  private readonly _api = inject(REPORTING_API_URL);

  profile(): Observable<UserProfile> {
    return this._http.get<UserProfile>(`${this._api}/profile`);
  }

  runs(): Observable<RunList> {
    return this._http.get<RunList>(`${this._api}/runs`);
  }

  // 404 until the reporting consumer has written its first run.
  latestReport(): Observable<Report> {
    return this._http.get<Report>(`${this._api}/runs/latest`);
  }

  // Public on the service; the token is sent anyway and ignored.
  schedulerStatus(): Observable<SchedulerStatus> {
    return this._http.get<SchedulerStatus>(`${this._api}/scheduler/status`);
  }

  // Days are the viewer's own, so the service is told how far this browser sits from UTC.
  activity(range: ActivityRange): Observable<Activity> {
    return this._http.get<Activity>(`${this._api}/activity`, {
      params: { range, tzOffset: -new Date().getTimezoneOffset() },
    });
  }

  orders(): Observable<OrderList> {
    return this._http.get<OrderList>(`${this._api}/orders`);
  }

  order(orderId: number): Observable<OrderDetail> {
    return this._http.get<OrderDetail>(`${this._api}/orders/${orderId}`);
  }

  customers(): Observable<CustomerList> {
    return this._http.get<CustomerList>(`${this._api}/customers`);
  }

  customer(userId: string): Observable<CustomerDetail> {
    return this._http.get<CustomerDetail>(`${this._api}/customers/${encodeURIComponent(userId)}`);
  }

  // A chart PNG. Fetched as a blob because an <img src> cannot carry the bearer token.
  runFile(runId: string, name: string): Observable<Blob> {
    return this._http.get(
      `${this._api}/runs/${encodeURIComponent(runId)}/files/${encodeURIComponent(name)}`,
      { responseType: 'blob' },
    );
  }
}
