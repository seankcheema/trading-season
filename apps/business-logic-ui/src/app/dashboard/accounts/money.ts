import { AbstractControl, ValidationErrors, ValidatorFn } from '@angular/forms';

// Rejects amounts with fractions of a cent. Empty values are left to Validators.required.
export const wholeCentsValidator: ValidatorFn = (
  control: AbstractControl<number | null>,
): ValidationErrors | null => {
  const value = control.value;
  if (value === null || value === undefined || Number.isNaN(value)) {
    return null;
  }
  return Math.abs(Math.round(value * 100) - value * 100) < 1e-6 ? null : { wholeCents: true };
};

// Rounds to cents so binary floating point noise never reaches the API.
export function toCents(value: number): number {
  return Math.round(value * 100) / 100;
}
