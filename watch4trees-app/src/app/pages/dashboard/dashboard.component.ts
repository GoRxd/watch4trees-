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
  currentTreeDrops = signal<number>(0);
  dropsNeededForTree = ECO_METRICS.DEFAULT_TREE_DROPS_NEEDED;
  treeSuccessCelebration = signal<boolean>(false);
  isWatering = signal<boolean>(false);
  private wateringTimeout: any = null;

  // Planted trees certificates list
  myPlantedTrees = signal<PlantedTreeCertificate[]>([]);

  ngOnInit() {
    this.loadUserData();
  }

  // [TODO_TEMPLATE: Load user trees and balance from DatabaseService / Supabase]
  async loadUserData() {
    const user = this.auth.currentUser();
    if (!user) return;

    // Fetch user water balance from Supabase
    const balance = await this.db.getUserWaterBalance(user.id);
    if (balance) {
      this.currentTreeDrops.set(balance.active_tree_drops ?? 0);
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

    // Trigger or extend visual watering can animation smoothly
    if (this.wateringTimeout) {
      clearTimeout(this.wateringTimeout);
    }
    this.isWatering.set(true);
    this.wateringTimeout = setTimeout(() => {
      this.isWatering.set(false);
      this.wateringTimeout = null;
    }, 1500);

    // Call secure RPC in Supabase backend to spend water drop and water tree
    const res = await this.db.waterActiveTree(user.id, 1);
    if (res.success && res.current_drops !== undefined) {
      this.auth.updateUser({
        waterDrops: res.current_drops,
        ecoPoints: res.eco_points ?? (user.ecoPoints + 15),
        treesPlanted: res.total_trees_planted ?? user.treesPlanted
      });

      // If this drop completed the 10-drop threshold and planted a real tree in backend:
      if (res.tree_planted_now) {
        // Show 10/10 fully mature state during celebration
        this.currentTreeDrops.set(this.dropsNeededForTree);
        this.treeSuccessCelebration.set(true);

        if (res.new_tree) {
          const newCert: PlantedTreeCertificate = {
            id: res.new_tree.id,
            serialNumber: res.new_tree.certificate?.certificate_number || res.new_tree.tree_number,
            species: res.new_tree.project?.tree_species || 'Dąb Szypułkowy (Quercus robur)',
            speciesIcon: '🌳',
            plantedDate: new Date().toLocaleDateString(),
            location: `${res.new_tree.project?.name || 'Nadleśnictwo Lipusz'}, ${res.new_tree.project?.region || 'Polska'}`,
            foundation: res.new_tree.certificate?.verified_by || user.targetFoundation || 'Posadzimy.pl',
            co2PerYearKg: ECO_METRICS.CO2_PER_TREE_KG
          };
          this.myPlantedTrees.update(trees => [newCert, ...trees]);
        }

        setTimeout(() => {
          this.currentTreeDrops.set(0);
          this.treeSuccessCelebration.set(false);
        }, 4000);
      } else {
        // Normal watering progress step (+1)
        this.currentTreeDrops.set(res.active_tree_drops ?? 0);
      }
    } else if (res.error) {
      console.error('[DashboardComponent] Error watering tree:', res.error);
    }
  }
}
