import { HttpErrorResponse } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { of, throwError } from 'rxjs';
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
});
