import { HttpErrorResponse } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, Router, convertToParamMap, provideRouter } from '@angular/router';
import { Subject, of, throwError } from 'rxjs';
import { AUTH_ERROR_MESSAGES } from '../core/auth/auth-error';
import { AuthService } from '../core/auth/auth.service';
import { LoginComponent } from './login.component';

describe('LoginComponent', () => {
  let authService: { login: ReturnType<typeof vi.fn> };

  beforeEach(async () => {
    localStorage.clear();
    authService = { login: vi.fn() };

    await TestBed.configureTestingModule({
      imports: [LoginComponent],
      providers: [provideRouter([]), { provide: AuthService, useValue: authService }],
    }).compileComponents();
  });

  afterEach(() => {
    vi.useRealTimers();
    localStorage.clear();
  });

  function fillAndSubmit() {
    const fixture = TestBed.createComponent(LoginComponent);
    const component = fixture.componentInstance;
    component['form'].setValue({ email: 'jane@example.com', password: 'secret-pass1!' });
    component['onSubmit']();
    fixture.detectChanges();
    return fixture;
  }

  it('should create the login component', () => {
    const fixture = TestBed.createComponent(LoginComponent);
    const component = fixture.componentInstance;
    expect(component).toBeTruthy();
  });

  it('should have showPassword signal set to false initially', () => {
    const fixture = TestBed.createComponent(LoginComponent);
    const component = fixture.componentInstance;
    expect(component['showPassword']()).toBe(false);
  });

  it('should have submitted signal set to false initially', () => {
    const fixture = TestBed.createComponent(LoginComponent);
    const component = fixture.componentInstance;
    expect(component['submitted']()).toBe(false);
  });

  it('should not call the auth service when the form is invalid', () => {
    const fixture = TestBed.createComponent(LoginComponent);
    fixture.componentInstance['onSubmit']();
    expect(authService.login).not.toHaveBeenCalled();
  });

  it('should send only email and password and navigate to the dashboard on success', () => {
    authService.login.mockReturnValue(of(undefined));
    const navigate = vi.spyOn(TestBed.inject(Router), 'navigateByUrl').mockResolvedValue(true);

    fillAndSubmit();

    expect(authService.login).toHaveBeenCalledWith('jane@example.com', 'secret-pass1!');
    expect(navigate).toHaveBeenCalledWith('/dashboard');
  });

  it('should show an error message when the credentials are rejected', () => {
    authService.login.mockReturnValue(
      throwError(() => new HttpErrorResponse({ status: 401, error: { message: 'Invalid credentials' } })),
    );
    const navigate = vi.spyOn(TestBed.inject(Router), 'navigateByUrl');

    const fixture = fillAndSubmit();

    const alert = fixture.nativeElement.querySelector('[role="alert"]') as HTMLElement;
    expect(alert.textContent).toContain(AUTH_ERROR_MESSAGES.invalidCredentials);
    expect(fixture.componentInstance['loading']()).toBe(false);
    expect(navigate).not.toHaveBeenCalled();
  });

  it('should clear the error message when the user edits the form', () => {
    authService.login.mockReturnValue(throwError(() => new HttpErrorResponse({ status: 401 })));
    const fixture = fillAndSubmit();

    fixture.componentInstance['form'].controls.password.setValue('another-try1!');

    expect(fixture.componentInstance['errorMessage']()).toBeNull();
  });

  it('should submit through the form and show validation feedback when empty', () => {
    const fixture = TestBed.createComponent(LoginComponent);
    fixture.detectChanges();

    (fixture.nativeElement.querySelector('form') as HTMLFormElement).dispatchEvent(
      new Event('submit'),
    );
    fixture.detectChanges();

    expect(authService.login).not.toHaveBeenCalled();
    expect(fixture.nativeElement.textContent).toContain('Enter a valid email address.');
    expect(fixture.nativeElement.textContent).toContain('Password is required.');
  });

  it('should ignore a second submission while the first is in flight', () => {
    authService.login.mockReturnValue(new Subject<void>());
    const fixture = fillAndSubmit();

    fixture.componentInstance['onSubmit']();

    expect(authService.login).toHaveBeenCalledOnce();
    expect(fixture.componentInstance['loading']()).toBe(true);
  });

  it('should reveal and re-mask the password from the toggle button', () => {
    const fixture = TestBed.createComponent(LoginComponent);
    fixture.detectChanges();
    const password = fixture.nativeElement.querySelector('#password') as HTMLInputElement;
    const toggle = () =>
      fixture.nativeElement.querySelector('button[aria-label$="password"]') as HTMLButtonElement;

    expect(toggle().getAttribute('aria-label')).toBe('Show password');
    toggle().click();
    fixture.detectChanges();
    expect(password.type).toBe('text');
    expect(toggle().getAttribute('aria-label')).toBe('Hide password');

    toggle().click();
    fixture.detectChanges();
    expect(password.type).toBe('password');
  });

  describe('after repeated rejected sign-ins', () => {
    const rejected = () => throwError(() => new HttpErrorResponse({ status: 401 }));

    function submitTimes(times: number) {
      const fixture = TestBed.createComponent(LoginComponent);
      const component = fixture.componentInstance;
      component['form'].setValue({ email: 'jane@example.com', password: 'wrong-pass1!' });
      for (let i = 0; i < times; i++) {
        component['onSubmit']();
      }
      fixture.detectChanges();
      return fixture;
    }

    function submitButton(fixture: ReturnType<typeof submitTimes>) {
      return fixture.nativeElement.querySelector('button[type="submit"]') as HTMLButtonElement;
    }

    beforeEach(() => {
      vi.useFakeTimers();
      authService.login.mockImplementation(rejected);
    });

    it('still allows a third attempt after two', () => {
      const fixture = submitTimes(2);

      expect(fixture.componentInstance['locked']()).toBe(false);
      expect(submitButton(fixture).disabled).toBe(false);
      expect(fixture.nativeElement.querySelector('[role="alert"]').textContent).toContain(
        AUTH_ERROR_MESSAGES.invalidCredentials,
      );
    });

    it('locks the form for 10 minutes on the third', () => {
      const fixture = submitTimes(3);

      const alert = fixture.nativeElement.querySelector('[role="alert"]') as HTMLElement;
      expect(alert.textContent).toContain('Too many failed sign-in attempts');
      expect(alert.textContent).toContain('locked for 10 minutes');
      expect(submitButton(fixture).disabled).toBe(true);
      expect(submitButton(fixture).textContent).toContain('Try again in 10:00');
    });

    it('sends no further sign-in requests while locked', () => {
      const fixture = submitTimes(3);

      fixture.componentInstance['onSubmit']();

      expect(authService.login).toHaveBeenCalledTimes(3);
    });

    it('counts down and reopens the form after 10 minutes', () => {
      const fixture = submitTimes(3);

      vi.advanceTimersByTime(90_000);
      fixture.detectChanges();
      expect(submitButton(fixture).textContent).toContain('Try again in 8:30');

      vi.advanceTimersByTime(510_000);
      fixture.detectChanges();
      expect(submitButton(fixture).disabled).toBe(false);
      expect(submitButton(fixture).textContent).toContain('Sign in');
      expect(fixture.nativeElement.querySelector('[role="alert"]')).toBeNull();

      authService.login.mockReturnValue(of(undefined));
      vi.spyOn(TestBed.inject(Router), 'navigateByUrl').mockResolvedValue(true);
      fixture.componentInstance['onSubmit']();
      expect(authService.login).toHaveBeenCalledTimes(4);
    });

    it('does not count outages or network errors', () => {
      authService.login.mockImplementation(() =>
        throwError(() => new HttpErrorResponse({ status: 503 })),
      );

      const fixture = submitTimes(3);

      expect(fixture.componentInstance['locked']()).toBe(false);
      expect(fixture.nativeElement.querySelector('[role="alert"]').textContent).toContain(
        AUTH_ERROR_MESSAGES.unavailable,
      );
    });

    it('starts the count again after a successful sign-in', () => {
      vi.spyOn(TestBed.inject(Router), 'navigateByUrl').mockResolvedValue(true);
      submitTimes(2);
      authService.login.mockReturnValueOnce(of(undefined));
      submitTimes(1);

      const fixture = submitTimes(2);

      expect(fixture.componentInstance['locked']()).toBe(false);
    });
  });

  describe('after an inactivity sign-out', () => {
    function renderWithQuery(params: Record<string, string>) {
      TestBed.overrideProvider(ActivatedRoute, {
        useValue: { snapshot: { queryParamMap: convertToParamMap(params) } },
      });
      const fixture = TestBed.createComponent(LoginComponent);
      fixture.detectChanges();
      return fixture.nativeElement.querySelector('[role="status"]') as HTMLElement | null;
    }

    it('explains why the user was signed out', () => {
      expect(renderWithQuery({ reason: 'inactive' })?.textContent).toContain(
        'signed out after a period of inactivity',
      );
    });

    it('shows no notice on an ordinary visit', () => {
      expect(renderWithQuery({})).toBeNull();
    });
  });
});
