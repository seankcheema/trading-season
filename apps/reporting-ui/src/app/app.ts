import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { focusPageOnNavigation } from './core/a11y/route-focus';

@Component({
  imports: [RouterOutlet],
  selector: 'app-root',
  template: '<router-outlet />',
})
export class App {
  constructor() {
    focusPageOnNavigation();
  }
}
