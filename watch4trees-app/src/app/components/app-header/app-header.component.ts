import { Component, input, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { BrandLogoComponent } from '../brand-logo/brand-logo.component';
import { UserHudComponent } from '../user-hud/user-hud.component';
import { LangToggleComponent } from '../lang-toggle/lang-toggle.component';
import { UserProfileComponent } from '../user-profile/user-profile.component';
import { MobileDrawerComponent } from '../mobile-drawer/mobile-drawer.component';

@Component({
  selector: 'app-app-header',
  standalone: true,
  imports: [
    CommonModule,
    RouterModule,
    BrandLogoComponent,
    UserHudComponent,
    LangToggleComponent,
    UserProfileComponent,
    MobileDrawerComponent
  ],
  templateUrl: './app-header.component.html',
  styleUrls: ['./app-header.component.scss']
})
export class AppHeaderComponent {
  // Inputs for customizable header appearance
  subtitle = input<string>('Eko-Pulpit Ogrodnika');
  backUrl = input<string | null>(null);
  backLabel = input<string | null>(null);
  titleBadge = input<string | null>(null);
  showCenterHud = input<boolean>(true);

  // Self-contained mobile drawer state
  isMobileMenuOpen = signal<boolean>(false);

  toggleMobileMenu() {
    this.isMobileMenuOpen.update(open => !open);
  }

  closeMobileMenu() {
    this.isMobileMenuOpen.set(false);
  }
}
