import { TestBed } from '@angular/core/testing';
import { TradeTicketComponent } from './trade-ticket.component';

describe('Market preview quantities', () => {
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
});
