import { Component, signal, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { AuthService } from '../../services/auth.service';
import { TranslationService } from '../../services/translation.service';
import { TranslatePipe } from '../../pipes/translate.pipe';
import { LangToggleComponent } from '../../components/lang-toggle/lang-toggle.component';
import { BrandLogoComponent } from '../../components/brand-logo/brand-logo.component';

@Component({
  selector: 'app-auth',
  standalone: true,
  imports: [CommonModule, RouterModule, TranslatePipe, LangToggleComponent, BrandLogoComponent],
  templateUrl: './auth.component.html',
  styleUrls: ['./auth.component.scss']
})
export class AuthComponent {
  auth = inject(AuthService);
  i18n = inject(TranslationService);

  isRegisterMode = signal<boolean>(false);
  emailInput = signal<string>('');
  passwordInput = signal<string>('');
  errorMessage = signal<string | null>(null);

  toggleMode() {
    this.isRegisterMode.update(m => !m);
    this.errorMessage.set(null);
  }

  submitAuth(e: Event) {
    e.preventDefault();
    if (!this.emailInput().trim() || !this.passwordInput().trim()) {
      this.errorMessage.set(this.i18n.currentLang() === 'pl' ? 'Wypełnij wszystkie pola!' : 'Please fill all fields!');
      return;
    }

    this.auth.login(this.emailInput(), this.passwordInput());
  }

  loginWithGoogle() {
    this.auth.loginWithGoogle();
  }

  loginDemo() {
    this.auth.loginDemo();
  }
}
