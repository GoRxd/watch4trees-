import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterOutlet } from '@angular/router';
import { AmbientGlowComponent } from './components/ambient-glow/ambient-glow.component';
import { ToastContainerComponent } from './components/toast-container/toast-container.component';
import { TranslatePipe } from './pipes/translate.pipe';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [CommonModule, RouterOutlet, AmbientGlowComponent, ToastContainerComponent, TranslatePipe],
  templateUrl: './app.component.html'
})
export class AppComponent {}
