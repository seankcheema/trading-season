import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { SettingsDialogComponent } from './settings-dialog.component';
import { MarketClockService } from '../shared/market-clock.service';

describe('Persisted execution settings', () => {
  beforeEach(() => TestBed.configureTestingModule({ imports: [SettingsDialogComponent], providers: [provideHttpClient(), provideHttpClientTesting(), MarketClockService] }));
  afterEach(() => TestBed.inject(HttpTestingController).verify());
  it('loads the saved value, validates percentages and confirms a persisted update', () => {
    const fixture = TestBed.createComponent(SettingsDialogComponent); fixture.detectChanges();
    const http = TestBed.inject(HttpTestingController);
    expect(fixture.nativeElement.querySelector('#executionBuffer')).toBeNull();
    http.expectOne('/api/users/me/execution-settings').flush({ executionBufferPercent: 2 }); fixture.detectChanges();
    const input = fixture.nativeElement.querySelector('#executionBuffer') as HTMLInputElement;
    const save = fixture.nativeElement.querySelector('footer button') as HTMLButtonElement;
    expect(input.value).toBe('2');
    for (const value of ['-0.01', '10.01', '1.001', '']) {
      input.value = value; input.dispatchEvent(new Event('input')); fixture.detectChanges(); expect(save.disabled).toBe(true);
    }
    input.value = '1.25'; input.dispatchEvent(new Event('input')); fixture.detectChanges(); save.click();
    const request = http.expectOne('/api/users/me/execution-settings'); expect(request.request.method).toBe('PUT');
    expect(request.request.body).toEqual({ executionBufferPercent: 1.25 });
    request.flush({ executionBufferPercent: 1.25 }); fixture.detectChanges();
    expect(save.textContent).toContain('Saved successfully'); fixture.destroy();
  });
  it('does not save an invented default after loading fails and supports retry', () => {
    const fixture = TestBed.createComponent(SettingsDialogComponent); fixture.detectChanges();
    const http = TestBed.inject(HttpTestingController);
    http.expectOne('/api/users/me/execution-settings').flush({}, { status: 503, statusText: 'Unavailable' }); fixture.detectChanges();
    expect((fixture.nativeElement.querySelector('footer button') as HTMLButtonElement).disabled).toBe(true);
    const retry = [...fixture.nativeElement.querySelectorAll('button')].find((button: any) => button.textContent.includes('Retry loading')) as HTMLButtonElement;
    retry.click(); http.expectOne('/api/users/me/execution-settings').flush({ executionBufferPercent: 0 }); fixture.detectChanges();
    expect((fixture.nativeElement.querySelector('#executionBuffer') as HTMLInputElement).value).toBe('0');
  });
});
