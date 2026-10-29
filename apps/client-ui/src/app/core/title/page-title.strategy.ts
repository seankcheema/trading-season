import { Injectable, inject } from '@angular/core';
import { Title } from '@angular/platform-browser';
import { RouterStateSnapshot, TitleStrategy } from '@angular/router';

/** What every title ends with, and what a screen without a title of its own is called. */
export const APP_NAME = 'TradingSeason';

/**
 * Titles each screen "Screen | TradingSeason" from the `title` on its
 * route, so the browser tab, history and a screen reader's page announcement say where the user
 * is (WCAG 2.4.2, Page Titled).
 */
@Injectable({ providedIn: 'root' })
export class PageTitleStrategy extends TitleStrategy {
  private readonly title = inject(Title);

  override updateTitle(snapshot: RouterStateSnapshot): void {
    const screen = this.buildTitle(snapshot);
    this.title.setTitle(screen ? `${screen} | ${APP_NAME}` : APP_NAME);
  }
}
