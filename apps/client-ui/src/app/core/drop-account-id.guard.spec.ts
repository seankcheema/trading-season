import { TestBed } from '@angular/core/testing';
import {
  ActivatedRouteSnapshot,
  RedirectCommand,
  Router,
  RouterStateSnapshot,
  convertToParamMap,
} from '@angular/router';
import { dropAccountIdGuard } from './drop-account-id.guard';

describe('dropAccountIdGuard', () => {
  function check(url: string): ReturnType<typeof dropAccountIdGuard> {
    const tree = TestBed.inject(Router).parseUrl(url);
    const route = { queryParamMap: convertToParamMap(tree.queryParams) } as ActivatedRouteSnapshot;
    return TestBed.runInInjectionContext(() =>
      dropAccountIdGuard(route, { url } as RouterStateSnapshot),
    );
  }

  it('lets a URL without an account id through', () => {
    expect(check('/dashboard/markets/aapl?compare=msft')).toBe(true);
  });

  it('opens an old link without its account id, in place of the old URL', () => {
    const result = check('/dashboard/markets/aapl?accountId=2&compare=msft');

    expect(result).toBeInstanceOf(RedirectCommand);
    const redirect = result as RedirectCommand;
    expect(TestBed.inject(Router).serializeUrl(redirect.redirectTo)).toBe(
      '/dashboard/markets/aapl?compare=msft',
    );
    expect(redirect.navigationBehaviorOptions?.replaceUrl).toBe(true);
  });
});
