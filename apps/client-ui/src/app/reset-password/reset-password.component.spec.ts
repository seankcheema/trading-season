import { HttpErrorResponse } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, Router, convertToParamMap, provideRouter } from '@angular/router';
import { Subject, of, throwError } from 'rxjs';
import { AUTH_ERROR_MESSAGES } from '../core/auth/auth-error';
import { AuthService } from '../core/auth/auth.service';
import { ResetPasswordComponent } from './reset-password.component';

describe('ResetPasswordComponent', () => {
  let authService: { resetPassword: ReturnType<typeof vi.fn> };

  function configure(queryParams: Record<string, string>) {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      imports: [ResetPasswordComponent],
      providers: [
        provideRouter([]),
        { provide: AuthService, useValue: authService },
        {
          provide: ActivatedRoute,
          useValue: { snapshot: { queryParamMap: convertToParamMap(queryParams) } },
        },
      ],
    });
  }

  beforeEach(() => {
    authService = { resetPassword: vi.fn() };
    configure({ token: 'the-reset-token' });
  });

  function fillAndSubmit(password = 'new-secret1!', confirmPassword = password) {
    const fixture = TestBed.createComponent(ResetPasswordComponent);
    fixture.componentInstance['form'].setValue({ password, confirmPassword });
    fixture.componentInstance['onSubmit']();
    fixture.detectChanges();
    return fixture;
  }

  it('should create the component', () => {
    expect(TestBed.createComponent(ResetPasswordComponent).componentInstance).toBeTruthy();
  });

  it('should submit the token from the link with the new password', () => {
    authService.resetPassword.mockReturnValue(of(undefined));
    vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);

    fillAndSubmit();

    expect(authService.resetPassword).toHaveBeenCalledWith('the-reset-token', 'new-secret1!');
  });

  it('should send the user to sign in with a confirmation once the password is set', () => {
    // The reset ends every session, so there is nothing to sign the user into here.
    authService.resetPassword.mockReturnValue(of(undefined));
    const navigate = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);

    fillAndSubmit();

    expect(navigate).toHaveBeenCalledWith(['/login'], {
      queryParams: { reason: 'password-reset' },
    });
  });

  it('should offer a fresh request when the link carries no token', () => {
    configure({});

    const fixture = TestBed.createComponent(ResetPasswordComponent);
    fixture.detectChanges();

    expect(fixture.componentInstance['hasToken']).toBe(false);
    expect(fixture.nativeElement.querySelector('form')).toBeNull();
    expect(
      (fixture.nativeElement.querySelector('a[href="/forgot-password"]') as HTMLAnchorElement)
        .textContent,
    ).toContain('request a new one');
  });

  it('should refuse to submit when the passwords do not match', () => {
    const fixture = fillAndSubmit('new-secret1!', 'new-secret2!');

    expect(authService.resetPassword).not.toHaveBeenCalled();
    expect(fixture.nativeElement.textContent).toContain('Passwords do not match.');
  });

  it('should refuse a password that misses the strength rules', () => {
    // The same rules the registration form applies, so a password accepted here could
    // have been chosen at sign-up.
    fillAndSubmit('short');
    fillAndSubmit('nodigitsorsymbols');
    fillAndSubmit('no-digits-here!');
    fillAndSubmit('nosymbols1234');

    expect(authService.resetPassword).not.toHaveBeenCalled();
  });

  it('should tick off each rule as the password satisfies it', () => {
    const fixture = TestBed.createComponent(ResetPasswordComponent);
    const component = fixture.componentInstance;
    fixture.detectChanges();

    expect(component['hasMinLength']()).toBe(false);
    expect(component['hasNumber']()).toBe(false);
    expect(component['hasSpecialCharacter']()).toBe(false);

    component['form'].controls.password.setValue('new-secret1!');

    expect(component['hasMinLength']()).toBe(true);
    expect(component['hasNumber']()).toBe(true);
    expect(component['hasSpecialCharacter']()).toBe(true);
  });

  it('should report a rejected link with a way to request another', () => {
    authService.resetPassword.mockReturnValue(
      throwError(
        () =>
          new HttpErrorResponse({
            status: 400,
            error: { message: 'This password reset link is invalid or has expired' },
          }),
      ),
    );
    const navigate = vi.spyOn(TestBed.inject(Router), 'navigate');

    const fixture = fillAndSubmit();

    const alert = fixture.nativeElement.querySelector('[role="alert"]') as HTMLElement;
    expect(alert.textContent).toContain('This password reset link is invalid or has expired');
    expect(alert.querySelector('a[href="/forgot-password"]')).not.toBeNull();
    expect(navigate).not.toHaveBeenCalled();
  });

  it('should report an unavailable service without losing the form', () => {
    authService.resetPassword.mockReturnValue(
      throwError(() => new HttpErrorResponse({ status: 503 })),
    );

    const fixture = fillAndSubmit();

    expect(fixture.nativeElement.querySelector('[role="alert"]').textContent).toContain(
      AUTH_ERROR_MESSAGES.unavailable,
    );
    expect(fixture.nativeElement.querySelector('form')).not.toBeNull();
    expect(fixture.componentInstance['loading']()).toBe(false);
  });

  it('should clear the error message when the user edits the form', () => {
    authService.resetPassword.mockReturnValue(
      throwError(() => new HttpErrorResponse({ status: 503 })),
    );
    const fixture = fillAndSubmit();

    fixture.componentInstance['form'].controls.password.setValue('another-secret1!');

    expect(fixture.componentInstance['errorMessage']()).toBeNull();
  });

  it('should ignore a second submission while the first is in flight', () => {
    authService.resetPassword.mockReturnValue(new Subject<void>());
    const fixture = fillAndSubmit();

    fixture.componentInstance['onSubmit']();

    expect(authService.resetPassword).toHaveBeenCalledOnce();
    expect(fixture.componentInstance['loading']()).toBe(true);
  });

  it('should reveal and re-mask both password fields from their toggles', () => {
    const fixture = TestBed.createComponent(ResetPasswordComponent);
    fixture.detectChanges();

    const password = fixture.nativeElement.querySelector('#password') as HTMLInputElement;
    const confirmPassword = fixture.nativeElement.querySelector(
      '#confirmPassword',
    ) as HTMLInputElement;
    const toggle = (label: string) =>
      fixture.nativeElement.querySelector(`button[aria-label="${label}"]`) as HTMLButtonElement;

    toggle('Show password').click();
    toggle('Show confirmation password').click();
    fixture.detectChanges();

    expect(password.type).toBe('text');
    expect(confirmPassword.type).toBe('text');

    toggle('Hide password').click();
    fixture.detectChanges();
    expect(password.type).toBe('password');
  });
});
