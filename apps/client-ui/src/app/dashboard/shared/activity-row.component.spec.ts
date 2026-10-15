import { TestBed } from '@angular/core/testing';
import { of, Subject, throwError } from 'rxjs';
import { vi } from 'vitest';
import { ActivityItem, ActivityRowComponent } from './activity-row.component';
import { OrderService } from '../orders/order.service';
import { AccountStore } from '../accounts/account-store.service';
import { OrderResult } from '../orders/order.models';

describe('Activity row cancellation', () => {
  const item: ActivityItem = { kind: 'trade', key: 'order-1', date: '2026-01-05T15:00:00Z',
    value: 100, label: 'AAPL', detail: '1 share', type: 'BUY', status: 'ACCEPTED',
    positive: false, orderId: 1, accountId: 9 };
  function setup() {
    const pending = new Subject<OrderResult>();
    const orders = { cancelOrder: vi.fn(() => pending), editOrder: vi.fn() };
    const accounts = { refreshAfterTrade: vi.fn(() => of(undefined)) };
    TestBed.configureTestingModule({ providers: [
      { provide: OrderService, useValue: orders }, { provide: AccountStore, useValue: accounts },
    ] });
    const fixture = TestBed.createComponent(ActivityRowComponent);
    fixture.componentRef.setInput('transaction', item); fixture.detectChanges();
    return { fixture, orders, accounts, pending, component: fixture.componentInstance };
  }
  it('sends one cancellation while busy and refreshes the affected account on success', () => {
    const { fixture, component, orders, accounts, pending } = setup();
    component['cancel'](); component['cancel'](); fixture.detectChanges();
    expect(orders.cancelOrder).toHaveBeenCalledExactlyOnceWith(1);
    expect(fixture.nativeElement.textContent).toContain('Cancelling');
    pending.next({ status: 'CANCELLED' } as OrderResult);
    expect(component['cancelling']()).toBe(false);
    expect(accounts.refreshAfterTrade).toHaveBeenCalledWith(9);
    const edit = fixture.nativeElement.querySelector('[role=menuitem]') as HTMLButtonElement;
    fixture.detectChanges(); edit.click(); expect(orders.editOrder).toHaveBeenCalledWith(1);
  });
  it('shows a cancellation failure and allows another attempt', () => {
    const { fixture, component, orders, pending } = setup();
    component['cancel'](); pending.error(new Error('offline')); fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('[role=alert]').textContent).toContain('Unable to cancel');
    expect(component['cancelling']()).toBe(false);
    component['cancel'](); expect(orders.cancelOrder).toHaveBeenCalledTimes(2);
  });
  it('keeps successful cancellation distinct from a balance refresh failure', () => {
    const { fixture, component, accounts, pending } = setup();
    accounts.refreshAfterTrade.mockReturnValue(throwError(() => new Error('offline')));
    component['cancel'](); pending.next({ status: 'CANCELLED' } as OrderResult); fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('[role=alert]').textContent).toContain('Retry refreshing balances');
  });
  it('ignores rows without an order and skips balance refresh when no account is present', () => {
    const { fixture, component, orders, accounts, pending } = setup();
    fixture.componentRef.setInput('transaction', { ...item, orderId: undefined });
    component['cancel'](); expect(orders.cancelOrder).not.toHaveBeenCalled();
    fixture.componentRef.setInput('transaction', { ...item, accountId: undefined });
    component['cancel'](); pending.next({ status: 'CANCELLED' } as OrderResult);
    expect(accounts.refreshAfterTrade).not.toHaveBeenCalled();
  });
});
