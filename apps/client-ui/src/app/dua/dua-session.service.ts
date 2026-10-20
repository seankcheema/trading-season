import { Injectable, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { NavigationStart, Router } from '@angular/router';
import { TokenStorageService } from '../core/auth/token-storage.service';

@Injectable({ providedIn: 'root' })
export class DuaSession {
  readonly minimized = signal(true);
  private readonly seenInsights = new Map<string, string>();
  private readonly notificationAcknowledged = signal(false);

  // In-memory only: a full page reload creates a new service and allows a new notification.
  acknowledgeNotification(): void {
    this.notificationAcknowledged.set(true);
  }

  // Initial hydration establishes a baseline; only changed insights are new information.
  hasNewInformation(context: string, fingerprint: string, open: boolean): boolean {
    if (this.notificationAcknowledged()) return false;
    if (open || !this.seenInsights.has(context)) {
      this.seenInsights.set(context, fingerprint);
      return false;
    }
    return this.seenInsights.get(context) !== fingerprint;
  }

  constructor() {
    inject(Router)
      .events.pipe(takeUntilDestroyed())
      .subscribe((event) => {
        if (event instanceof NavigationStart) this.minimized.set(true);
      });
    inject(TokenStorageService).onIdentityChange(() => {
      this.seenInsights.clear();
      this.minimized.set(true);
    });
  }
}
