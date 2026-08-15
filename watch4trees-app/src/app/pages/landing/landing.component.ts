import { Component, signal, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterModule } from '@angular/router';
import { TranslationService } from '../../services/translation.service';
import { TranslatePipe } from '../../pipes/translate.pipe';
import { AuthService } from '../../services/auth.service';
import { LangToggleComponent } from '../../components/lang-toggle/lang-toggle.component';
import { BrandLogoComponent } from '../../components/brand-logo/brand-logo.component';
import { TreeStageComponent } from '../../components/tree-stage/tree-stage.component';
import { MobileDrawerComponent } from '../../components/mobile-drawer/mobile-drawer.component';

@Component({
  selector: 'app-landing',
  standalone: true,
  imports: [
    CommonModule, 
    RouterModule, 
    TranslatePipe, 
    LangToggleComponent, 
    BrandLogoComponent,
    TreeStageComponent,
    MobileDrawerComponent
  ],
  templateUrl: './landing.component.html',
  styleUrls: ['./landing.component.scss']
})
export class LandingComponent {
  i18n = inject(TranslationService);
  auth = inject(AuthService);
  router = inject(Router);

  // Interactive demo simulator state
  demoWaterDrops = signal<number>(4);
  demoMaxDrops = 5;
  demoTreePlanted = signal<boolean>(false);
  
  // Newsletter early access capture state
  emailInput = signal<string>('');
  emailSubscribed = signal<boolean>(false);

  // Active FAQ Accordion index
  activeFaqIndex = signal<number | null>(0);

  // Mobile navigation drawer state
  isMobileMenuOpen = signal<boolean>(false);

  toggleMobileMenu() {
    this.isMobileMenuOpen.update(open => !open);
  }

  closeMobileMenu() {
    this.isMobileMenuOpen.set(false);
  }

  toggleFaq(index: number) {
    this.activeFaqIndex.set(this.activeFaqIndex() === index ? null : index);
  }

  addDemoWater() {
    if (this.demoWaterDrops() < this.demoMaxDrops) {
      this.demoWaterDrops.update(d => d + 1);
      if (this.demoWaterDrops() >= this.demoMaxDrops) {
        this.demoTreePlanted.set(true);
      }
    }
  }

  resetDemo() {
    this.demoWaterDrops.set(1);
    this.demoTreePlanted.set(false);
  }

  submitNewsletter(e: Event) {
    e.preventDefault();
    if (this.emailInput().trim()) {
      this.emailSubscribed.set(true);
    }
  }

  scrollToSection(sectionId: string) {
    this.closeMobileMenu();
    const el = document.getElementById(sectionId);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }

  goToAuth() {
    this.closeMobileMenu();
    if (this.auth.isAuthenticated()) {
      this.router.navigate(['/dashboard']);
    } else {
      this.router.navigate(['/auth']);
    }
  }
}
