import { Component, input, output, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, Router } from '@angular/router';
import { NgIcon } from '@ng-icons/core';
import { AuthService } from '../../services/auth.service';
import { TranslationService } from '../../services/translation.service';
import { TranslatePipe } from '../../pipes/translate.pipe';
import { BrandLogoComponent } from '../brand-logo/brand-logo.component';
import { LangToggleComponent } from '../lang-toggle/lang-toggle.component';

@Component({
  selector: 'app-mobile-drawer',
  standalone: true,
  imports: [
    CommonModule,
    RouterModule,
    NgIcon,
    TranslatePipe,
    BrandLogoComponent,
    LangToggleComponent
  ],
  templateUrl: './mobile-drawer.component.html'
})
export class MobileDrawerComponent {
  auth = inject(AuthService);
  i18n = inject(TranslationService);
  router = inject(Router);

  // Inputs & Outputs using Angular Signals
  isOpen = input<boolean>(false);
  mode = input<'landing' | 'app'>('app');
  
  closeDrawer = output<void>();
  sectionSelected = output<string>();

  onClose() {
    this.closeDrawer.emit();
  }

  onSelectSection(sectionId: string) {
    this.sectionSelected.emit(sectionId);
    this.onClose();
  }

  goToAuth() {
    this.onClose();
    if (this.auth.isAuthenticated()) {
      this.router.navigate(['/dashboard']);
    } else {
      this.router.navigate(['/auth']);
    }
  }

  logout() {
    this.onClose();
    this.auth.logout();
  }
}
