import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  DestroyRef,
  computed,
  inject,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { NgIcon, provideIcons } from '@ng-icons/core';
import {
  lucideActivity,
  lucideFileChartColumn,
  lucideListOrdered,
  lucideLogOut,
  lucidePanelLeftClose,
  lucidePanelLeftOpen,
  lucideUsers,
} from '@ng-icons/lucide';
import { AuthService } from '../core/auth/auth.service';
import { TokenStorageService } from '../core/auth/token-storage.service';
import { fullStamp } from '../reporting/format';
import { ReportStore } from '../reporting/report-store.service';

interface NavItem {
  path: string;
  label: string;
  icon: string;
  // Whether only the path itself marks the item current, not the pages under it.
  exact: boolean;
  // Whether the screen is an admin's; an analyst is not offered it.
  adminOnly: boolean;
}

const NAV: NavItem[] = [
  { path: '/', label: 'Activity', icon: 'lucideActivity', exact: true, adminOnly: true },
  { path: '/customers', label: 'Customers', icon: 'lucideUsers', exact: false, adminOnly: true },
  { path: '/orders', label: 'Orders', icon: 'lucideListOrdered', exact: true, adminOnly: true },
  { path: '/runs', label: 'Report runs', icon: 'lucideFileChartColumn', exact: true, adminOnly: false },
];

// Where this browser remembers that the sidebar was collapsed.
const COLLAPSED_KEY = 'ts.reporting.sidebar-collapsed';

// Storage can throw in private windows or with blocked site data; the sidebar then starts open.
function readCollapsed(): boolean {
  try {
    return localStorage.getItem(COLLAPSED_KEY) === 'true';
  } catch {
    return false;
  }
}

// The signed-in frame: sidebar navigation, the signed-in user, and the routed screen.
// Providing ReportStore here scopes its data and polling to the signed-in session.
@Component({
  selector: 'app-shell',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, RouterLinkActive, RouterOutlet, NgIcon],
  providers: [
    ReportStore,
    provideIcons({
      lucideActivity,
      lucideFileChartColumn,
      lucideListOrdered,
      lucideLogOut,
      lucidePanelLeftClose,
      lucidePanelLeftOpen,
      lucideUsers,
    }),
  ],
  host: { '(window:beforeprint)': 'stampPrint()' },
  templateUrl: './shell.component.html',
})
export class ShellComponent {
  private readonly _auth = inject(AuthService);
  private readonly _router = inject(Router);
  private readonly _destroyRef = inject(DestroyRef);
  private readonly _storage = inject(TokenStorageService);
  private readonly _identity = this._storage.identity;
  private readonly _store = inject(ReportStore);
  private readonly _changes = inject(ChangeDetectorRef);

  // The screens this account may open: all of them for an admin, the runs for an analyst.
  protected readonly nav = computed(() =>
    NAV.filter((item) => !item.adminOnly || this._storage.isAdmin()),
  );

  // Collapsed, the sidebar keeps its logo and icons only. It applies from the width at
  // which the sidebar stands beside the screen; narrower, it is a bar across the top.
  protected readonly collapsed = signal(readCollapsed());

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

  // When the screen was last sent to print, for the line an exported PDF opens with.
  protected readonly printedAt = signal(fullStamp(new Date().toISOString()));

  // The browser lays the page out for print as soon as this returns, so the new time is rendered at once.
  protected stampPrint(): void {
    this.printedAt.set(fullStamp(new Date().toISOString()));
    this._changes.detectChanges();
  }

  protected toggleSidebar(): void {
    const collapsed = !this.collapsed();
    this.collapsed.set(collapsed);
    try {
      localStorage.setItem(COLLAPSED_KEY, String(collapsed));
    } catch {
      // The choice still holds until the page is reloaded.
    }
  }

  protected logout(): void {
    this._auth
      .logout()
      .pipe(takeUntilDestroyed(this._destroyRef))
      .subscribe(() => void this._router.navigate(['/login']));
  }
}
