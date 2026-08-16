import { Component, input, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TranslatePipe } from '../../pipes/translate.pipe';

@Component({
  selector: 'app-tree-stage',
  standalone: true,
  imports: [CommonModule, TranslatePipe],
  templateUrl: './tree-stage.component.html',
  styleUrls: ['./tree-stage.component.scss']
})
export class TreeStageComponent {
  currentDrops = input<number>(0);
  maxDrops = input<number>(10);
  isCelebration = input<boolean>(false);
  isWatering = input<boolean>(false);
  size = input<'md' | 'lg'>('lg');
  translationPrefix = input<'dashboard' | 'demo'>('dashboard');
  showProgressBar = input<boolean>(true);
  showHint = input<boolean>(true);
  progressLabelKey = input<string | undefined>(undefined);
  hintTextKey = input<string | undefined>(undefined);

  stageIndex = computed(() => {
    if (this.isCelebration()) return 3; // Keep mature tree illustration during celebration!
    const current = this.currentDrops();
    const max = this.maxDrops();
    if (current <= 0) return 0;
    const ratio = current / (max || 1);
    if (ratio < 0.3) return 0; // Seed
    if (ratio < 0.6) return 1; // Sprout
    if (ratio < 1.0) return 2; // Young tree
    return 3; // Mature
  });

  isMature = computed(() => this.currentDrops() >= this.maxDrops());

  isFinished = computed(() => this.isCelebration() || this.isMature());

  stageEmoji = computed(() => {
    if (this.isFinished()) return '🌲';
    const emojis = ['🌰', '🌱', '🪴', '🌲'];
    return emojis[this.stageIndex()] || '🌰';
  });

  stageKey = computed(() => {
    const isDemo = this.translationPrefix() === 'demo';
    const keys = isDemo
      ? ['demo.stateSeed', 'demo.stateSprout', 'demo.stateYoung', 'demo.stateMature']
      : ['dashboard.stageSeed', 'dashboard.stageSprout', 'dashboard.stageYoung', 'dashboard.stageFunded'];
    return keys[this.stageIndex()] || keys[0];
  });

  matureKey = computed(() => {
    return this.translationPrefix() === 'demo' ? 'demo.stateMature' : 'dashboard.stageFunded';
  });

  effectiveProgressLabelKey = computed(() => {
    const custom = this.progressLabelKey();
    if (custom) return custom;
    return this.translationPrefix() === 'demo' ? 'demo.waterLabel' : 'dashboard.growthProgress';
  });

  effectiveHintKey = computed(() => {
    const custom = this.hintTextKey();
    if (custom) return custom;
    return this.translationPrefix() === 'demo' ? 'demo.hint' : 'dashboard.growthHint';
  });

  progressPercentage = computed(() => {
    const max = this.maxDrops();
    if (max <= 0) return 0;
    return Math.min(100, (this.currentDrops() / max) * 100);
  });

  dropsUnit = computed(() => {
    return this.translationPrefix() === 'demo' ? '' : '💧';
  });
}
