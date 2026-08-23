import { Component, signal, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterModule } from '@angular/router';
import { NgIcon } from '@ng-icons/core';
import { TranslationService } from '../../services/translation.service';
import { TranslatePipe } from '../../pipes/translate.pipe';
import { AuthService } from '../../services/auth.service';
import { LangToggleComponent } from '../../components/lang-toggle/lang-toggle.component';
import { BrandLogoComponent } from '../../components/brand-logo/brand-logo.component';
import { TreeStageComponent } from '../../components/tree-stage/tree-stage.component';
import { MobileDrawerComponent } from '../../components/mobile-drawer/mobile-drawer.component';
import { RevealDirective } from '../../directives/reveal.directive';

@Component({
  selector: 'app-landing',
  standalone: true,
  imports: [
    CommonModule,
    RouterModule,
    NgIcon,
    TranslatePipe,
    LangToggleComponent,
    BrandLogoComponent,
    TreeStageComponent,
    MobileDrawerComponent,
    RevealDirective
  ],
  templateUrl: './landing.component.html'
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
  emailError = signal<string>('');

  private emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

  // Active FAQ Accordion index
  activeFaqIndex = signal<number | null>(0);

  // Mobile navigation drawer state
  isMobileMenuOpen = signal<boolean>(false);

  // Partner marquee: 4 real chips duplicated for the seamless loop (copies aria-hidden)
  readonly marqueePartners = [
    { tag: 'PL', nameKey: 'transparency.partners.poland' },
    { tag: 'GL', nameKey: 'transparency.partners.global' },
    { tag: 'MG', nameKey: 'transparency.partners.eden' },
    { tag: 'FSC', nameKey: 'transparency.partners.audit' },
    { tag: 'PL', nameKey: 'transparency.partners.poland' },
    { tag: 'GL', nameKey: 'transparency.partners.global' },
    { tag: 'MG', nameKey: 'transparency.partners.eden' },
    { tag: 'FSC', nameKey: 'transparency.partners.audit' }
  ];

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

  // [TODO_TEMPLATE: Submit email to Supabase / Backend Newsletter subscription API]
  submitNewsletter(e: Event) {
    e.preventDefault();
    const value = this.emailInput().trim();
    if (!this.emailPattern.test(value)) {
      this.emailError.set(this.i18n.translate('join.emailInvalid'));
      return;
    }
    this.emailError.set('');
    this.emailSubscribed.set(true);
  }

  onEmailInput(value: string) {
    this.emailInput.set(value);
    if (this.emailError()) {
      this.emailError.set('');
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
