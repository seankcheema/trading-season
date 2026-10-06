import { TestBed } from '@angular/core/testing';
import { ORDER_DISCLAIMER_SUBTEXT } from '../orders/order-disclaimer';
import { TradeTicketComponent, TradeTicketDraft } from './trade-ticket.component';

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

  describe('order review', () => {
    function readyTicket() {
      const fixture = setup();
      fixture.componentRef.setInput('ready', true);
      fixture.componentRef.setInput('accountId', '4');
      fixture.detectChanges();
      const el = fixture.nativeElement as HTMLElement;
      const quantity = el.querySelector('input[type="number"]') as HTMLInputElement;
      quantity.value = '2';
      quantity.dispatchEvent(new Event('input'));
      fixture.detectChanges();
      const submitted: TradeTicketDraft[] = [];
      fixture.componentInstance.submitted.subscribe((draft) => submitted.push(draft));
      const submit = () => {
        (el.querySelector('section > button') as HTMLButtonElement).click();
        fixture.detectChanges();
      };
      const confirm = () =>
        el.querySelector<HTMLButtonElement>('[data-testid="order-review-confirm"]');
      return { fixture, el, submitted, submit, confirm };
    }

    it('shows the disclaimer subtext under the submit button', () => {
      const { el } = readyTicket();

      expect(el.querySelector('[data-testid="order-disclaimer"]')!.textContent!.trim()).toBe(
        ORDER_DISCLAIMER_SUBTEXT,
      );
    });

    it('emits the order only after the review is confirmed', () => {
      const { fixture, el, submitted, submit, confirm } = readyTicket();

      submit();
      expect(submitted).toHaveLength(0);
      expect(el.querySelector('[data-testid="order-review-summary"]')!.textContent).toContain(
        'Buy 2 AAPL',
      );

      confirm()!.click();
      fixture.detectChanges();
      expect(submitted).toEqual([
        expect.objectContaining({ accountId: '4', side: 'buy', quantity: 2 }),
      ]);
      expect(confirm()).toBeNull();
    });

    it('emits nothing when the review is cancelled', () => {
      const { fixture, el, submitted, submit, confirm } = readyTicket();

      submit();
      Array.from(el.querySelectorAll<HTMLButtonElement>('button'))
        .find((button) => button.textContent?.trim() === 'Cancel')!
        .click();
      fixture.detectChanges();

      expect(confirm()).toBeNull();
      expect(submitted).toHaveLength(0);
    });

    it('does not emit a confirmation once the ticket became busy', () => {
      const { fixture, submitted, submit, confirm } = readyTicket();

      submit();
      fixture.componentRef.setInput('busy', true);
      fixture.detectChanges();
      confirm()!.click();

      expect(submitted).toHaveLength(0);
    });
  });
});
