import { HttpErrorResponse } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { Subject, of, throwError } from 'rxjs';
import { AUTH_ERROR_MESSAGES } from '../core/auth/auth-error';
import { AuthService } from '../core/auth/auth.service';
import { ForgotPasswordComponent } from './forgot-password.component';

describe('ForgotPasswordComponent', () => {
  let authService: { requestPasswordReset: ReturnType<typeof vi.fn> };

  beforeEach(async () => {
    authService = { requestPasswordReset: vi.fn() };

    await TestBed.configureTestingModule({
      imports: [ForgotPasswordComponent],
      providers: [provideRouter([]), { provide: AuthService, useValue: authService }],
    }).compileComponents();
  });

  function fillAndSubmit(email = 'jane@example.com') {
    const fixture = TestBed.createComponent(ForgotPasswordComponent);
    fixture.componentInstance['form'].setValue({ email });
    fixture.componentInstance['onSubmit']();
    fixture.detectChanges();
    return fixture;
  }

  it('should create the component', () => {
    expect(TestBed.createComponent(ForgotPasswordComponent).componentInstance).toBeTruthy();
  });

  it('should send only the email address', () => {
    authService.requestPasswordReset.mockReturnValue(of(undefined));

    fillAndSubmit();

    expect(authService.requestPasswordReset).toHaveBeenCalledWith('jane@example.com');
    expect(authService.requestPasswordReset).toHaveBeenCalledOnce();
  });

  it('should not call the service for an invalid address', () => {
    const fixture = TestBed.createComponent(ForgotPasswordComponent);
    fixture.detectChanges();

    (fixture.nativeElement.querySelector('form') as HTMLFormElement).dispatchEvent(
      new Event('submit'),
    );
    fixture.detectChanges();

    expect(authService.requestPasswordReset).not.toHaveBeenCalled();
    expect(fixture.nativeElement.textContent).toContain('Enter a valid email address.');
  });

  it('should replace the form with a confirmation once the request is accepted', () => {
    authService.requestPasswordReset.mockReturnValue(of(undefined));

    const fixture = fillAndSubmit();

    const status = fixture.nativeElement.querySelector('[role="status"]') as HTMLElement;
    expect(status.textContent).toContain('If that email has an account');
    expect(status.textContent).toContain('30 minutes');
    expect(fixture.nativeElement.querySelector('form')).toBeNull();
  });

  it('should confirm identically for an address with no account', () => {
    // The service answers the same way either way, and so must this page: a different
    // message for an unknown address would tell anyone who asks who has an account.
    authService.requestPasswordReset.mockReturnValue(of(undefined));

    const known = fillAndSubmit('jane@example.com');
    const unknown = fillAndSubmit('nobody@example.com');

    expect(unknown.nativeElement.querySelector('[role="status"]').textContent).toBe(
      known.nativeElement.querySelector('[role="status"]').textContent,
    );
  });

  it('should show an error and keep the form when the service is unavailable', () => {
    authService.requestPasswordReset.mockReturnValue(
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
    authService.requestPasswordReset.mockReturnValue(
      throwError(() => new HttpErrorResponse({ status: 503 })),
    );
    const fixture = fillAndSubmit();

    fixture.componentInstance['form'].controls.email.setValue('jane+2@example.com');

    expect(fixture.componentInstance['errorMessage']()).toBeNull();
  });

  it('should ignore a second submission while the first is in flight', () => {
    authService.requestPasswordReset.mockReturnValue(new Subject<void>());
    const fixture = fillAndSubmit();

    fixture.componentInstance['onSubmit']();

    expect(authService.requestPasswordReset).toHaveBeenCalledOnce();
    expect(fixture.componentInstance['loading']()).toBe(true);
  });

  it('should disable the submit button while the request is in flight', () => {
    authService.requestPasswordReset.mockReturnValue(new Subject<void>());

    const fixture = fillAndSubmit();

    const submit = fixture.nativeElement.querySelector('button[type="submit"]') as HTMLButtonElement;
    expect(submit.disabled).toBe(true);
    expect(submit.textContent).toContain('Sending link...');
  });

  it('should offer a way back to sign in', () => {
    const fixture = TestBed.createComponent(ForgotPasswordComponent);
    fixture.detectChanges();

    const link = fixture.nativeElement.querySelector('a[href="/login"]') as HTMLAnchorElement;
    expect(link.textContent).toContain('Back to sign in');
  });
});
