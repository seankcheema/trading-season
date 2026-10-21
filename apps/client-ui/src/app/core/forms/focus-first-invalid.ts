import { FormGroup } from '@angular/forms';

// After a submit that failed validation, moves focus to the first field in error, so keyboard
// and screen reader users land on it and hear its message (WCAG 3.3.1). Fields are taken in
// the form's own order; `groupErrorField` names the field to focus for an error on the group
// itself, such as passwords that do not match. The Reporting UI has the same helper; keep the
// two alike.
export function focusFirstInvalid(
  host: HTMLElement,
  form: FormGroup,
  groupErrorField?: string,
): void {
  const name =
    Object.keys(form.controls).find((key) => form.controls[key].invalid) ??
    (form.errors ? groupErrorField : undefined);
  if (name) {
    host.querySelector<HTMLElement>(`[formControlName="${name}"]`)?.focus();
  }
}
