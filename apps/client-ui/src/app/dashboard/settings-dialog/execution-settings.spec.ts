import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { SettingsDialogComponent } from './settings-dialog.component';

describe('Execution buffer settings', () => {
  let http: HttpTestingController;
  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [SettingsDialogComponent],
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    http = TestBed.inject(HttpTestingController);
  });
  afterEach(() => http.verify());
  function render() {
    const fixture = TestBed.createComponent(SettingsDialogComponent);
    fixture.detectChanges();
    const element = fixture.nativeElement as HTMLElement;
    const input = element.querySelector('#executionBuffer') as HTMLInputElement;
    const save = [...element.querySelectorAll('button')].find((b) =>
      b.textContent?.includes('Save execution buffer'),
    )!;
    return { fixture, element, input, save };
  }
  it('loads saved protection, validates precision and persists changes', () => {
    const { fixture, input, save, element } = render();
    expect(save.disabled).toBe(true);
    http.expectOne('/api/users/me/execution-settings').flush({ executionBufferPercent: 2 });
    fixture.detectChanges();
    expect(input.value).toBe('2');
    input.value = '1.001';
    input.dispatchEvent(new Event('input'));
    fixture.detectChanges();
    expect(save.disabled).toBe(true);
    input.value = '1.25';
    input.dispatchEvent(new Event('input'));
    fixture.detectChanges();
    save.click();
    fixture.detectChanges();
    const request = http.expectOne('/api/users/me/execution-settings');
    expect(request.request.method).toBe('PUT');
    expect(request.request.body).toEqual({ executionBufferPercent: 1.25 });
    expect(save.disabled).toBe(true);
    request.flush({ executionBufferPercent: 1.25 });
    fixture.detectChanges();
    expect(save.textContent).toContain('Saved successfully');
    expect(element.querySelector('#buffer-feedback')?.textContent).toBe('');
    expect(save.disabled).toBe(true);
  });
  it('disables saving during success and enables it when the message disappears', () => {
    vi.useFakeTimers();
    try {
      const { fixture, save, element } = render();
      http.expectOne('/api/users/me/execution-settings').flush({ executionBufferPercent: 1 });
      fixture.detectChanges();
      save.click();
      fixture.detectChanges();
      expect(element.querySelector('.buffer-save-spinner')).not.toBeNull();
      http.expectOne('/api/users/me/execution-settings').flush({ executionBufferPercent: 1 });
      fixture.detectChanges();
      expect(save.disabled).toBe(true);
      vi.advanceTimersByTime(2000);
      save.click();
      fixture.detectChanges();
      http.expectNone('/api/users/me/execution-settings');
      vi.advanceTimersByTime(499);
      fixture.detectChanges();
      expect(save.textContent).toContain('Saved successfully');
      vi.advanceTimersByTime(1);
      fixture.detectChanges();
      expect(save.textContent).toContain('Save execution buffer');
      expect(save.disabled).toBe(false);
      save.click();
      http.expectOne('/api/users/me/execution-settings').flush({ executionBufferPercent: 1 });
      fixture.destroy();
    } finally {
      vi.useRealTimers();
    }
  });
  it('disables saving after a failed load and supports retry', () => {
    const { fixture, save, element } = render();
    http
      .expectOne('/api/users/me/execution-settings')
      .flush({}, { status: 503, statusText: 'Unavailable' });
    fixture.detectChanges();
    expect(save.disabled).toBe(true);
    [...element.querySelectorAll('button')]
      .find((b) => b.textContent?.includes('Retry loading'))!
      .click();
    http.expectOne('/api/users/me/execution-settings').flush({ executionBufferPercent: 0 });
    fixture.detectChanges();
    expect(save.disabled).toBe(false);
    save.click();
    http
      .expectOne('/api/users/me/execution-settings')
      .flush({}, { status: 503, statusText: 'Unavailable' });
    fixture.detectChanges();
    expect(element.textContent).toContain('Unable to save');
    expect(save.disabled).toBe(false);
  });
});
