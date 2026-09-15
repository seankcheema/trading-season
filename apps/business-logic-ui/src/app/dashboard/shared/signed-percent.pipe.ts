import { Pipe, PipeTransform } from '@angular/core';

// Formats a percentage with an explicit sign, e.g. 5.2 -> "+5.20%".
@Pipe({ name: 'signedPercent' })
export class SignedPercentPipe implements PipeTransform {
  transform(value: number): string {
    return `${value >= 0 ? '+' : ''}${value.toFixed(2)}%`;
  }
}
