import { HttpErrorResponse } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { Subject } from 'rxjs';
import { ACCOUNT_ERROR_MESSAGES } from '../accounts/account-error';
import { AccountStore } from '../accounts/account-store.service';
import { TERMS_SECTIONS, TERMS_VERSION } from './terms-content';
import { TermsDialogComponent } from './terms-dialog.component';

describe('TermsDialogComponent', () => {
  let response: Subject<void>;
  let acceptTerms: ReturnType<typeof vi.fn>;

  beforeEach(async () => {
    response = new Subject<void>();
    acceptTerms = vi.fn(() => response);
    await TestBed.configureTestingModule({
      imports: [TermsDialogComponent],
      providers: [{ provide: AccountStore, useValue: { acceptTerms } }],
    }).compileComponents();
  });

  function render(signatureName = 'Ada Lovelace') {
    const fixture = TestBed.createComponent(TermsDialogComponent);
    fixture.componentRef.setInput('signatureName', signatureName);
    const accepted = vi.fn();
    const declined = vi.fn();
    fixture.componentInstance.accepted.subscribe(accepted);
    fixture.componentInstance.declined.subscribe(declined);
    fixture.detectChanges();
    const element = fixture.nativeElement as HTMLElement;
    const signature = element.querySelector('#termsSignature') as HTMLInputElement;
    const accept = element.querySelector('button[type="submit"]') as HTMLButtonElement;
    const signOut = element.querySelector('button[type="button"]') as HTMLButtonElement;
    const type = (value: string) => {
      signature.value = value;
      signature.dispatchEvent(new Event('input'));
      fixture.detectChanges();
    };
    const send = () => {
      accept.click();
      fixture.detectChanges();
    };
    return { fixture, element, signature, accept, signOut, accepted, declined, type, send };
  }

  describe('reading', () => {
    it('shows every section of the terms and the version being accepted', () => {
      const { element } = render();

      const text = element.querySelector('[role="region"]')!.textContent!;
      for (const section of TERMS_SECTIONS) {
        expect(text).toContain(section.title);
        for (const paragraph of section.paragraphs) {
          expect(text).toContain(paragraph);
        }
      }
      expect(element.querySelector('[data-testid="terms-version"]')?.textContent).toContain(
        TERMS_VERSION,
      );
    });

    it('lets a keyboard user scroll the terms', () => {
      const { element } = render();

      const region = element.querySelector('[role="region"]')!;
      expect(region.getAttribute('tabindex')).toBe('0');
      expect(region.getAttribute('aria-label')).toBe('Terms and Conditions text');
    });

    it('cannot be dismissed without an answer', () => {
      const { element, accepted, declined } = render();

      expect(element.querySelector('button[aria-label="Close dialog"]')).toBeNull();
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
      (element.querySelector('.dashboard-dialog-backdrop') as HTMLElement).click();

      expect(accepted).not.toHaveBeenCalled();
      expect(declined).not.toHaveBeenCalled();
    });
  });

  describe('signing', () => {
    it('tells the user which name to type', async () => {
      const { fixture, element, signature } = render('Ada Lovelace');
      await fixture.whenStable();
      fixture.detectChanges();

      expect(signature.getAttribute('aria-describedby')).toContain('termsSignatureHint');
      expect(element.querySelector('#termsSignatureHint')?.textContent).toContain('Ada Lovelace');
      expect(element.querySelector('label[for="termsSignature"]')?.textContent?.trim()).toBe(
        'Type your full name to sign',
      );
    });

    it('keeps Accept disabled until the typed name matches', () => {
      const { accept, type } = render('Ada Lovelace');

      expect(accept.disabled).toBe(true);

      type('Ada');
      expect(accept.disabled).toBe(true);

      type('Ada Lovelace');
      expect(accept.disabled).toBe(false);
    });

    it('ignores capitalisation and extra spaces in the typed name', () => {
      const { accept, type } = render('Ada Lovelace');

      type('  ada   LOVELACE ');

      expect(accept.disabled).toBe(false);
    });

    it('accepts any name when the profile has none to match', () => {
      const { accept, type } = render('   ');

      type('  ');
      expect(accept.disabled).toBe(true);

      type('Ada');
      expect(accept.disabled).toBe(false);
    });

    it('sends nothing when the form is submitted without a matching name', () => {
      const { element, type } = render('Ada Lovelace');

      type('Someone Else');
      element.querySelector('form')!.dispatchEvent(new Event('submit'));

      expect(acceptTerms).not.toHaveBeenCalled();
    });
  });

  describe('accepting', () => {
    it('records acceptance of the version shown, then reports it', () => {
      const { accept, accepted, type, send } = render('Ada Lovelace');
      type('Ada Lovelace');

      send();

      expect(acceptTerms).toHaveBeenCalledExactlyOnceWith(TERMS_VERSION);
      expect(accept.disabled).toBe(true);
      expect(accept.textContent?.trim()).toBe('Saving…');
      expect(accepted).not.toHaveBeenCalled();

      response.next();
      response.complete();

      expect(accepted).toHaveBeenCalledTimes(1);
    });

    it('does not send a second request while the first is in flight', () => {
      const { element, type, send } = render('Ada Lovelace');
      type('Ada Lovelace');
      send();

      element.querySelector('form')!.dispatchEvent(new Event('submit'));

      expect(acceptTerms).toHaveBeenCalledTimes(1);
    });

    it('says the terms have changed when the backend refuses the version', () => {
      const { fixture, element, accept, accepted, type, send } = render('Ada Lovelace');
      type('Ada Lovelace');
      send();

      response.error(new HttpErrorResponse({ status: 409 }));
      fixture.detectChanges();

      expect(element.querySelector('[role="alert"]')?.textContent?.trim()).toBe(
        ACCOUNT_ERROR_MESSAGES.termsChanged,
      );
      expect(accepted).not.toHaveBeenCalled();
      expect(accept.disabled).toBe(false);
    });

    it('lets the user try again after a failure and clears the earlier message', () => {
      const { fixture, element, type, send } = render('Ada Lovelace');
      type('Ada Lovelace');
      send();
      response.error(new HttpErrorResponse({ status: 0 }));
      fixture.detectChanges();
      expect(element.querySelector('[role="alert"]')?.textContent?.trim()).toBe(
        ACCOUNT_ERROR_MESSAGES.network,
      );

      response = new Subject<void>();
      send();

      expect(acceptTerms).toHaveBeenCalledTimes(2);
      expect(element.querySelector('[role="alert"]')).toBeNull();
    });
  });

  describe('declining', () => {
    it('reports that the user chose to sign out, without recording anything', () => {
      const { signOut, accepted, declined } = render();

      expect(signOut.textContent?.trim()).toBe('Sign out');
      signOut.click();

      expect(declined).toHaveBeenCalledTimes(1);
      expect(accepted).not.toHaveBeenCalled();
      expect(acceptTerms).not.toHaveBeenCalled();
    });
  });
});
