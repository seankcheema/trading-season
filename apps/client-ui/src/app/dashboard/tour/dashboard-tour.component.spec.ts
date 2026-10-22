import { Component, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { vi } from 'vitest';
import {
  DashboardTourComponent,
  TOUR_STEPS,
  TourExit,
  placeTourCard,
} from './dashboard-tour.component';

const VIEWPORT = { width: 1200, height: 800 };
const CARD = { width: 320, height: 190 };

describe('placeTourCard', () => {
  it('centers the card when nothing is spotlit', () => {
    expect(placeTourCard(null, undefined, CARD, VIEWPORT)).toEqual({ left: 440, top: 305 });
  });

  it('puts the card on the preferred side when it fits there', () => {
    const rect = { left: 400, top: 100, width: 200, height: 50 };

    expect(placeTourCard(rect, 'bottom', CARD, VIEWPORT)).toEqual({ left: 340, top: 164 });
    expect(placeTourCard(rect, 'right', CARD, VIEWPORT)).toEqual({ left: 614, top: 30 });
    expect(placeTourCard(rect, 'left', CARD, VIEWPORT)).toEqual({ left: 66, top: 30 });
  });

  it('falls back to the first side that fits', () => {
    // No room above, so a card that prefers the top goes below instead.
    const rect = { left: 400, top: 40, width: 200, height: 50 };

    expect(placeTourCard(rect, 'top', CARD, VIEWPORT).top).toBe(104);
  });

  it('keeps the card inside the viewport', () => {
    const rect = { left: 1100, top: 700, width: 100, height: 100 };

    const { left, top } = placeTourCard(rect, 'bottom', CARD, VIEWPORT);

    expect(left).toBe(VIEWPORT.width - CARD.width - 16);
    expect(top).toBeGreaterThanOrEqual(16);
    expect(top + CARD.height).toBeLessThanOrEqual(VIEWPORT.height - 16);
  });
});

@Component({
  imports: [DashboardTourComponent],
  template: `
    <div data-tour="search"><input aria-label="Search" /></div>
    <div data-tour="net-worth"></div>
    <div data-tour="account"></div>
    <div data-tour="portfolio"></div>
    <div data-tour="dua"></div>
    @if (withAssets()) {
      <div data-tour="assets"></div>
    }
    @if (ticketOpen()) {
      <a data-tour="full-screen">Full screen</a>
    }
    <app-dashboard-tour
      (finished)="exits.push($event)"
      (ticketNeeded)="tickets.push($event); ticketOpen.set($event)"
    />
  `,
})
class TourHostComponent {
  readonly withAssets = signal(true);
  readonly exits: TourExit[] = [];
  readonly tickets: boolean[] = [];
  readonly ticketOpen = signal(false);
}

describe('DashboardTourComponent', () => {
  let fixture: ComponentFixture<TourHostComponent>;

  const element = () => fixture.nativeElement as HTMLElement;
  const dialog = () => element().querySelector('[role="dialog"]') as HTMLElement;
  const title = () => dialog().querySelector('h2')?.textContent?.trim();
  const progress = () =>
    element().querySelector('[data-testid="tour-progress"]')?.textContent?.trim();
  const spotlight = () => element().querySelector('[data-testid="tour-spotlight"]');
  const button = (name: string) =>
    [...dialog().querySelectorAll('button')].find(
      (candidate) =>
        candidate.textContent?.trim() === name || candidate.getAttribute('aria-label') === name,
    ) as HTMLButtonElement;

  async function render(): Promise<void> {
    await TestBed.configureTestingModule({ imports: [TourHostComponent] }).compileComponents();
    fixture = TestBed.createComponent(TourHostComponent);
    fixture.detectChanges();
    await fixture.whenStable();
  }

  async function click(name: string): Promise<void> {
    button(name).click();
    fixture.detectChanges();
    await fixture.whenStable();
  }

  async function press(key: string, init: KeyboardEventInit = {}): Promise<void> {
    document.dispatchEvent(new KeyboardEvent('keydown', { key, ...init }));
    fixture.detectChanges();
    await fixture.whenStable();
  }

  beforeEach(() => localStorage.clear());
  afterEach(() => localStorage.clear());

  it('welcomes the user in a labelled modal dialog with nothing spotlit', async () => {
    await render();

    expect(dialog().getAttribute('aria-modal')).toBe('true');
    expect(element().querySelector(`#${dialog().getAttribute('aria-labelledby')}`)).not.toBeNull();
    expect(dialog().getAttribute('aria-describedby')).toBeTruthy();
    expect(title()).toBe("Hi, I'm Dua");
    expect(progress()).toBe('Quick tour');
    expect(spotlight()).toBeNull();
    expect(button('Skip')).toBeDefined();
    expect(document.activeElement?.textContent?.trim()).toBe('Start tour');
  });

  it('walks through each step, spotlighting its target and saving the step', async () => {
    await render();

    await click('Start tour');

    expect(title()).toBe('Every trade starts with a search');
    expect(progress()).toBe(`1 of ${TOUR_STEPS.length - 1}`);
    expect(spotlight()).not.toBeNull();
    expect(localStorage.getItem('ts.tour.step')).toBe('1');
    expect(document.activeElement?.textContent?.trim()).toBe('Next');

    await click('Next');
    expect(title()).toBe('Your money');
    const dots = [...element().querySelectorAll('[data-testid="tour-dot"]')].map(
      (dot) => dot.className,
    );
    expect(dots).toHaveLength(TOUR_STEPS.length - 1);
    expect(dots[0]).toContain('w-1.5');
    expect(dots[0]).toContain('bg-primary');
    expect(dots[1]).toContain('w-4');
    expect(dots[2]).toContain('w-1.5');
    expect(dots[2]).toContain('bg-muted-foreground/40');

    await click('Back');
    expect(title()).toBe('Every trade starts with a search');
  });

  it('is narrated by Dua, whose face shows on every step', async () => {
    await render();
    const guide = () => element().querySelector('[data-testid="tour-guide"]');
    const avatars = () => element().querySelectorAll('[data-testid="tour-avatar"]');

    expect(avatars()).toHaveLength(1);
    expect(guide()).toBeNull();

    await click('Start tour');
    expect(guide()?.textContent?.trim()).toBe('Dua');
    expect(avatars()).toHaveLength(1);
    expect(avatars()[0].getAttribute('aria-hidden')).toBe('true');
  });

  it("shows Dua's initial when the avatar image fails to load", async () => {
    await render();

    element().querySelector('[data-testid="tour-avatar"] img')!.dispatchEvent(new Event('error'));
    fixture.detectChanges();

    const avatar = element().querySelector('[data-testid="tour-avatar"]');
    expect(avatar?.querySelector('img')).toBeNull();
    expect(avatar?.textContent?.trim()).toBe('D');
  });

  it('moves with the arrow keys and ignores them with a modifier', async () => {
    await render();

    await press('a');
    expect(title()).toBe("Hi, I'm Dua");

    await press('ArrowRight');
    await press('ArrowRight');
    expect(title()).toBe('Your money');

    await press('ArrowLeft');
    expect(title()).toBe('Every trade starts with a search');

    await press('ArrowRight', { metaKey: true });
    expect(title()).toBe('Every trade starts with a search');

    await press('ArrowLeft');
    await press('ArrowLeft');
    expect(title()).toBe("Hi, I'm Dua");
  });

  it('ends on Escape, the close button or Skip, and does not show by itself again', async () => {
    await render();

    await press('Escape');
    await click('Close tour');
    await click('Skip');

    expect(fixture.componentInstance.exits).toEqual(['dismissed', 'dismissed', 'dismissed']);
    expect(localStorage.getItem('ts.tour.done')).toBe('1');
    expect(localStorage.getItem('ts.tour.step')).toBeNull();
  });

  it('opens an order ticket behind the full screen step and spotlights its button', async () => {
    localStorage.setItem('ts.tour.step', '5');
    await render();
    expect(fixture.componentInstance.tickets).toEqual([]);

    await click('Next');
    expect(title()).toBe('Full screen market data');
    expect(fixture.componentInstance.tickets).toEqual([true]);
    expect(spotlight()).not.toBeNull();

    await click('Next');
    expect(title()).toBe("You'll find me here");
    expect(fixture.componentInstance.tickets).toEqual([true, false]);
    expect(TOUR_STEPS[7].target).toBe('dua');

    await click('Back');
    await click('Back');
    expect(fixture.componentInstance.tickets).toEqual([true, false, true, false]);
  });

  it('asks for the ticket when it resumes on the full screen step, and closes it on exit', async () => {
    localStorage.setItem('ts.tour.step', '6');
    await render();
    expect(fixture.componentInstance.tickets).toEqual([true]);

    await press('Escape');
    expect(fixture.componentInstance.tickets).toEqual([true, false]);
  });

  it('hands over to the stock search from its last step', async () => {
    localStorage.setItem('ts.tour.step', String(TOUR_STEPS.length - 1));
    await render();

    expect(title()).toBe("You're ready");
    await click('Find a stock');

    expect(fixture.componentInstance.exits).toEqual(['find-stock']);
    expect(localStorage.getItem('ts.tour.done')).toBe('1');
  });

  it('centers the card when a step has no target on the page', async () => {
    localStorage.setItem('ts.tour.step', '5');
    await render();
    fixture.componentInstance.withAssets.set(false);
    fixture.detectChanges();

    await press('ArrowLeft');
    await press('ArrowRight');

    expect(title()).toBe('Holdings and watch list');
    expect(spotlight()).toBeNull();
  });

  it('scrolls a target that is off screen into view', async () => {
    const scroll = vi.fn();
    HTMLElement.prototype.scrollIntoView = scroll;
    const box = vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue({
      left: 10,
      top: 2000,
      right: 110,
      bottom: 2050,
      width: 100,
      height: 50,
      x: 10,
      y: 2000,
      toJSON: () => ({}),
    });
    await render();

    await click('Start tour');

    expect(scroll).toHaveBeenCalledWith({ block: 'center' });
    box.mockRestore();
    delete (HTMLElement.prototype as Partial<HTMLElement>).scrollIntoView;
  });

  it('follows its target when the window is resized', async () => {
    await render();
    await click('Start tour');
    const box = vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue({
      left: 100,
      top: 40,
      right: 300,
      bottom: 90,
      width: 200,
      height: 50,
      x: 100,
      y: 40,
      toJSON: () => ({}),
    });

    window.dispatchEvent(new Event('resize'));
    fixture.detectChanges();

    const spot = spotlight() as HTMLElement;
    expect(spot.style.left).toBe('94px');
    expect(spot.style.width).toBe('212px');
    box.mockRestore();
  });
});
