import { inject } from '@angular/core';
import { CanActivateFn, RedirectCommand, Router } from '@angular/router';

// The selected account never goes in the URL, where it would reach browser history, logs and
// shared links; AccountStore keeps it for the tab instead. Links and bookmarks made before
// that still carry ?accountId=, so the parameter is dropped, in place, before the page opens.
export const dropAccountIdGuard: CanActivateFn = (route, state) => {
  if (!route.queryParamMap.has('accountId')) {
    return true;
  }
  const router = inject(Router);
  const url = router.parseUrl(state.url);
  delete url.queryParams['accountId'];
  return new RedirectCommand(url, { replaceUrl: true });
};
