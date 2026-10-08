import { HttpErrorResponse } from '@angular/common/http';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, Router, convertToParamMap, provideRouter } from '@angular/router';
import { Subject, of, throwError } from 'rxjs';
import { AuthService } from '../core/auth/auth.service';
import { NO_ACCESS_MESSAGE, ReportingAccessError } from '../core/auth/reporting-access';
import { LOGIN_ERROR_MESSAGES, LoginComponent, toLoginErrorMessage } from './login.component';

describe('toLoginErrorMessage', () => {
  it.each([
    [new HttpErrorResponse({ status: 0 }), LOGIN_ERROR_MESSAGES.network],
    [new HttpErrorResponse({ status: 503 }), LOGIN_ERROR_MESSAGES.unavailable],
    [new HttpErrorResponse({ status: 401 }), LOGIN_ERROR_MESSAGES.invalidCredentials],
    [new HttpErrorResponse({ status: 400 }), LOGIN_ERROR_MESSAGES.failed],
    [new ReportingAccessError(), NO_ACCESS_MESSAGE],
    [new Error('boom'), LOGIN_ERROR_MESSAGES.failed],
  ])('maps a failed sign-in to a message', (error, message) => {
    expect(toLoginErrorMessage(error)).toBe(message);
  });
});

describe('LoginComponent', () => {
  let fixture: ComponentFixture<LoginComponent>;
  let root: HTMLElement;
  let login: ReturnType<typeof vi.fn>;
  let navigateByUrl: ReturnType<typeof vi.spyOn>;

  // reason is the query parameter a guard or the interceptor adds when it turns an account away.
  const render = (reason: string | null = null) => {
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        { provide: AuthService, useValue: { login } },
        {
          provide: ActivatedRoute,
          useValue: { snapshot: { queryParamMap: convertToParamMap(reason ? { reason } : {}) } },
        },
      ],
    });
    navigateByUrl = vi.spyOn(TestBed.inject(Router), 'navigateByUrl').mockResolvedValue(true);
    fixture = TestBed.createComponent(LoginComponent);
    fixture.detectChanges();
    root = fixture.nativeElement;
  };

  beforeEach(() => {
    login = vi.fn(() => of(undefined));
  });

  const input = (id: string) => root.querySelector<HTMLInputElement>(`#${id}`)!;
  const type = (id: string, value: string) => {
    input(id).value = value;
    input(id).dispatchEvent(new Event('input'));
  };
  const submit = () => {
    root.querySelector('form')!.dispatchEvent(new Event('submit'));
    fixture.detectChanges();
  };
  const fill = () => {
    type('email', 'ada@example.com');
    type('password', 'secret-pass');
  };

  it('asks for a valid email and a password before signing in', () => {
    render();
    type('email', 'not-an-email');
    submit();

    expect(login).not.toHaveBeenCalled();
    expect(root.textContent).toContain('Enter a valid email address.');
    expect(root.textContent).toContain('Password is required.');
    expect(input('email').getAttribute('aria-invalid')).toBe('true');
    expect(input('email').getAttribute('aria-describedby')).toBe('email-error');
    expect(input('password').getAttribute('aria-describedby')).toBe('password-error');
  });

  it('signs in and opens the reporting screens', () => {
    render();
    fill();
    submit();

    expect(login).toHaveBeenCalledWith('ada@example.com', 'secret-pass');
    expect(navigateByUrl).toHaveBeenCalledWith('/');
  });

  it('shows why a sign-in failed and clears the message on the next edit', () => {
    render();
    login.mockReturnValue(throwError(() => new HttpErrorResponse({ status: 401 })));
    fill();
    submit();

    expect(root.querySelector('[role="alert"]')!.textContent).toContain(
      LOGIN_ERROR_MESSAGES.invalidCredentials,
    );
    expect(navigateByUrl).not.toHaveBeenCalled();

    type('password', 'another-pass');
    fixture.detectChanges();
    expect(root.querySelector('[role="alert"]')).toBeNull();
  });

  it('disables the button while a sign-in is in flight and ignores a second submit', () => {
    render();
    const pending = new Subject<void>();
    login.mockReturnValue(pending);
    fill();
    submit();

    const button = root.querySelector<HTMLButtonElement>('button[type="submit"]')!;
    expect(button.disabled).toBe(true);
    expect(button.textContent).toContain('Signing in...');

    submit();
    expect(login).toHaveBeenCalledTimes(1);

    pending.next();
    fixture.detectChanges();
    expect(button.textContent).toContain('Sign in');
  });

  it('tells an account that is not an analyst that it has no access', () => {
    render();
    login.mockReturnValue(throwError(() => new ReportingAccessError()));
    fill();
    submit();

    expect(root.querySelector('[role="alert"]')!.textContent).toContain(NO_ACCESS_MESSAGE);
    expect(navigateByUrl).not.toHaveBeenCalled();
  });

  it('explains why a signed-in account was sent back here', () => {
    render('role');
    expect(root.querySelector('[role="status"]')!.textContent).toContain(NO_ACCESS_MESSAGE);

    // A failed attempt replaces the notice rather than stacking under it.
    login.mockReturnValue(throwError(() => new HttpErrorResponse({ status: 401 })));
    fill();
    submit();
    expect(root.querySelector('[role="status"]')).toBeNull();
    expect(root.querySelector('[role="alert"]')).not.toBeNull();
  });

  it('shows no notice on a plain visit or for an unrelated reason', () => {
    render('inactive');
    expect(root.querySelector('[role="status"]')).toBeNull();
    expect(root.textContent).toContain('Reporting is open to analyst accounts only.');
  });

  it('reveals and hides the password', () => {
    render();
    const toggle = root.querySelector<HTMLButtonElement>('button[aria-label="Show password"]')!;
    expect(input('password').type).toBe('password');

    toggle.click();
    fixture.detectChanges();

    expect(input('password').type).toBe('text');
    expect(toggle.getAttribute('aria-label')).toBe('Hide password');
  });
});
