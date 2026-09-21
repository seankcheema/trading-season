import { HttpErrorResponse } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { of, throwError } from 'rxjs';
import { AUTH_ERROR_MESSAGES } from '../core/auth/auth-error';
import { AuthService } from '../core/auth/auth.service';
import { LoginComponent } from './login.component';

describe('LoginComponent', () => {
  let authService: { login: ReturnType<typeof vi.fn> };

  beforeEach(async () => {
    authService = { login: vi.fn() };

    await TestBed.configureTestingModule({
      imports: [LoginComponent],
      providers: [provideRouter([]), { provide: AuthService, useValue: authService }],
    }).compileComponents();
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
});
