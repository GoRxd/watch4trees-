import { Component, signal, inject, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { AuthService } from '../../services/auth.service';
import { DatabaseService } from '../../services/database.service';
import { TranslationService } from '../../services/translation.service';
import { TranslatePipe } from '../../pipes/translate.pipe';
import { AppHeaderComponent } from '../../components/app-header/app-header.component';
import { AdSessionConfig, SessionType, SponsorInfo } from '../../models';

export type { AdSessionConfig, SessionType, SponsorInfo } from '../../models';

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

  // Active state machine: 'idle' | 'playing' | 'quiz' | 'reward'
  state = signal<'idle' | 'playing' | 'quiz' | 'reward'>('idle');
  selectedSession = signal<AdSessionConfig>(this.sessions[0]);

  // Video playback countdown
  currentTimer = signal<number>(15);
  timerTotal = signal<number>(15);
  timerInterval: any = null;

  // Anti-fraud attention quiz
  quizAnswered = signal<boolean>(false);
  quizCorrect = signal<boolean>(false);

  // Mock ESG Sponsor details
  currentSponsor = signal<SponsorInfo>({
    name: 'EkoEnergia Green Power',
    tagline: '100% energii z certyfikowanych farm wiatrowych i słonecznych',
    logo: '⚡🌱',
    esgGoal: 'Sadzenie 100 000 drzew w Polsce do końca 2026 r.'
  });

  startSession(session: AdSessionConfig) {
    this.selectedSession.set(session);
    this.timerTotal.set(session.durationSeconds);
    this.currentTimer.set(session.durationSeconds);
    this.state.set('playing');
    this.quizAnswered.set(false);
    this.quizCorrect.set(false);

    if (this.timerInterval) {
      clearInterval(this.timerInterval);
    }

    this.timerInterval = setInterval(() => {
      if (this.currentTimer() > 1) {
        this.currentTimer.update(t => t - 1);
      } else {
        clearInterval(this.timerInterval);
        this.timerInterval = null;
        // Prompt human anti-fraud verification
        this.state.set('quiz');
      }
    }, 1000);
  }

  // Verify anti-fraud attention quiz
  answerQuiz(isCorrect: boolean) {
    this.quizAnswered.set(true);
    this.quizCorrect.set(isCorrect);

    if (isCorrect) {
      setTimeout(() => {
        this.grantRewards();
      }, 700);
    } else {
      setTimeout(() => {
        alert(this.i18n.currentLang() === 'pl' 
          ? 'Błędna odpowiedź! Spróbuj ponownie, aby potwierdzić obecność człowieka.' 
          : 'Incorrect answer! Please retry to verify human presence.');
        this.quizAnswered.set(false);
      }, 500);
    }
  }

  // Server-Side Verification simulation & award delivery
  // [TODO_TEMPLATE: Send SSV ad session confirmation to Supabase Edge Function]
  private async grantRewards() {
    const user = this.auth.currentUser();
    const session = this.selectedSession();

    if (user) {
      this.auth.updateUser({
        waterDrops: user.waterDrops + session.waterReward,
        ecoPoints: user.ecoPoints + session.pointsReward,
        dailyLimitRemaining: Math.max(0, user.dailyLimitRemaining - session.adCount)
      });

      // Record transaction in database
      await this.db.addWaterDrops(user.id, session.waterReward, 'AD_REWARD', {
        sessionId: session.id,
        adCount: session.adCount,
        durationSeconds: session.durationSeconds
      });
    }

    this.state.set('reward');
  }

  ngOnDestroy() {
    if (this.timerInterval) {
      clearInterval(this.timerInterval);
    }
  }
}

