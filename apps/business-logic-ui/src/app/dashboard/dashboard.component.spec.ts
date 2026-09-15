import { TestBed } from '@angular/core/testing';
import { DashboardComponent } from './dashboard.component';
import { MOCK_INSTRUMENTS } from './mock-data';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';

describe('DashboardComponent', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [DashboardComponent],
      providers: [provideHttpClient(), provideHttpClientTesting()],
    }).compileComponents();
  });

  it('should create the dashboard component', () => {
    const fixture = TestBed.createComponent(DashboardComponent);
    expect(fixture.componentInstance).toBeTruthy();
  });

  it('should not show the order submission dialog initially', () => {
    const fixture = TestBed.createComponent(DashboardComponent);
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('app-order-submission')).toBeNull();
  });

  it('should open the order submission dialog when an instrument is selected', async () => {
    const fixture = TestBed.createComponent(DashboardComponent);
    fixture.componentInstance['openOrder'](MOCK_INSTRUMENTS[0]);
    fixture.detectChanges();
    await fixture.whenStable();
    expect(fixture.nativeElement.querySelector('[role="dialog"]')).not.toBeNull();
  });

  it('should close the dialog after an order is submitted', () => {
    const fixture = TestBed.createComponent(DashboardComponent);
    const component = fixture.componentInstance;
    component['openOrder'](MOCK_INSTRUMENTS[0]);
    component['onOrderSubmitted']({
      accountId: 'personal',
      symbol: 'AAPL',
      side: 'buy',
      shares: 1,
      price: MOCK_INSTRUMENTS[0].price,
    });
    expect(component['orderInstrument']()).toBeNull();
  });
});
