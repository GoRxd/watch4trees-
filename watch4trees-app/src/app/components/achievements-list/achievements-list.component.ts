import { Component, signal, inject, OnInit, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { NgIcon } from '@ng-icons/core';
import { DatabaseService } from '../../services/database.service';
import { AuthService } from '../../services/auth.service';
import { TranslatePipe } from '../../pipes/translate.pipe';
import { RevealDirective } from '../../directives/reveal.directive';
import { SpotlightDirective } from '../../directives/spotlight.directive';
import { Achievement, UserAchievement } from '../../models';

export interface AchievementViewModel extends Achievement {
  isUnlocked: boolean;
  unlockedAt?: string;
}

// [TODO_TEMPLATE: User will write backend logic/triggers to evaluate criteria_type and award user_achievements]

@Component({
  selector: 'app-achievements-list',
  standalone: true,
  imports: [CommonModule, NgIcon, TranslatePipe, RevealDirective, SpotlightDirective],
  templateUrl: './achievements-list.component.html'
})
export class AchievementsListComponent implements OnInit {
  private db = inject(DatabaseService);
  private auth = inject(AuthService);

  // Reactive state signals
  achievements = signal<AchievementViewModel[]>([]);
  selectedCategory = signal<string>('all');
  isLoading = signal<boolean>(true);

  // Computed counts
  unlockedCount = computed(() => this.achievements().filter(a => a.isUnlocked).length);
  totalCount = computed(() => this.achievements().length);
  progressPercent = computed(() => {
    const total = this.totalCount();
    if (total === 0) return 0;
    return Math.round((this.unlockedCount() / total) * 100);
  });

  // Filtered view
  filteredAchievements = computed(() => {
    const cat = this.selectedCategory();
    let list = this.achievements();
    if (cat !== 'all') {
      list = list.filter(a => a.category === cat);
    }
    return list.sort((a, b) => a.isUnlocked === b.isUnlocked ? 0 : a.isUnlocked ? -1 : 1);
  });

  categories = [
    { key: 'all', labelKey: 'achievements.allFilter' },
    { key: 'onboarding', labelKey: 'achievements.onboardingFilter' },
    { key: 'watering', labelKey: 'achievements.wateringFilter' },
    { key: 'gaming', labelKey: 'achievements.gamingFilter' },
    { key: 'impact', labelKey: 'achievements.impactFilter' },
    { key: 'streak', labelKey: 'achievements.streakFilter' }
  ];

  ngOnInit() {
    this.loadAchievements();
  }

  async loadAchievements() {
    this.isLoading.set(true);
    const user = this.auth.currentUser();

    try {
      const [allDefs, userUnlocked] = await Promise.all([
        this.db.getAchievements(),
        user ? this.db.getUserAchievements(user.id) : Promise.resolve([])
      ]);

      const unlockedMap = new Map<string, UserAchievement>();
      for (const ua of userUnlocked) {
        unlockedMap.set(ua.achievement_id, ua);
      }

      const viewModels: AchievementViewModel[] = allDefs.map(def => {
        const unlockedEntry = unlockedMap.get(def.id);
        return {
          ...def,
          isUnlocked: !!unlockedEntry,
          unlockedAt: unlockedEntry?.unlocked_at ? new Date(unlockedEntry.unlocked_at).toLocaleDateString() : undefined
        };
      });

      this.achievements.set(viewModels);
    } catch (err) {
      console.error('[AchievementsListComponent] Failed to load achievements:', err);
    } finally {
      this.isLoading.set(false);
    }
  }

  setCategory(category: string) {
    this.selectedCategory.set(category);
  }
}
