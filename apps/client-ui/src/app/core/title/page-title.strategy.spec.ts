import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Title } from '@angular/platform-browser';
import { provideRouter, Router, TitleStrategy } from '@angular/router';
import { APP_NAME, PageTitleStrategy } from './page-title.strategy';

@Component({ template: '' })
class Screen {}

describe('PageTitleStrategy', () => {
  function setup() {
    TestBed.configureTestingModule({
      providers: [
        provideRouter([
          { path: 'one', component: Screen, title: 'One' },
          { path: 'by/:name', component: Screen, title: (route) => `${route.paramMap.get('name')} page` },
          { path: '', component: Screen },
        ]),
        { provide: TitleStrategy, useClass: PageTitleStrategy },
      ],
    });
    return { router: TestBed.inject(Router), title: TestBed.inject(Title) };
  }

  it('puts the screen first and the app name after it', async () => {
    const { router, title } = setup();
    await router.navigateByUrl('/one');
    expect(title.getTitle()).toBe(`One | ${APP_NAME}`);
  });

  it('takes a title that depends on the route parameters', async () => {
    const { router, title } = setup();
    await router.navigateByUrl('/by/AAPL');
    expect(title.getTitle()).toBe(`AAPL page | ${APP_NAME}`);
  });

  it('is the app name alone for a screen without a title of its own', async () => {
    const { router, title } = setup();
    await router.navigateByUrl('/one');
    await router.navigateByUrl('/');
    expect(title.getTitle()).toBe(APP_NAME);
  });
});
