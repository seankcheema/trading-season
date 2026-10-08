import { ChangeDetectionStrategy, Component, DestroyRef, computed, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { lucideActivity, lucideFileChartColumn, lucideLogOut } from '@ng-icons/lucide';
import { AuthService } from '../core/auth/auth.service';
import { TokenStorageService } from '../core/auth/token-storage.service';
import { ReportStore } from '../reporting/report-store.service';

interface NavItem {
  path: string;
  label: string;
  icon: string;
}

// The signed-in frame: sidebar navigation, the signed-in user, and the routed screen.
// Providing ReportStore here scopes its data and polling to the signed-in session.
@Component({
  selector: 'app-shell',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, RouterLinkActive, RouterOutlet, NgIcon],
  providers: [ReportStore, provideIcons({ lucideActivity, lucideFileChartColumn, lucideLogOut })],
  templateUrl: './shell.component.html',
})
export class ShellComponent {
  private readonly _auth = inject(AuthService);
  private readonly _router = inject(Router);
  private readonly _destroyRef = inject(DestroyRef);
  private readonly _identity = inject(TokenStorageService).identity;
  private readonly _store = inject(ReportStore);

  protected readonly nav: NavItem[] = [
    { path: '/', label: 'Activity', icon: 'lucideActivity' },
    { path: '/runs', label: 'Report runs', icon: 'lucideFileChartColumn' },
  ];

  // The trading profile's name when there is one, otherwise the sign-in email.
  private readonly _knownName = computed(() => {
    const profile = this._store.profile();
    const name = profile ? `${profile.first_name} ${profile.last_name}`.trim() : '';
    return name || this._identity().email || '';
  });

  protected readonly userName = computed(() => this._knownName() || 'Signed in');

  protected readonly userInitials = computed(() => {
    const parts = this._knownName().split(/[\s@._-]+/).filter(Boolean);
    return ((parts[0]?.[0] ?? '') + (parts[1]?.[0] ?? '')).toUpperCase() || '?';
  });

  // Role from the token, then the trader level when the user has a trading profile.
  protected readonly userDetail = computed(() => {
    const level = this._store.profile()?.trader_level;
    return [this._identity().roles[0], level]
      .filter((part): part is string => !!part)
      .map((part) => part[0] + part.slice(1).toLowerCase())
      .join(' · ');
  });

  protected logout(): void {
    this._auth
      .logout()
      .pipe(takeUntilDestroyed(this._destroyRef))
      .subscribe(() => void this._router.navigate(['/login']));
  }
}
