import { Component, signal, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { AuthService } from '../../services/auth.service';
import { DatabaseService } from '../../services/database.service';
import { TranslationService } from '../../services/translation.service';
import { ToastService } from '../../services/toast.service';
import { TranslatePipe } from '../../pipes/translate.pipe';
import { AppHeaderComponent } from '../../components/app-header/app-header.component';
import { TreeStageComponent } from '../../components/tree-stage/tree-stage.component';
import { AchievementsListComponent } from '../../components/achievements-list/achievements-list.component';
import { PlantedTreeCertificate } from '../../models';
import { ECO_METRICS } from '../../constants';

export type { PlantedTreeCertificate } from '../../models';
export type DashboardTab = 'forest' | 'achievements';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [
    CommonModule, 
    RouterModule, 
    TranslatePipe, 
    AppHeaderComponent,
    TreeStageComponent,
    AchievementsListComponent
  ],
  templateUrl: './dashboard.component.html',
  styleUrls: ['./dashboard.component.scss']
})
export class DashboardComponent implements OnInit {
  auth = inject(AuthService);
  db = inject(DatabaseService);
  i18n = inject(TranslationService);
  toast = inject(ToastService);
  ecoMetrics = ECO_METRICS;

  // Active dashboard navigation tab
  activeTab = signal<DashboardTab>('forest');

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
      serialNumber: t.certificate_number || t.tree_number,
      species: t.project?.tree_species || 'Dąb Szypułkowy (Quercus robur)',
      speciesIcon: t.project?.country_code === 'MG' ? '🌴' : (t.project?.tree_species.includes('Sosna') ? '🌲' : '🌳'),
      plantedDate: t.planted_at ? new Date(t.planted_at).toLocaleDateString() : new Date().toLocaleDateString(),
      location: `${t.project?.name || 'Nadleśnictwo Lipusz'}, ${t.project?.region || 'Polska'}`,
      foundation: t.verified_by || t.project?.organization || user.targetFoundation || 'Posadzimy.pl',
      co2PerYearKg: Number(t.project?.co2_absorption_kg_year || ECO_METRICS.CO2_PER_TREE_KG)
    }));

    this.myPlantedTrees.set(certificates);
  }

  async waterActiveTree() {
    const user = this.auth.currentUser();

    if (!user || user.waterDrops <= 0) {
      this.toast.warning('toast.noDropsMsg', 'toast.noDropsTitle');
      return;
    }

    if (this.isWatering()) return;

    // Trigger visual watering animation
    this.isWatering.set(true);
    if (this.wateringTimeout) clearTimeout(this.wateringTimeout);
    this.wateringTimeout = setTimeout(() => this.isWatering.set(false), 900);

    // Call Supabase Edge Function with optimistic CAS concurrency protection
    const res = await this.db.waterActiveTree(1);

    if (res.success) {
      // Update reactive auth state
      this.auth.updateUser({
        waterDrops: res.current_drops ?? Math.max(0, user.waterDrops - 1),
        ecoPoints: res.eco_points ?? (user.ecoPoints + 15),
        treesPlanted: res.total_trees_planted ?? user.treesPlanted
      });

      // If this drop completed the 10-drop threshold and planted a real tree in backend:
      if (res.tree_planted_now) {
        // Show 10/10 fully mature state during celebration in UI
        this.currentTreeDrops.set(this.dropsNeededForTree);
        this.treeSuccessCelebration.set(true);

        if (res.new_tree) {
          const newCert: PlantedTreeCertificate = {
            id: res.new_tree.id,
            serialNumber: res.new_tree.certificate_number || res.new_tree.tree_number,
            species: res.new_tree.project?.tree_species || 'Dąb Szypułkowy (Quercus robur)',
            speciesIcon: '🌳',
            plantedDate: new Date().toLocaleDateString(),
            location: `${res.new_tree.project?.name || 'Nadleśnictwo Lipusz'}, ${res.new_tree.project?.region || 'Polska'}`,
            foundation: res.new_tree.verified_by || user.targetFoundation || 'Posadzimy.pl',
            co2PerYearKg: ECO_METRICS.CO2_PER_TREE_KG
          };
          this.myPlantedTrees.update(trees => [newCert, ...trees]);
        } else {
          // Re-fetch all planted trees from DB to make sure newly planted tree is displayed
          const dbTrees = await this.db.getPlantedTrees(user.id);
          const certificates: PlantedTreeCertificate[] = dbTrees.map(t => ({
            id: t.id,
            serialNumber: t.certificate_number || t.tree_number,
            species: t.project?.tree_species || 'Dąb Szypułkowy (Quercus robur)',
            speciesIcon: '🌳',
            plantedDate: t.planted_at ? new Date(t.planted_at).toLocaleDateString() : new Date().toLocaleDateString(),
            location: `${t.project?.name || 'Nadleśnictwo Lipusz'}, ${t.project?.region || 'Polska'}`,
            foundation: t.verified_by || user.targetFoundation || 'Posadzimy.pl',
            co2PerYearKg: Number(t.project?.co2_absorption_kg_year || ECO_METRICS.CO2_PER_TREE_KG)
          }));
          this.myPlantedTrees.set(certificates);
        }

        setTimeout(() => {
          this.currentTreeDrops.set(0);
          this.treeSuccessCelebration.set(false);
        }, 4000);
      } else {
        // Normal watering progress step (+1) updated directly in UI
        this.currentTreeDrops.set(res.active_tree_drops ?? 0);
      }
    } else if (res.error) {
      console.error('[DashboardComponent] Error watering tree:', res.error);
      const isRateLimit = res.error === 'TooManyRequests' || 
        (typeof res.error === 'string' && (res.error.includes('Rate limit') || res.error.includes('Zbyt szybkie') || res.error.includes('Too many')));

      if (isRateLimit) {
        const msg = res.message || res.error;
        this.toast.warning(msg, 'toast.rateLimitTitle');
      } else {
        this.toast.error(res.error, 'toast.wateringErrorTitle');
      }
    }
  }
}
