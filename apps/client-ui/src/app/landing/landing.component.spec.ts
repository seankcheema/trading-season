import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { LandingComponent } from './landing.component';

describe('LandingComponent', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [LandingComponent],
      providers: [provideRouter([])],
    }).compileComponents();
  });

  it('should create the landing component', () => {
    const fixture = TestBed.createComponent(LandingComponent);
    expect(fixture.componentInstance).toBeTruthy();
  });

  it('should link to sign in and registration', () => {
    const fixture = TestBed.createComponent(LandingComponent);
    fixture.detectChanges();
    const hrefs = [...fixture.nativeElement.querySelectorAll('a')].map((a: HTMLAnchorElement) =>
      a.getAttribute('href'),
    );
    expect(hrefs).toContain('/login');
    expect(hrefs).toContain('/register');
  });

  it('animates the graph each frame, catching up on ticks missed while hidden, and stops on destroy', () => {
    const callbacks: FrameRequestCallback[] = [];
    vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => callbacks.push(callback));
    const cancel = vi.fn();
    vi.stubGlobal('cancelAnimationFrame', cancel);
    vi.spyOn(performance, 'now').mockReturnValue(0);
    try {
      const fixture = TestBed.createComponent(LandingComponent);
      fixture.detectChanges();
      TestBed.tick();
      const frame = () => callbacks.splice(callbacks.findIndex((c) => c.name === 'tick'), 1)[0];
      const component = fixture.componentInstance as unknown as { primary: () => unknown };
      const before = JSON.stringify(component.primary());

      frame()(450);
      expect(JSON.stringify(component.primary())).not.toBe(before);
      const midTick = JSON.stringify(component.primary());

      // A long pause advances the walks by whole ticks, never replaying more than one screenful.
      frame()(900 * 100);
      expect(JSON.stringify(component.primary())).not.toBe(midTick);

      fixture.destroy();
      expect(cancel).toHaveBeenCalled();
    } finally {
      vi.unstubAllGlobals();
      vi.restoreAllMocks();
    }
  });
});
