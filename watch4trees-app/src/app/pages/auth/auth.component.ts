import { Component, signal, inject, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { AuthService } from '../../services/auth.service';
import { DatabaseService } from '../../services/database.service';
import { TranslationService } from '../../services/translation.service';
import { TranslatePipe } from '../../pipes/translate.pipe';
import { LangToggleComponent } from '../../components/lang-toggle/lang-toggle.component';
import { BrandLogoComponent } from '../../components/brand-logo/brand-logo.component';
import { SafeStorage } from '../../utils/storage.helper';

interface AuthLockoutLocalState {
  lockoutUntil: number; // Unix timestamp in ms
}

const AUTH_LOCKOUT_STORAGE_KEY = 'w4t_auth_lockout';

@Component({
  selector: 'app-auth',
  standalone: true,
  imports: [CommonModule, RouterModule, TranslatePipe, LangToggleComponent, BrandLogoComponent],
  templateUrl: './auth.component.html',
  styleUrls: ['./auth.component.scss']
})
export class AuthComponent implements OnInit, OnDestroy {
  auth = inject(AuthService);
  db = inject(DatabaseService);
  i18n = inject(TranslationService);

  isRegisterMode = signal<boolean>(false);
  emailInput = signal<string>('');
  passwordInput = signal<string>('');
  errorMessage = signal<string | null>(null);

  // Local display cache & lock guard
  isSubmitting = signal<boolean>(false);
  lockoutRemaining = signal<number>(0);
  private lockoutTimer: any = null;

  ngOnInit() {
    // 0 backend network calls on load: read local cached lockout if present
    this.restoreLocalLockoutState();
  }

  toggleMode() {
    this.isRegisterMode.update(m => !m);
    this.errorMessage.set(null);
  }

  private restoreLocalLockoutState() {
    const saved = SafeStorage.getJSON<AuthLockoutLocalState>(AUTH_LOCKOUT_STORAGE_KEY);
    if (!saved || !saved.lockoutUntil) return;

    const now = Date.now();
    if (saved.lockoutUntil > now) {
      const remainingSec = Math.ceil((saved.lockoutUntil - now) / 1000);
      this.startLockout(remainingSec, saved.lockoutUntil);
      this.errorMessage.set(this.i18n.translate('auth.lockoutWarning', { seconds: remainingSec.toString() }));
    } else {
      SafeStorage.removeItem(AUTH_LOCKOUT_STORAGE_KEY);
    }
  }

  private saveLocalLockout(lockoutUntilMs: number) {
    if (lockoutUntilMs > Date.now()) {
      SafeStorage.setJSON(AUTH_LOCKOUT_STORAGE_KEY, { lockoutUntil: lockoutUntilMs });
    } else {
      SafeStorage.removeItem(AUTH_LOCKOUT_STORAGE_KEY);
    }
  }

  private startLockout(seconds: number, targetUntilMs?: number) {
    if (this.lockoutTimer) {
      clearInterval(this.lockoutTimer);
    }

    const targetTime = targetUntilMs || (Date.now() + (seconds * 1000));
    this.lockoutRemaining.set(seconds);
    this.saveLocalLockout(targetTime);

    this.lockoutTimer = setInterval(() => {
      const now = Date.now();
      const remainingMs = targetTime - now;
      const remainingSec = Math.max(0, Math.ceil(remainingMs / 1000));

      this.lockoutRemaining.set(remainingSec);

      if (remainingSec <= 0) {
        clearInterval(this.lockoutTimer);
        this.lockoutTimer = null;
        this.lockoutRemaining.set(0);
        this.saveLocalLockout(0);
      }
    }, 1000);
  }

  async submitAuth(e: Event) {
    e.preventDefault();

    // Client-side guard: do not make API calls if client-side timer is active
    if (this.lockoutRemaining() > 0 || this.isSubmitting()) {
      return;
    }

    const email = this.emailInput().trim();
    const pass = this.passwordInput().trim();

    if (!email || !pass) {
      this.errorMessage.set(this.i18n.currentLang() === 'pl' ? 'Wypełnij wszystkie pola!' : 'Please fill all fields!');
      return;
    }

    this.errorMessage.set(null);
    this.isSubmitting.set(true);

    try {
      let res: { success: boolean; error?: string };

      if (this.isRegisterMode()) {
        res = await this.auth.signUp(email, pass);
      } else {
        res = await this.auth.login(email, pass);
      }

      if (res.success) {
        // Success: inform backend to clear penalty & clear local cache
        this.saveLocalLockout(0);
        this.lockoutRemaining.set(0);
        this.db.recordAuthAttempt(email, true).catch(() => {});
      } else {
        // Failure: Record failed attempt in PostgreSQL backend (evaluates lockout & escalations)
        const serverStatus = await this.db.recordAuthAttempt(email, false);

        if (!serverStatus.allowed && serverStatus.lockoutRemainingSeconds && serverStatus.lockoutRemainingSeconds > 0) {
          // Backend enforced a lockout penalty -> cache to SafeStorage & display timer
          this.startLockout(serverStatus.lockoutRemainingSeconds);
          this.errorMessage.set(serverStatus.message || this.i18n.translate('auth.lockoutWarning', { seconds: serverStatus.lockoutRemainingSeconds.toString() }));
        } else if (res.error) {
          this.errorMessage.set(res.error);
        }
      }
    } finally {
      this.isSubmitting.set(false);
    }
  }

  loginWithGoogle() {
    if (this.lockoutRemaining() > 0 || this.isSubmitting()) return;
    this.auth.loginWithGoogle();
  }

  async loginDemo() {
    if (this.lockoutRemaining() > 0 || this.isSubmitting()) return;

    this.errorMessage.set(null);
    this.isSubmitting.set(true);

    try {
      const res = await this.auth.loginDemo();
      if (res.success) {
        this.saveLocalLockout(0);
        this.lockoutRemaining.set(0);
      } else if (res.error) {
        this.errorMessage.set(res.error);
      }
    } finally {
      this.isSubmitting.set(false);
    }
  }

  ngOnDestroy() {
    if (this.lockoutTimer) {
      clearInterval(this.lockoutTimer);
      this.lockoutTimer = null;
    }
  }
}
