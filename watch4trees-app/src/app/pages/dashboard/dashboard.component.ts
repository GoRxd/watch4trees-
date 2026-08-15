import { Component, signal, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { AuthService } from '../../services/auth.service';
import { TranslationService } from '../../services/translation.service';
import { TranslatePipe } from '../../pipes/translate.pipe';
import { AppHeaderComponent } from '../../components/app-header/app-header.component';
import { TreeStageComponent } from '../../components/tree-stage/tree-stage.component';
import { PlantedTreeCertificate } from '../../models';
import { ECO_METRICS } from '../../constants';

export type { PlantedTreeCertificate } from '../../models';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [
    CommonModule, 
    RouterModule, 
    TranslatePipe, 
    AppHeaderComponent,
    TreeStageComponent
  ],
  templateUrl: './dashboard.component.html',
  styleUrls: ['./dashboard.component.scss']
})
export class DashboardComponent {
  auth = inject(AuthService);
  i18n = inject(TranslationService);
  ecoMetrics = ECO_METRICS;

  // Active tree watering state
  currentTreeDrops = signal<number>(6);
  dropsNeededForTree = ECO_METRICS.DEFAULT_TREE_DROPS_NEEDED;
  treeSuccessCelebration = signal<boolean>(false);

  // Planted trees certificates list
  myPlantedTrees = signal<PlantedTreeCertificate[]>([
    {
      id: 'tree-1',
      serialNumber: 'W4T-PL-2026-0941',
      species: 'Dąb Szypułkowy (Quercus robur)',
      speciesIcon: '🌳',
      plantedDate: '12.08.2026',
      location: 'Nadleśnictwo Lipusz, Polska (Działka #44/B)',
      foundation: 'Posadzimy.pl',
      co2PerYearKg: ECO_METRICS.CO2_PER_TREE_KG
    },
    {
      id: 'tree-2',
      serialNumber: 'W4T-PL-2026-0812',
      species: 'Sosna Zwyczajna (Pinus sylvestris)',
      speciesIcon: '🌲',
      plantedDate: '28.07.2026',
      location: 'Nadleśnictwo Spychowo, Mazury',
      foundation: 'Posadzimy.pl',
      co2PerYearKg: 18
    },
    {
      id: 'tree-3',
      serialNumber: 'W4T-GL-2026-4401',
      species: 'Namorzyny Czerwone (Rhizophora mangle)',
      speciesIcon: '🌴',
      plantedDate: '15.07.2026',
      location: 'Mahajanga Mangrove Restoration, Madagaskar',
      foundation: 'Eden Reforestation Projects',
      co2PerYearKg: 25
    }
  ]);

  waterActiveTree() {
    const user = this.auth.currentUser();
    if (!user) return;

    if (user.waterDrops <= 0) {
      alert(this.i18n.currentLang() === 'pl' 
        ? 'Brak kropel wody! Obejrzyj krótką sesję reklamową w module Oglądania, aby zdobyć nowe krople.' 
        : 'Out of water drops! Watch a quick ad session to earn more drops.');
      return;
    }

    // Deduct 1 drop from user inventory and add to active tree
    this.auth.updateUser({
      waterDrops: user.waterDrops - 1,
      ecoPoints: user.ecoPoints + 15
    });

    this.currentTreeDrops.update(d => d + 1);

    // Check if tree is fully mature and funded!
    if (this.currentTreeDrops() >= this.dropsNeededForTree) {
      this.celebrateTreePlanted();
    }
  }

  private celebrateTreePlanted() {
    const user = this.auth.currentUser();
    if (!user) return;

    this.treeSuccessCelebration.set(true);

    const newTree: PlantedTreeCertificate = {
      id: 'tree-' + Date.now(),
      serialNumber: `W4T-PL-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`,
      species: 'Dąb Szypułkowy (Quercus robur)',
      speciesIcon: '🌳',
      plantedDate: new Date().toLocaleDateString(),
      location: 'Nadleśnictwo Solec Kujawski, Polska',
      foundation: user.targetFoundation || 'Posadzimy.pl',
      co2PerYearKg: ECO_METRICS.CO2_PER_TREE_KG
    };

    // Update user stats and trees list
    this.auth.updateUser({
      treesPlanted: user.treesPlanted + 1,
      ecoPoints: user.ecoPoints + 200
    });

    this.myPlantedTrees.update(trees => [newTree, ...trees]);

    // Reset tree progress after small delay
    setTimeout(() => {
      this.currentTreeDrops.set(0);
      this.treeSuccessCelebration.set(false);
    }, 4000);
  }
}
