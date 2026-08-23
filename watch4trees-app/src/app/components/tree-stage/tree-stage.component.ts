import { Component, input, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { NgIcon } from '@ng-icons/core';
import { TranslatePipe } from '../../pipes/translate.pipe';

interface BurstPiece {
  icon: string;
  style: string;
}

@Component({
  selector: 'app-tree-stage',
  standalone: true,
  imports: [CommonModule, NgIcon, TranslatePipe],
  templateUrl: './tree-stage.component.html'
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

  /** Celebration burst pieces: leaf/drop/sparkle flying outward on planting. */
  readonly burstPieces: BurstPiece[] = Array.from({ length: 16 }, (_, i) => {
    const icons = ['ph:leaf-duotone', 'ph:drop-duotone', 'ph:sparkle-duotone'];
    const angle = (i / 16) * Math.PI * 2;
    const radius = 70 + ((i * 37) % 90);
    const dx = Math.round(Math.cos(angle) * radius);
    const dy = Math.round(Math.sin(angle) * radius * 0.7) - 40;
    const rot = (i % 2 === 0 ? 1 : -1) * (160 + (i * 23) % 120);
    return {
      icon: icons[i % icons.length],
      style:
        `--burst-dx:${dx}px; --burst-dy:${dy}px; --burst-rot:${rot}deg;` +
        ` --burst-delay:${i * 45}ms; --burst-duration:${(950 + (i * 61) % 450)}ms;` +
        `color:${['#6ee7b7', '#38bdf8', '#a7f3d0'][i % 3]}`
    };
  });

  stageIndex = computed(() => {
    if (this.isCelebration()) return 3;
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
}
