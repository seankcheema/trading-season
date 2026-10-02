import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { FormControl, ReactiveFormsModule, Validators } from '@angular/forms';
import { HlmFieldImports } from '@shared/ui-components/field';
import { HlmInputImports } from '@shared/ui-components/input';

@Component({
  standalone: true,
  imports: [HlmFieldImports],
  template: `
    <fieldset hlmFieldSet>
      <legend hlmFieldLegend [variant]="legendVariant()">Legend</legend>
      <div hlmFieldGroup>
        <div hlmField [orientation]="orientation()">
          <div hlmFieldTitle>Title</div>
          <div hlmFieldContent>
            <label hlmFieldLabel>Label</label>
          </div>
          <hlm-field-description>A description</hlm-field-description>
        </div>
        <hlm-field-separator>OR</hlm-field-separator>
      </div>
    </fieldset>
  `,
})
class FieldStructureHost {
  orientation = signal<'vertical' | 'horizontal' | 'responsive'>('vertical');
  legendVariant = signal<'label' | 'legend'>('legend');
}

@Component({
  standalone: true,
  imports: [HlmFieldImports],
  template: `<hlm-field-error [validator]="validator" [forceShow]="forceShow">Error</hlm-field-error>`,
})
class StandaloneFieldErrorHost {
  validator: string | undefined = undefined;
  forceShow = false;
}

@Component({
  standalone: true,
  imports: [HlmFieldImports, HlmInputImports, ReactiveFormsModule],
  template: `
    <div hlmField>
      <input hlmInput [formControl]="control" />
      <hlm-field-error [validator]="validator" [forceShow]="forceShow">Error</hlm-field-error>
    </div>
  `,
})
class ControlledFieldErrorHost {
  control = new FormControl('', { validators: Validators.required });
  validator: string | undefined = undefined;
  forceShow = false;
}

@Component({
  standalone: true,
  imports: [HlmFieldImports, HlmInputImports, ReactiveFormsModule],
  template: `
    <div hlmField>
      <input hlmInput [formControl]="control" />
      <hlm-field-description>Description</hlm-field-description>
    </div>
  `,
})
class ControlledFieldDescriptionHost {
  control = new FormControl('');
}

@Component({
  standalone: true,
  imports: [HlmFieldImports, HlmInputImports, ReactiveFormsModule],
  template: `
    <div hlmField>
      <input hlmInput [formControl]="control" />
      <hlm-field-description [id]="id()">Description</hlm-field-description>
    </div>
  `,
})
class CustomIdFieldDescriptionHost {
  control = new FormControl('');
  id = signal('custom-description-id');
}

describe('Field structural directives', () => {
  function setup() {
    const fixture = TestBed.createComponent(FieldStructureHost);
    fixture.detectChanges();
    return fixture;
  }

  it('renders every structural slot with its data-slot attribute', () => {
    const fixture = setup();
    const root = fixture.nativeElement;

    expect(root.querySelector('[data-slot="field-set"]')).not.toBeNull();
    expect(root.querySelector('[data-slot="field-legend"]')).not.toBeNull();
    expect(root.querySelector('[data-slot="field-group"]')).not.toBeNull();
    expect(root.querySelector('[data-slot="field"]')).not.toBeNull();
    expect(root.querySelector('[data-slot="field-label"][hlmfieldtitle], [data-slot="field-label"]')).not.toBeNull();
    expect(root.querySelector('[data-slot="field-content"]')).not.toBeNull();
    expect(root.querySelector('[data-slot="field-description"]')).not.toBeNull();
    expect(root.querySelector('[data-slot="field-separator"]')).not.toBeNull();
  });

  it('defaults the field orientation to vertical and the legend variant to legend', () => {
    const fixture = setup();
    const field = fixture.nativeElement.querySelector('[data-slot="field"]');
    const legend = fixture.nativeElement.querySelector('[data-slot="field-legend"]');

    expect(field.getAttribute('data-orientation')).toBe('vertical');
    expect(legend.getAttribute('data-variant')).toBe('legend');
    expect(legend.className).toContain('text-base');
  });

  it('applies the horizontal orientation and label legend variant classes', () => {
    const fixture = setup();
    fixture.componentInstance.orientation.set('horizontal');
    fixture.componentInstance.legendVariant.set('label');
    fixture.detectChanges();
    const field = fixture.nativeElement.querySelector('[data-slot="field"]');
    const legend = fixture.nativeElement.querySelector('[data-slot="field-legend"]');

    expect(field.getAttribute('data-orientation')).toBe('horizontal');
    expect(field.className).toContain('flex-row');
    expect(legend.getAttribute('data-variant')).toBe('label');
    expect(legend.className).toContain('text-sm');
  });

  it('applies the responsive orientation classes', () => {
    const fixture = setup();
    fixture.componentInstance.orientation.set('responsive');
    fixture.detectChanges();
    const field = fixture.nativeElement.querySelector('[data-slot="field"]');

    expect(field.getAttribute('data-orientation')).toBe('responsive');
  });

  it('renders the field separator with its decorative hlm-separator and content', () => {
    const fixture = setup();
    const separator = fixture.nativeElement.querySelector('[data-slot="field-separator"]');

    expect(separator).not.toBeNull();
    expect(separator.querySelector('[data-slot="separator"]')).not.toBeNull();
    expect(separator.querySelector('[data-slot="field-separator-content"]').textContent).toContain(
      'OR',
    );
  });
});

