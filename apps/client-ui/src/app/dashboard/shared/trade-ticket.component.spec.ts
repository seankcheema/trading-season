import { ExecutionSettingsService } from '../settings-dialog/execution-settings.service';
import { of } from 'rxjs';
import { TestBed } from '@angular/core/testing';
import { TradeTicketComponent } from './trade-ticket.component';

describe('Market preview quantities', () => {
  beforeEach(() => TestBed.configureTestingModule({providers: [{ provide: ExecutionSettingsService, useValue: { load: () => of({ executionBufferPercent: 0 }), save: (executionBufferPercent: number) => of({ executionBufferPercent }) } }]}));
  function setup() {
    const fixture = TestBed.createComponent(TradeTicketComponent);
    fixture.componentRef.setInput('symbol', 'AAPL');
    fixture.componentRef.setInput('price', 100);
    fixture.componentRef.setInput('cashBalance', 1000);
    fixture.componentRef.setInput('heldShares', 3.8);
    fixture.detectChanges();
    return fixture;
  }

  it('corrects the visible value on every edit and synchronizes the slider', () => {
    const fixture = setup();
    const input = fixture.nativeElement.querySelector('input[type="number"]') as HTMLInputElement;
    for (const [typed, expected] of [
      ['12', '10'],
      ['99', '10'],
      ['-2', '0'],
      ['-3', '0'],
      ['', '0'],
      ['abc', '0'],
      ['2.9', '2'],
    ]) {
      input.value = typed;
      input.dispatchEvent(new Event('input'));
      fixture.detectChanges();
      expect(input.value).toBe(expected);
      expect(fixture.nativeElement.querySelector('input[type="range"]').value).toBe(expected);
    }
    fixture.componentRef.setInput('price', 600);
    fixture.detectChanges();
    expect(input.value).toBe('1');
    fixture.componentRef.setInput('cashBalance', 5000);
    fixture.detectChanges();
    expect(input.value).toBe('1');
    fixture.componentInstance['selectSide']('sell');
    fixture.componentRef.setInput('heldShares', 0);
    fixture.detectChanges();
    expect(input.value).toBe('0');
    expect(input.disabled).toBe(true);
  });

  it('uses whole nonnegative holdings and safe price limits', () => {
    const fixture = setup();
    fixture.componentInstance['selectSide']('sell');
    expect(fixture.componentInstance['maxShares']()).toBe(3);
    fixture.componentInstance['selectSide']('buy');
    for (const price of [0, -1, Infinity, NaN]) {
      fixture.componentRef.setInput('price', price);
      expect(fixture.componentInstance['maxShares']()).toBe(0);
    }
  });
  it('refuses to submit more shares than can be traded', () => {
    const fixture = setup();
    fixture.componentRef.setInput('ready', true);
    fixture.detectChanges();
    const submitted = vi.fn();
    fixture.componentInstance.submitted.subscribe(submitted);

    fixture.componentInstance['quantity'].set(50);
    fixture.componentInstance['submitOrder']();
    expect(submitted).not.toHaveBeenCalled();

    fixture.componentInstance['quantity'].set(2);
    fixture.componentInstance['submitOrder']();
    expect(submitted).toHaveBeenCalledOnce();
  });

});
