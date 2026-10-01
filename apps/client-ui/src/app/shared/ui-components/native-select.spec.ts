import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { FormControl, ReactiveFormsModule, Validators } from '@angular/forms';
import { By } from '@angular/platform-browser';
import { HlmNativeSelect, HlmNativeSelectImports } from '@shared/ui-components/native-select';

@Component({
  standalone: true,
  imports: [HlmNativeSelectImports],
  template: `
    <hlm-native-select
      [selectId]="selectId()"
      [selectClass]="selectClass()"
      [selectIconClass]="selectIconClass()"
      [size]="size()"
      [disabled]="disabled()"
      [forceInvalid]="forceInvalid()"
      [value]="value()"
      (valueChange)="lastEmitted = $event"
    >
      <optgroup hlmNativeSelectOptGroup label="Group">
        <option hlmNativeSelectOption value="a">A</option>
        <option hlmNativeSelectOption value="b">B</option>
      </optgroup>
    </hlm-native-select>
  `,
})
class NativeSelectHost {
  selectId = signal('my-select');
  selectClass = signal('');
  selectIconClass = signal('');
  size = signal<'sm' | 'default'>('default');
  disabled = signal(false);
  forceInvalid = signal(false);
  value = signal<string | undefined | null>('a');
  lastEmitted: string | undefined | null = undefined;
}

@Component({
  standalone: true,
  imports: [HlmNativeSelectImports, ReactiveFormsModule],
  template: `
    <hlm-native-select [formControl]="control" [aria-invalid]="ariaInvalidOverride()">
      <option hlmNativeSelectOption value="a">A</option>
      <option hlmNativeSelectOption value="b">B</option>
    </hlm-native-select>
  `,
})
class FormNativeSelectHost {
  control = new FormControl('a', { validators: Validators.required });
  ariaInvalidOverride = signal<boolean | undefined>(undefined);
}

describe('HlmNativeSelect', () => {
  function setup() {
    const fixture = TestBed.createComponent(NativeSelectHost);
    fixture.detectChanges();
    return fixture;
  }

  function getSelect(fixture: ReturnType<typeof setup>) {
    return fixture.nativeElement.querySelector('select') as HTMLSelectElement;
  }

  it('renders the wrapper and select with default size', () => {
    const fixture = setup();
    const wrapper = fixture.nativeElement.querySelector('[data-slot="native-select-wrapper"]');
    const select = getSelect(fixture);

    expect(wrapper.getAttribute('data-size')).toBe('default');
    expect(select.id).toBe('my-select');
    expect(select.value).toBe('a');
    expect(select.className).toContain('border-input');
  });

  it('merges a custom selectClass and selectIconClass', () => {
    const fixture = setup();

    fixture.componentInstance.selectClass.set('my-select-class');
    fixture.componentInstance.selectIconClass.set('my-icon-class');
    fixture.detectChanges();
    const select = getSelect(fixture);
    const icon = fixture.nativeElement.querySelector('[data-slot="native-select-icon"]');

    expect(select.className).toContain('my-select-class');
    expect(icon.className).toContain('my-icon-class');
  });

  it('applies the sm size to the wrapper, select, and optgroup/option directives', () => {
    const fixture = setup();

    fixture.componentInstance.size.set('sm');
    fixture.detectChanges();
    const select = getSelect(fixture);

    expect(select.getAttribute('data-size')).toBe('sm');
    expect(fixture.nativeElement.querySelector('optgroup').className).toContain('bg-[Canvas]');
    expect(fixture.nativeElement.querySelector('option').className).toContain('bg-[Canvas]');
  });

  it('disables the select and reflects data-disabled styling', () => {
    const fixture = setup();

    fixture.componentInstance.disabled.set(true);
    fixture.detectChanges();

    expect(getSelect(fixture).disabled).toBe(true);
  });

  it('forces an invalid state when forceInvalid is set', () => {
    const fixture = setup();

    fixture.componentInstance.forceInvalid.set(true);
    fixture.detectChanges();
    const select = getSelect(fixture);

    expect(select.getAttribute('data-matches-spartan-invalid')).toBe('true');
  });

  it('emits valueChange and updates the value signal when the select changes', () => {
    const fixture = setup();
    const select = getSelect(fixture);

    select.value = 'b';
    select.dispatchEvent(new Event('change'));
    fixture.detectChanges();

    expect(fixture.componentInstance.lastEmitted).toBe('b');
  });

  it('implements ControlValueAccessor methods directly', () => {
    const fixture = setup();
    const directive = fixture.debugElement
      .query(By.directive(HlmNativeSelect))
      .injector.get(HlmNativeSelect);

    let changedValue: string | undefined | null = undefined;
    let touched = false;
    directive.registerOnChange((v) => (changedValue = v));
    directive.registerOnTouched(() => (touched = true));

    directive.writeValue('b');
    fixture.detectChanges();
    expect(getSelect(fixture).value).toBe('b');

    const select = getSelect(fixture);
    select.dispatchEvent(new Event('blur'));
    expect(touched).toBe(true);

    directive.setDisabledState(true);
    fixture.detectChanges();
    expect(getSelect(fixture).disabled).toBe(true);

    expect(changedValue).toBeUndefined();
  });
});

describe('HlmNativeSelect with a reactive form control', () => {
  function setup() {
    const fixture = TestBed.createComponent(FormNativeSelectHost);
    fixture.detectChanges();
    return fixture;
  }

  it('reflects touched, dirty, and invalid state from the bound form control', () => {
    const fixture = setup();
    const { control } = fixture.componentInstance;
    const select = fixture.nativeElement.querySelector('select') as HTMLSelectElement;

    control.setValue('');
    control.markAsTouched();
    control.markAsDirty();
    fixture.detectChanges();

    expect(select.getAttribute('data-touched')).toBe('true');
    expect(select.getAttribute('data-dirty')).toBe('true');
    expect(select.getAttribute('data-matches-spartan-invalid')).toBe('true');
    expect(select.getAttribute('aria-invalid')).toBe('true');
  });

  it('respects a manual ariaInvalidOverride of true and false', () => {
    const fixture = setup();
    const select = fixture.nativeElement.querySelector('select') as HTMLSelectElement;

    fixture.componentInstance.ariaInvalidOverride.set(true);
    fixture.detectChanges();
    expect(select.getAttribute('aria-invalid')).toBe('true');

    fixture.componentInstance.ariaInvalidOverride.set(false);
    fixture.detectChanges();
    expect(select.getAttribute('aria-invalid')).toBeNull();
  });
});
