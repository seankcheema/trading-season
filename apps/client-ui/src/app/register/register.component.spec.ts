import { HttpErrorResponse } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { Subject, of, throwError } from 'rxjs';
import { AUTH_ERROR_MESSAGES, RegistrationStepError } from '../core/auth/auth-error';
import { AuthService } from '../core/auth/auth.service';
import { RegisterComponent } from './register.component';

const VALID_FORM = {
  firstName: 'Jane',
  middleName: '',
  lastName: 'Doe',
  email: 'jane@example.com',
  dateOfBirth: '1990-01-01',
  ssn: '123-45-6789',
  address: '123 Main St, Springfield',
  traderLevel: 'BEGINNER',
  availableFunds: 5000,
  password: 'secret-pass1!',
  confirmPassword: 'secret-pass1!',
};

describe('RegisterComponent', () => {
  let authService: { register: ReturnType<typeof vi.fn> };

  beforeEach(async () => {
    authService = { register: vi.fn() };

    await TestBed.configureTestingModule({
      imports: [RegisterComponent],
      providers: [provideRouter([]), { provide: AuthService, useValue: authService }],
    }).compileComponents();
  });

  function fillAndSubmit() {
    const fixture = TestBed.createComponent(RegisterComponent);
    fixture.componentInstance['form'].setValue(VALID_FORM);
    fixture.componentInstance['onSubmit']();
    fixture.detectChanges();
    return fixture;
  }

  it('should create the register component', () => {
    const fixture = TestBed.createComponent(RegisterComponent);
    const component = fixture.componentInstance;
    expect(component).toBeTruthy();
  });

  it('should render the component without errors', () => {
    const fixture = TestBed.createComponent(RegisterComponent);
    fixture.detectChanges();
    expect(fixture.componentInstance).toBeTruthy();
  });

  it('should not have a username field', () => {
    const fixture = TestBed.createComponent(RegisterComponent);
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('#username')).toBeNull();
    expect('username' in fixture.componentInstance['form'].controls).toBe(false);
  });

  it('should register without the confirm password and navigate to the dashboard', () => {
    authService.register.mockReturnValue(of(undefined));
    const navigate = vi.spyOn(TestBed.inject(Router), 'navigateByUrl').mockResolvedValue(true);

    fillAndSubmit();

    const { confirmPassword: _confirmPassword, ...expected } = VALID_FORM;
    expect(authService.register).toHaveBeenCalledWith(expected);
    expect(navigate).toHaveBeenCalledWith('/dashboard');
  });

  it('should mask the SSN until the user asks to see it', () => {
    const fixture = TestBed.createComponent(RegisterComponent);
    fixture.detectChanges();
    const ssn = fixture.nativeElement.querySelector('#ssn') as HTMLInputElement;

    expect(ssn.type).toBe('password');

    fixture.componentInstance['toggleSsnVisibility']();
    fixture.detectChanges();

    expect(ssn.type).toBe('text');
  });

  it('should reveal only the field the user toggled', () => {
    const fixture = TestBed.createComponent(RegisterComponent);
    fixture.detectChanges();

    fixture.componentInstance['togglePasswordVisibility']();
    fixture.detectChanges();

    const query = (selector: string) =>
      (fixture.nativeElement.querySelector(selector) as HTMLInputElement).type;
    expect(query('#password')).toBe('text');
    expect(query('#confirmPassword')).toBe('password');
    expect(query('#ssn')).toBe('password');
  });

  it('should label each reveal toggle distinctly', () => {
    const fixture = TestBed.createComponent(RegisterComponent);
    fixture.detectChanges();

    const labels = [...fixture.nativeElement.querySelectorAll('button[aria-label]')].map(
      (button: HTMLElement) => button.getAttribute('aria-label'),
    );

    // Duplicated names would leave the toggles indistinguishable to screen readers.
    expect(labels).toContain('Show SSN');
    expect(labels).toContain('Show password');
    expect(labels).toContain('Show confirmation password');
    expect(new Set(labels).size).toBe(labels.length);
  });

  it('should show an error message when the email is already in use', () => {
    authService.register.mockReturnValue(
      throwError(
        () => new RegistrationStepError('register-profile', new HttpErrorResponse({ status: 409 })),
      ),
    );

    const fixture = fillAndSubmit();

    const alert = fixture.nativeElement.querySelector('[role="alert"]') as HTMLElement;
    expect(alert.textContent).toContain(AUTH_ERROR_MESSAGES.profileEmailTaken);
    expect(fixture.componentInstance['loading']()).toBe(false);
  });

  it('should submit through the form and block an invalid registration', () => {
    const fixture = TestBed.createComponent(RegisterComponent);
    fixture.detectChanges();

    (fixture.nativeElement.querySelector('form') as HTMLFormElement).dispatchEvent(
      new Event('submit'),
    );
    fixture.detectChanges();

    expect(authService.register).not.toHaveBeenCalled();
    expect(fixture.componentInstance['form'].touched).toBe(true);
  });

  it('should ignore a second submission while the first is in flight', () => {
    authService.register.mockReturnValue(new Subject<void>());
    const fixture = fillAndSubmit();

    fixture.componentInstance['onSubmit']();

    expect(authService.register).toHaveBeenCalledOnce();
  });

  it('should flag a confirmation password that does not match', () => {
    const fixture = TestBed.createComponent(RegisterComponent);
    const form = fixture.componentInstance['form'];

    form.setValue({ ...VALID_FORM, confirmPassword: 'something-else1!' });

    expect(form.hasError('passwordMismatch')).toBe(true);
  });

  it('should format typed SSN digits as XXX-XX-XXXX', () => {
    const fixture = TestBed.createComponent(RegisterComponent);
    fixture.detectChanges();
    const ssn = fixture.nativeElement.querySelector('#ssn') as HTMLInputElement;

    ssn.value = '12a3456789999';
    ssn.dispatchEvent(new Event('input'));

    expect(fixture.componentInstance['form'].controls.ssn.value).toBe('123-45-6789');

    ssn.value = '1234';
    ssn.dispatchEvent(new Event('input'));

    expect(fixture.componentInstance['form'].controls.ssn.value).toBe('123-4');
  });

  it('should block exponent and sign keys in available funds', () => {
    const fixture = TestBed.createComponent(RegisterComponent);
    fixture.detectChanges();
    const funds = fixture.nativeElement.querySelector('#availableFunds') as HTMLInputElement;
    const press = (key: string) => {
      const event = new KeyboardEvent('keydown', { key, cancelable: true });
      funds.dispatchEvent(event);
      return event.defaultPrevented;
    };

    expect(['e', 'E', '+', '-'].map(press)).toEqual([true, true, true, true]);
    expect(press('5')).toBe(false);
  });

  it('should toggle each reveal button from the template', () => {
    const fixture = TestBed.createComponent(RegisterComponent);
    fixture.detectChanges();
    const click = (label: string) => {
      (fixture.nativeElement.querySelector(`button[aria-label="${label}"]`) as HTMLButtonElement).click();
      fixture.detectChanges();
    };
    const type = (id: string) =>
      (fixture.nativeElement.querySelector(`#${id}`) as HTMLInputElement).type;

    click('Show SSN');
    click('Show password');
    click('Show confirmation password');

    expect([type('ssn'), type('password'), type('confirmPassword')]).toEqual([
      'text',
      'text',
      'text',
    ]);
    expect(fixture.nativeElement.querySelector('button[aria-label="Hide SSN"]')).not.toBeNull();
    expect(
      fixture.nativeElement.querySelector('button[aria-label="Hide confirmation password"]'),
    ).not.toBeNull();
  });
});