describe('HlmFieldError without a parent field', () => {
  it('is always visible regardless of forceShow or validator', () => {
    const fixture = TestBed.createComponent(StandaloneFieldErrorHost);
    fixture.detectChanges();
    const error = fixture.nativeElement.querySelector('[data-slot="field-error"]');

    expect(error.hidden).toBe(false);
    expect(error.getAttribute('role')).toBe('alert');
  });
});

describe('HlmFieldError with a parent field and bound control', () => {
  function setup() {
    const fixture = TestBed.createComponent(ControlledFieldErrorHost);
    fixture.detectChanges();
    return fixture;
  }

  function getError(fixture: ReturnType<typeof setup>) {
    return fixture.nativeElement.querySelector('[data-slot="field-error"]') as HTMLElement;
  }

  it('is hidden when the control is valid', () => {
    const fixture = setup();
    fixture.componentInstance.control.setValue('something');
    fixture.componentInstance.control.markAsTouched();
    fixture.detectChanges();

    expect(getError(fixture).hidden).toBe(true);
  });

  it('is hidden when the control is invalid but not yet touched', () => {
    const fixture = setup();
    fixture.detectChanges();

    expect(fixture.componentInstance.control.invalid).toBe(true);
    expect(getError(fixture).hidden).toBe(true);
  });

  it('is visible once the control is invalid and touched, matching any error', () => {
    const fixture = setup();
    fixture.componentInstance.control.markAsTouched();
    fixture.detectChanges();

    expect(getError(fixture).hidden).toBe(false);
  });

  it('is visible when a specific validator key matches the control errors', () => {
    const fixture = setup();
    fixture.componentInstance.validator = 'required';
    fixture.componentInstance.control.markAsTouched();
    fixture.detectChanges();

    expect(getError(fixture).hidden).toBe(false);
  });

  it('is hidden when the specific validator key does not match the control errors', () => {
    const fixture = setup();
    fixture.componentInstance.validator = 'email';
    fixture.componentInstance.control.markAsTouched();
    fixture.detectChanges();

    expect(getError(fixture).hidden).toBe(true);
  });

  it('is visible when forceShow is set even if the control is valid', () => {
    const fixture = setup();
    fixture.componentInstance.control.setValue('something');
    fixture.componentInstance.forceShow = true;
    fixture.detectChanges();

    expect(getError(fixture).hidden).toBe(false);
  });

  it('unregisters from the a11y service when destroyed after becoming visible', () => {
    const fixture = setup();
    fixture.componentInstance.control.markAsTouched();
    fixture.detectChanges();

    expect(() => fixture.destroy()).not.toThrow();
  });

  it('tears down cleanly when destroyed before any error is ever registered', () => {
    const fixture = setup();

    expect(() => fixture.destroy()).not.toThrow();
  });
});

describe('HlmFieldDescription with a parent field', () => {
  function setup() {
    const fixture = TestBed.createComponent(ControlledFieldDescriptionHost);
    fixture.detectChanges();
    return fixture;
  }

  it('auto-generates a unique id when none is provided', () => {
    const fixture = setup();
    const description = fixture.nativeElement.querySelector('[data-slot="field-description"]');

    expect(description.id).toMatch(/^hlm-field-description-/);
  });

  it('uses a custom id and re-registers it when changed', () => {
    const fixture = TestBed.createComponent(CustomIdFieldDescriptionHost);
    fixture.detectChanges();
    const description = fixture.nativeElement.querySelector('[data-slot="field-description"]');

    expect(description.id).toBe('custom-description-id');

    fixture.componentInstance.id.set('another-id');
    fixture.detectChanges();

    expect(description.id).toBe('another-id');
  });

  it('tears down cleanly when destroyed', () => {
    const fixture = setup();
    fixture.detectChanges();

    expect(() => fixture.destroy()).not.toThrow();
  });
});
