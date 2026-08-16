import { Component, signal, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { AuthService } from '../../services/auth.service';
import { DatabaseService } from '../../services/database.service';
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
export class DashboardComponent implements OnInit {
  auth = inject(AuthService);
  db = inject(DatabaseService);
  i18n = inject(TranslationService);
  ecoMetrics = ECO_METRICS;

  // Active tree watering state
  currentTreeDrops = signal<number>(6);
  dropsNeededForTree = ECO_METRICS.DEFAULT_TREE_DROPS_NEEDED;
  treeSuccessCelebration = signal<boolean>(false);

  // Planted trees certificates list
  myPlantedTrees = signal<PlantedTreeCertificate[]>([]);

  ngOnInit() {
    this.loadUserData();
  }

  // [TODO_TEMPLATE: Load user trees and balance from DatabaseService / Supabase]
  async loadUserData() {
    const user = this.auth.currentUser();
    if (!user) return;

    // Fetch user water balance
    const balance = await this.db.getUserWaterBalance(user.id);
    if (balance) {
      this.currentTreeDrops.set(balance.current_drops);
    }

    // Fetch planted trees and map to certificates
    const dbTrees = await this.db.getPlantedTrees(user.id);
    const certificates: PlantedTreeCertificate[] = dbTrees.map(t => ({
      id: t.id,
      serialNumber: t.certificate?.certificate_number || t.tree_number,
      species: t.project?.tree_species || 'Dąb Szypułkowy (Quercus robur)',
      speciesIcon: t.project?.country_code === 'MG' ? '🌴' : (t.project?.tree_species.includes('Sosna') ? '🌲' : '🌳'),
      plantedDate: t.planted_at ? new Date(t.planted_at).toLocaleDateString() : new Date().toLocaleDateString(),
      location: `${t.project?.name || 'Nadleśnictwo Lipusz'}, ${t.project?.region || 'Polska'}`,
      foundation: t.certificate?.verified_by || t.project?.organization || user.targetFoundation || 'Posadzimy.pl',
      co2PerYearKg: Number(t.project?.co2_absorption_kg_year || ECO_METRICS.CO2_PER_TREE_KG)
    }));

    this.myPlantedTrees.set(certificates);
  }

  async waterActiveTree() {
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

    // Record drop transaction in database
    await this.db.addWaterDrops(user.id, 1, 'AD_REWARD', { action: 'water_tree' });

    // Check if tree is fully mature and funded (10 drops)!
    if (this.currentTreeDrops() >= this.dropsNeededForTree) {
      await this.celebrateTreePlanted();
    }
  }

  private async celebrateTreePlanted() {
    const user = this.auth.currentUser();
    if (!user) return;

    this.treeSuccessCelebration.set(true);

    // Record new planted tree in database
    const planted = await this.db.recordNewPlantedTree(user.id);
    if (!planted) {
      this.treeSuccessCelebration.set(false);
      return;
    }

    const newCert: PlantedTreeCertificate = {
      id: planted.id,
      serialNumber: planted.certificate?.certificate_number || planted.tree_number,
      species: planted.project?.tree_species || 'Dąb Szypułkowy (Quercus robur)',
      speciesIcon: '🌳',
      plantedDate: new Date().toLocaleDateString(),
      location: `${planted.project?.name || 'Nadleśnictwo Solec Kujawski'}, ${planted.project?.region || 'Polska'}`,
      foundation: planted.certificate?.verified_by || user.targetFoundation || 'Posadzimy.pl',
      co2PerYearKg: ECO_METRICS.CO2_PER_TREE_KG
    };

    // Update user stats and trees list
    this.auth.updateUser({
      treesPlanted: user.treesPlanted + 1,
      ecoPoints: user.ecoPoints + 200
    });

    this.myPlantedTrees.update(trees => [newCert, ...trees]);

    // Reset tree progress after small delay
    setTimeout(() => {
      this.currentTreeDrops.set(0);
      this.treeSuccessCelebration.set(false);
    }, 4000);
  }
}


