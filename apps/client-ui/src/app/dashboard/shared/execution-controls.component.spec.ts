import { TestBed } from '@angular/core/testing';
import { of, throwError, Subject } from 'rxjs';
import { ExecutionSettingsService } from '../settings-dialog/execution-settings.service';
import { ExecutionControlsComponent } from './execution-controls.component';

describe('ExecutionControlsComponent', () => {
  function setup(load: () => import('rxjs').Observable<{ executionBufferPercent: number }> = () => of({ executionBufferPercent: 2 })) {
    TestBed.configureTestingModule({ providers: [{ provide: ExecutionSettingsService, useValue: { load } }] });
    const fixture = TestBed.createComponent(ExecutionControlsComponent);
    fixture.componentRef.setInput('price', 100); fixture.componentRef.setInput('side', 'buy');
    fixture.componentRef.setInput('quantity', 3); fixture.detectChanges();
    return fixture;
  }
  it('keeps preference loading status out of spaced document flow', () => {
    const settings = new Subject<{ executionBufferPercent: number }>();
    const fixture = setup(() => settings);
    const root = fixture.nativeElement as HTMLElement;
    expect(root.firstElementChild?.classList.contains('grid')).toBe(true);
    expect(root.firstElementChild?.classList.contains('space-y-3')).toBe(false);
    expect(root.querySelector('[role=status]')?.classList.contains('sr-only')).toBe(true);
    settings.next({ executionBufferPercent: 1 }); fixture.detectChanges();
    expect(root.firstElementChild?.classList.contains('grid')).toBe(true);
  });
  it('shows Market immediately while retaining internal protection calculations', () => {
    const fixture = setup(); const component = fixture.componentInstance;
    expect(component.bound()).toBe(102); expect(component.reservationPrice()).toBe(102);
    expect(fixture.nativeElement.querySelector('summary').textContent.trim()).toBe('Market');
    expect(fixture.nativeElement.textContent).not.toContain('Estimated');
    expect(fixture.nativeElement.textContent).not.toContain('% buffer');
    fixture.componentRef.setInput('side', 'sell'); fixture.detectChanges();
    expect(component.bound()).toBe(98); expect(fixture.nativeElement.textContent).not.toContain('or higher');
  });
  it('requires only the selected conditional fields and never sends stale hidden prices', () => {
    const fixture = setup(); const component = fixture.componentInstance;
    component.executionType.set('STOP_LIMIT'); fixture.detectChanges(); expect(component.valid()).toBe(false);
    component.limitPrice.set(101); component.stopPrice.set(105); fixture.detectChanges();
    expect(component.valid()).toBe(true); expect(component.reservationPrice()).toBe(101);
    expect(component.parameters()).toEqual({ executionType: 'STOP_LIMIT', limitPrice: 101, stopPrice: 105 });
    component.executionType.set('STOP'); fixture.detectChanges();
    expect(component.parameters()).toEqual({ executionType: 'STOP', stopPrice: 105 });
    expect(fixture.nativeElement.textContent).not.toContain('quote at submission');
    component.executionType.set('MARKET');
    expect(component.parameters()).toEqual({ executionType: 'MARKET' });
  });
  it('rejects invalid prices and gates submission while preferences are unavailable', () => {
    const fixture = setup(); const component = fixture.componentInstance;
    for (const value of [0, -1, Infinity, NaN, 0.0000001, 1e12, null]) expect(component.validPrice(value)).toBe(false);
    component.executionType.set('LIMIT'); component.limitPrice.set(-1); expect(component.valid()).toBe(false);
  });
  it('keeps failure explicit and retries the preference request', () => {
    let failed = true;
    const fixture = setup(() => failed ? throwError(() => new Error('offline')) : of({ executionBufferPercent: 1 }));
    expect(fixture.componentInstance.valid()).toBe(false);
    expect(fixture.nativeElement.textContent).toContain('Unable to load');
    failed = false; fixture.componentInstance.load(); fixture.detectChanges();
    expect(fixture.componentInstance.valid()).toBe(true);
  });
  it('selects through the rounded account-style menu and returns to a visible Market default', () => {
    const fixture = setup();
    const root = fixture.nativeElement as HTMLElement;
    const trigger = root.querySelector('summary')!;
    expect(trigger.textContent?.trim()).toBe('Market');
    const choose = (name: string) => {
      trigger.click(); fixture.detectChanges();
      const option = [...root.querySelectorAll<HTMLButtonElement>('[role="menuitemradio"]')]
        .find((button) => button.textContent?.trim() === name)!;
      option.click(); fixture.detectChanges();
    };
    choose('Limit');
    expect(root.querySelector('input[aria-label="Limit price"]')).not.toBeNull();
    expect(root.querySelector('input[aria-label="Stop price"]')).toBeNull();
    choose('Stop');
    expect(root.querySelector('input[aria-label="Limit price"]')).toBeNull();
    expect(root.querySelector('input[aria-label="Stop price"]')).not.toBeNull();
    expect(root.textContent).not.toContain('Enter a positive price');
    choose('Stop-Limit'); expect(root.querySelectorAll('input')).toHaveLength(2);
    choose('Market'); expect(trigger.textContent?.trim()).toBe('Market');
    expect(root.querySelectorAll('input')).toHaveLength(0);
    expect(fixture.componentInstance.parameters()).toEqual({ executionType: 'MARKET' });
  });
});
