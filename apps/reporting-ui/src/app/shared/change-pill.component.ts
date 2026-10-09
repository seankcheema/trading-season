import {
  ChangeDetectionStrategy,
  Component,
  booleanAttribute,
  computed,
  input,
} from '@angular/core';
import { signedPercent } from '../reporting/format';

export type PillTone = 'gain' | 'loss' | 'primary' | 'muted';

// Tint behind the text: 10 percent for a change, 15 percent for a tag.
const TONES: Record<PillTone, { change: string; tag: string }> = {
  gain: { change: 'text-gain bg-gain/10', tag: 'text-gain bg-gain/15' },
  loss: { change: 'text-loss bg-loss/10', tag: 'text-loss bg-loss/15' },
  primary: { change: 'text-primary bg-primary/15', tag: 'text-primary bg-primary/15' },
  muted: { change: 'text-muted-foreground bg-muted', tag: 'text-muted-foreground bg-muted' },
};

// What each order and account status looks like as a tag.
const STATUS_TONES: Record<string, PillTone> = {
  ACTIVE: 'gain',
  LOCKED: 'loss',
  FILLED: 'gain',
  PENDING: 'primary',
  ACCEPTED: 'primary',
  REJECTED: 'loss',
};

export function statusTone(status: string): PillTone {
  return STATUS_TONES[status] ?? 'muted';
}

// A rounded-full badge. With a value it is a signed percentage, green up and red
// down; as a tag it is a 10px uppercase label such as a status or an order side.
@Component({
  selector: 'app-change-pill',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    class: 'inline-block rounded-full px-2 py-0.5 font-medium whitespace-nowrap tabular-nums',
    '[class]': 'classes()',
  },
  template: `<ng-content>{{ text() }}</ng-content>`,
})
export class ChangePillComponent {
  readonly value = input<number | null>(null);
  readonly tone = input<PillTone | null>(null);
  readonly tag = input(false, { transform: booleanAttribute });

  protected readonly text = computed(() => {
    const value = this.value();
    return value === null ? '' : signedPercent(value);
  });

  protected readonly classes = computed(() => {
    const value = this.value();
    const tone = this.tone() ?? (value === null ? 'primary' : value >= 0 ? 'gain' : 'loss');
    return this.tag() ? `text-[10px] uppercase ${TONES[tone].tag}` : `text-xs ${TONES[tone].change}`;
  });
}
