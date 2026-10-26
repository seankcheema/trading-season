import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { ForecastTrackComponent } from './forecast-track.component';

@Component({
  imports: [ForecastTrackComponent],
  template: `<app-forecast-track [hits]="hits()" [total]="total()" unit="weeks" />`,
})
class HostComponent {
  readonly hits = signal(15);
  readonly total = signal(20);
}

describe('ForecastTrackComponent', () => {
  it('draws one cell per closed week, the right ones filled first, and reads the frequency out', () => {
    const fixture = TestBed.createComponent(HostComponent);
    fixture.detectChanges();
    const track = fixture.nativeElement.querySelector('app-forecast-track') as HTMLElement;
    expect(track.getAttribute('role')).toBe('img');
    expect(track.getAttribute('aria-label')).toBe('Right on 15 of the last 20 weeks');
    const cells = [...track.querySelectorAll('.cell')];
    expect(cells).toHaveLength(20);
    expect(cells.filter((c) => c.classList.contains('hit'))).toHaveLength(15);
    expect(cells.slice(0, 15).every((c) => c.classList.contains('hit'))).toBe(true);

    fixture.componentInstance.hits.set(3);
    fixture.componentInstance.total.set(4);
    fixture.detectChanges();
    expect(track.querySelectorAll('.cell')).toHaveLength(4);
    expect(track.querySelectorAll('.cell.hit')).toHaveLength(3);
  });
});
