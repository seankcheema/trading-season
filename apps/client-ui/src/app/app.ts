import { HlmToaster } from '@shared/ui-components/toast';
import { ToastService } from './notifications/toast.service';
import { Component, inject, signal } from '@angular/core';
import { RouterOutlet } from '@angular/router';

@Component({
  imports: [RouterOutlet, HlmToaster],
  selector: 'app-root',
  styleUrl: './app.css',
  templateUrl: './app.html',
})
export class App {
  protected readonly toasts = inject(ToastService);
  protected readonly title = signal('trading-season-app');
}
