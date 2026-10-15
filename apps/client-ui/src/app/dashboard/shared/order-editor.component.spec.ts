import { Component, input, output, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { of, throwError } from 'rxjs';
import { vi } from 'vitest';
import { OrderEditorComponent } from './order-editor.component';
import { OrderService } from '../orders/order.service';
import { AccountStore } from '../accounts/account-store.service';
import { OrderResult } from '../orders/order.models';

@Component({ selector: 'app-order-submission', template: '' })
class TicketStub {
  instrument = input<unknown>(); instruments = input<unknown>(); editOrder = input<unknown>();
  sessionId = input<unknown>(); marketTimestamp = input<unknown>(); accountId = input<unknown>();
  cashBalance = input<unknown>(); positions = input<unknown>();
  closed = output<void>(); submitted = output<void>();
}

describe('OrderEditorComponent', () => {
  const order: OrderResult = { orderId: 1, accountId: 9, instrumentId: 7, status: 'ACCEPTED',
    orderType: 'BUY', quantity: 2, indicativePrice: 100, referencePrice: 101,
    reservedCash: 200, reservedShares: 2, rejectionReason: null,
    submittedAt: '2026-01-05T15:00:00Z', resolvedAt: null };
  function setup() {
    const orders = { editingOrder: signal<OrderResult | null>(null), catalogue: signal([
      { instrumentId: 7, ticker: 'AAPL.O', simulatedStockSymbol: 'AAPL', name: 'Apple' },
    ]) };
    const accounts = { spendableFunds: signal(800), holdingsByAccount: signal(new Map([
      [9, [{ symbol: 'AAPL', quantity: 5, availableQuantity: 3 }]],
    ])), refreshAfterTrade: vi.fn(() => of(undefined)), load: vi.fn() };
    TestBed.configureTestingModule({ providers: [
      { provide: OrderService, useValue: orders }, { provide: AccountStore, useValue: accounts },
    ] }).overrideComponent(OrderEditorComponent, { set: { imports: [TicketStub] } });
    const fixture = TestBed.createComponent(OrderEditorComponent);
    return { fixture, orders, accounts, component: fixture.componentInstance };
  }
  it('opens only a known instrument and returns the edited order reservation to buying power', () => {
    const { fixture, orders, component } = setup();
    fixture.detectChanges(); expect(fixture.nativeElement.children).toHaveLength(0);
    expect(component['positions']()).toEqual({});
    orders.editingOrder.set(order); fixture.detectChanges();
    const ticket = fixture.debugElement.query(By.directive(TicketStub)).componentInstance as TicketStub;
    expect(ticket.cashBalance()).toBe(1000);
    expect(ticket.accountId()).toBe('9');
    expect(ticket.instrument()).toMatchObject({ symbol: 'AAPL', price: 101 });
    expect(ticket.positions()).toEqual({ AAPL: 3 });
    ticket.closed.emit(); fixture.detectChanges();
    expect(orders.editingOrder()).toBeNull();
    orders.catalogue.set([]); orders.editingOrder.set(order); fixture.detectChanges();
    expect(component['instrument']()).toBeNull();
    expect(fixture.debugElement.query(By.directive(TicketStub))).toBeNull();
  });
  it('uses the live quote and credits only the original sell reservation to available shares', () => {
    const { fixture, orders, component } = setup();
    fixture.componentRef.setInput('instruments', [{ symbol: 'AAPL', name: 'Apple', price: 110 }]);
    orders.editingOrder.set({ ...order, orderType: 'SELL' }); fixture.detectChanges();
    expect(component['instrument']()?.price).toBe(110);
    expect(component['positions']()).toEqual({ AAPL: 5 });
    orders.editingOrder.set({ ...order, orderType: 'SELL', accountId: undefined, reservedShares: undefined });
    expect(component['positions']()).toEqual({ AAPL: 0 });
  });
  it('falls back to the catalogue ticker, indicative price and total holdings for older records', () => {
    const { orders, accounts, component } = setup();
    orders.catalogue.set([{ instrumentId: 7, ticker: 'AAPL', simulatedStockSymbol: null!, name: 'Apple' }]);
    accounts.holdingsByAccount.set(new Map([[9, [{ symbol: 'AAPL', quantity: 5, availableQuantity: undefined! }]]]));
    orders.editingOrder.set({ ...order, referencePrice: undefined, reservedCash: undefined });
    expect(component['instrument']()).toMatchObject({ symbol: 'AAPL', price: 100 });
    expect(component['cash']()).toBe(800);
    expect(component['positions']()).toEqual({ AAPL: 5 });
  });
  it('closes after saving, refreshes the original account and retries a failed refresh', () => {
    const { fixture, orders, accounts, component } = setup();
    orders.editingOrder.set(order); fixture.detectChanges();
    const ticket = fixture.debugElement.query(By.directive(TicketStub)).componentInstance as TicketStub;
    ticket.submitted.emit();
    expect(orders.editingOrder()).toBeNull(); expect(accounts.refreshAfterTrade).toHaveBeenCalledWith(9);
    orders.editingOrder.set(order);
    accounts.refreshAfterTrade.mockReturnValue(throwError(() => new Error('offline')));
    component['saved'](); expect(accounts.load).toHaveBeenCalledWith(true);
    accounts.refreshAfterTrade.mockClear(); component['saved']();
    expect(accounts.refreshAfterTrade).not.toHaveBeenCalled();
  });
});
