import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { NgIcon } from '@ng-icons/core';
import { ToastService } from '../../services/toast.service';
import { TranslatePipe } from '../../pipes/translate.pipe';

@Component({
  selector: 'app-toast-container',
  standalone: true,
  imports: [CommonModule, NgIcon, TranslatePipe],
  templateUrl: './toast-container.component.html'
})
export class ToastContainerComponent {
  toastService = inject(ToastService);
}
