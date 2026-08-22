import { Component, signal, inject, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { AuthService } from '../../services/auth.service';
import { DatabaseService } from '../../services/database.service';
import { TranslationService } from '../../services/translation.service';
import { ToastService } from '../../services/toast.service';
import { TranslatePipe } from '../../pipes/translate.pipe';
import { AppHeaderComponent } from '../../components/app-header/app-header.component';
import { AdSessionConfig, SessionType, SponsorInfo, QuizQuestion } from '../../models';

export type { AdSessionConfig, SessionType, SponsorInfo, QuizQuestion } from '../../models';

@Component({
  selector: 'app-watch',
  standalone: true,
  imports: [
    CommonModule, 
    RouterModule, 
    TranslatePipe, 
    AppHeaderComponent
  ],
  templateUrl: './watch.component.html',
  styleUrls: ['./watch.component.scss']
})
export class WatchComponent implements OnDestroy {
  auth = inject(AuthService);
  db = inject(DatabaseService);
  i18n = inject(TranslationService);
  toast = inject(ToastService);

  // Available session options
  sessions: AdSessionConfig[] = [
    {
      id: 'quick',
      titleKey: 'watch.sessionQuickTitle',
      durationSeconds: 15,
      adCount: 1,
      waterReward: 1,
      pointsReward: 25,
      icon: '⚡',
      badgeKey: 'watch.sessionQuickBadge'
    },
    {
      id: 'focus',
      titleKey: 'watch.sessionFocusTitle',
      durationSeconds: 30,
      adCount: 2,
      waterReward: 3,
      pointsReward: 80,
      icon: '🎯',
      badgeKey: 'watch.sessionFocusBadge'
    },
    {
      id: 'deep',
      titleKey: 'watch.sessionDeepTitle',
      durationSeconds: 60,
      adCount: 4,
      waterReward: 6,
      pointsReward: 180,
      icon: '🌿',
      badgeKey: 'watch.sessionDeepBadge'
    }
  ];

  // Active state machine: 'idle' | 'playing' | 'quiz' | 'reward' | 'quiz_failed'
  state = signal<'idle' | 'playing' | 'quiz' | 'reward' | 'quiz_failed'>('idle');
  selectedSession = signal<AdSessionConfig>(this.sessions[0]);

  // Video playback countdown
  currentTimer = signal<number>(15);
  timerTotal = signal<number>(15);
  progressPercent = signal<number>(0);
  timerInterval: any = null;

  // Server-Side Anti-Fraud Session State
  sessionToken = signal<string | null>(null);
  serverQuiz = signal<QuizQuestion | null>(null);
  isStarting = signal<boolean>(false);
  isSubmitting = signal<boolean>(false);
  errorMessage = signal<string | null>(null);

  // Sponsor Branding
  currentSponsor = signal<SponsorInfo>({
    name: 'EkoEnergia Green Power',
    tagline: '100% energii z certyfikowanych farm wiatrowych i słonecznych',
    logo: '⚡🌱',
    esgGoal: 'Sadzenie 100 000 drzew w Polsce do końca 2026 r.'
  });

  async startSession(session: AdSessionConfig) {
    // Client-side throttling guard: prevent rapid duplicate calls
    if (this.isStarting()) return;

    this.selectedSession.set(session);
    this.errorMessage.set(null);
    this.isStarting.set(true);
    this.isSubmitting.set(false);

    try {
      // Call Supabase Edge Function to initialize signed session token & server quiz
      const res = await this.db.startAdSession(session.id);
      if (!res.success || !res.sessionToken || !res.quiz) {
        const err = res.error || res.message || 'toast.sessionStartError';
        
        if (typeof err === 'string' && err.includes('ActiveSessionInProgress')) {
          this.toast.warning(err, 'toast.sessionInProgressTitle');
        } else if (typeof err === 'string' && (err.includes('Daily limit') || err.includes('TooManyRequests') || err.includes('Rate limit') || err.includes('Zbyt częste'))) {
          const msg = res.message || err;
          this.toast.warning(msg, 'toast.rateLimitTitle');
        } else {
          this.toast.error(err, 'toast.sessionErrorTitle');
        }
        return;
      }

      const totalSeconds = res.durationSeconds || session.durationSeconds;
      this.sessionToken.set(res.sessionToken);
      this.serverQuiz.set(res.quiz);
      this.timerTotal.set(totalSeconds);
      this.currentTimer.set(totalSeconds);
      this.progressPercent.set(0);
      this.state.set('playing');

      if (this.timerInterval) {
        clearInterval(this.timerInterval);
      }

      const durationMs = totalSeconds * 1000;
      const startTime = Date.now();

      this.timerInterval = setInterval(() => {
        const elapsed = Date.now() - startTime;
        const remainingMs = Math.max(0, durationMs - elapsed);
        const remainingSec = Math.ceil(remainingMs / 1000);
        const progress = Math.min(100, (elapsed / durationMs) * 100);

        this.currentTimer.set(remainingSec);
        this.progressPercent.set(progress);

        if (remainingMs <= 0) {
          clearInterval(this.timerInterval);
          this.timerInterval = null;
          this.currentTimer.set(0);
          this.progressPercent.set(100);

          // Smooth transition after reaching 100%
          setTimeout(() => {
            this.state.set('quiz');
          }, 400);
        }
      }, 40);
    } finally {
      this.isStarting.set(false);
    }
  }

  // Verify anti-fraud attention quiz via Edge Function
  async submitQuizAnswer(selectedOptionId: string) {
    if (this.isSubmitting()) return;

    const token = this.sessionToken();
    if (!token) {
      this.state.set('idle');
      return;
    }

    this.isSubmitting.set(true);
    this.errorMessage.set(null);

    try {
      const res = await this.db.claimAdReward(token, selectedOptionId);

      if (res.success) {
        const user = this.auth.currentUser();
        if (user) {
          this.auth.updateUser({
            waterDrops: res.current_drops ?? (user.waterDrops + this.selectedSession().waterReward),
            ecoPoints: res.eco_points ?? (user.ecoPoints + this.selectedSession().pointsReward),
            dailyLimitRemaining: res.dailyLimitRemaining ?? Math.max(0, user.dailyLimitRemaining - this.selectedSession().adCount),
            activeStreak: res.streak_days ?? user.activeStreak
          });
        }
        // Transition to dedicated Reward screen in UI
        this.state.set('reward');
      } else {
        const isRateLimit = res.error === 'TooManyRequests' || 
          (typeof res.error === 'string' && (res.error.includes('Rate limit') || res.error.includes('Zbyt częste')));

        if (isRateLimit) {
          const msg = res.message || res.error || 'toast.rateLimitMsg';
          this.errorMessage.set(msg);
          this.toast.warning(msg, 'toast.rateLimitTitle');
          return;
        }

        const isQuizError = res.quizVerified === false || 
          (typeof res.error === 'string' && (
            res.error.includes('quiz') || 
            res.error.includes('Incorrect') || 
            res.error.includes('human presence')
          ));

        if (isQuizError) {
          // Human attention verification failed: void session and transition directly to UI cancellation screen
          this.sessionToken.set(null);
          this.serverQuiz.set(null);
          this.state.set('quiz_failed');
        } else {
          const errorKeyOrMsg = res.error || 'toast.rewardErrorMsg';
          this.errorMessage.set(this.i18n.translate(errorKeyOrMsg));
          this.toast.error(errorKeyOrMsg, 'toast.rewardErrorTitle');
        }
      }
    } finally {
      this.isSubmitting.set(false);
    }
  }

  resetSession() {
    if (this.timerInterval) {
      clearInterval(this.timerInterval);
      this.timerInterval = null;
    }
    this.state.set('idle');
    this.sessionToken.set(null);
    this.serverQuiz.set(null);
    this.errorMessage.set(null);
    this.progressPercent.set(0);
  }

  ngOnDestroy() {
    if (this.timerInterval) {
      clearInterval(this.timerInterval);
      this.timerInterval = null;
    }
  }
}
