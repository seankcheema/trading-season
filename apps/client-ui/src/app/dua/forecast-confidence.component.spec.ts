import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { ForecastRecord } from './dua-insights';
import { ForecastConfidenceComponent } from './forecast-confidence.component';

@Component({
  imports: [ForecastConfidenceComponent],
  template: `<app-forecast-confidence [record]="record()" />`,
})
class HostComponent {
  readonly record = signal<ForecastRecord>({
    hits: 15,
    total: 20,
    unit: 'calls',
    percent: 75,
    called: true,
  });
}

describe('ForecastConfidenceComponent', () => {
  it('shows the hit rate as a confidence score with a bar filled to it', () => {
    const fixture = TestBed.createComponent(HostComponent);
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;
    expect(el.textContent?.trim()).toBe('75% confidence');
    expect((el.querySelector('.fill') as HTMLElement).style.width).toBe('75%');
    expect(el.querySelector('.bar')!.getAttribute('aria-hidden')).toBe('true');
  });

  it('says how often it is right when it calls, on a week it makes no call', () => {
    const fixture = TestBed.createComponent(HostComponent);
    fixture.componentInstance.record.set({
      hits: 8,
      total: 10,
      unit: 'calls',
      percent: 80,
      called: false,
    });
    fixture.detectChanges();
    expect((fixture.nativeElement as HTMLElement).textContent?.trim()).toBe(
      'Right 80% when it calls',
    );
  });
});
