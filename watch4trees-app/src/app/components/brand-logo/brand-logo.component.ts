import { Component, Input, Output, EventEmitter, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { AuthService } from '../../services/auth.service';
import { TranslatePipe } from '../../pipes/translate.pipe';

@Component({
  selector: 'app-brand-logo',
  standalone: true,
  imports: [CommonModule, TranslatePipe],
  templateUrl: './brand-logo.component.html'
})
export class BrandLogoComponent {
  private router = inject(Router);
  private auth = inject(AuthService);

  @Input() subtitle: string | null = null;
  @Input() showSubtitle: boolean = true;
  @Input() size: 'sm' | 'md' | 'lg' = 'md';
  @Input() clickable: boolean = true;
  @Input() routeTarget: string | null = null;
  @Output() clicked = new EventEmitter<void>();

  onClick() {
    if (!this.clickable) return;
    this.clicked.emit();
    if (this.routeTarget !== null) {
      this.router.navigate([this.routeTarget]);
    } else {
      const target = this.auth.isAuthenticated() ? '/dashboard' : '/';
      this.router.navigate([target]);
    }
  }
}
