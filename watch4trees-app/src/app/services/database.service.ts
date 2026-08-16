import { Injectable, inject, signal } from '@angular/core';
import { SupabaseService } from './supabase.service';
import {
  Profile,
  UserWaterBalance,
  WaterDropTransaction,
  EcoProject,
  PlantedTree,
  TreeCertificate,
  Achievement,
  UserAchievement,
  TransactionSource
} from '../models';

export interface UserDashboardData {
  profile: Profile;
  balance: UserWaterBalance;
  planted_trees: PlantedTree[];
  user_achievements: UserAchievement[];
}

export interface LeaderboardEntry {
  username: string;
  avatar_url: string;
  streak_days: number;
  total_trees_planted: number;
  total_co2_offset_kg: number;
}

@Injectable({
  providedIn: 'root'
})
export class DatabaseService {
  private supabase = inject(SupabaseService);

  // Reactive state signals
  readonly activeBalance = signal<UserWaterBalance | null>(null);
  readonly userPlantedTrees = signal<PlantedTree[]>([]);
  readonly ecoProjects = signal<EcoProject[]>([]);
  readonly achievements = signal<Achievement[]>([]);
  readonly userAchievements = signal<UserAchievement[]>([]);

  // ----------------------------------------------------------------------------
  // 1. Single-Call Full Dashboard Data (SECURE RPC)
  // ----------------------------------------------------------------------------
  async getUserDashboard(): Promise<UserDashboardData | null> {
    const { data, error } = await this.supabase.client.rpc('get_user_dashboard');

    if (error || !data) {
      console.error('[DatabaseService] Error fetching dashboard RPC:', error);
      return null;
    }

    const dashboard = data as UserDashboardData;
    if (dashboard.balance) {
      this.activeBalance.set(dashboard.balance);
    }
    if (dashboard.planted_trees) {
      this.userPlantedTrees.set(dashboard.planted_trees);
    }
    if (dashboard.user_achievements) {
      this.userAchievements.set(dashboard.user_achievements);
    }

    return dashboard;
  }

  // ----------------------------------------------------------------------------
  // 2. Profile Operations (SECURE RPC)
  // ----------------------------------------------------------------------------
  async getProfile(userId: string): Promise<Profile | null> {
    const { data, error } = await this.supabase.client
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single();

    if (error) {
      console.error('[DatabaseService] Error fetching profile:', error);
      return null;
    }
    return data as Profile;
  }

  async updateProfile(updates: { fullName?: string; avatarUrl?: string; username?: string }): Promise<Profile | null> {
    const { data, error } = await this.supabase.client.rpc('update_user_profile', {
      p_full_name: updates.fullName || null,
      p_avatar_url: updates.avatarUrl || null,
      p_username: updates.username || null
    });

    if (error) {
      console.error('[DatabaseService] Error updating profile RPC:', error);
      return null;
    }
    return data as Profile;
  }

  // ----------------------------------------------------------------------------
  // 3. User Water Balance Operations
  // ----------------------------------------------------------------------------
  async getUserWaterBalance(userId: string): Promise<UserWaterBalance | null> {
    const { data, error } = await this.supabase.client
      .from('user_water_balance')
      .select('*')
      .eq('user_id', userId)
      .single();

    if (error) {
      console.error('[DatabaseService] Error fetching water balance:', error);
      return null;
    }

    const balance = data as UserWaterBalance;
    this.activeBalance.set(balance);
    return balance;
  }

  // ----------------------------------------------------------------------------
  // 4. Transactions & Adding Water Drops (SECURE RPC)
  // ----------------------------------------------------------------------------
  async addWaterDrops(
    userId: string,
    amount: number,
    source: TransactionSource = 'AD_REWARD',
    metadata: Record<string, any> = {}
  ): Promise<boolean> {
    const { data, error } = await this.supabase.client.rpc('claim_ad_reward', {
      p_amount: amount,
      p_ad_count: 1,
      p_source: source,
      p_metadata: metadata
    });

    if (error) {
      console.error('[DatabaseService] Error calling claim_ad_reward RPC:', error);
      return false;
    }

    // Refresh updated balance from database
    await this.getUserWaterBalance(userId);
    return true;
  }

  // ----------------------------------------------------------------------------
  // 5. Planted Trees & Certificates (SECURE RPC)
  // ----------------------------------------------------------------------------
  async getPlantedTrees(userId: string): Promise<PlantedTree[]> {
    const { data, error } = await this.supabase.client
      .from('planted_trees')
      .select(`
        *,
        project:eco_projects(*),
        certificate:tree_certificates(*)
      `)
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('[DatabaseService] Error fetching planted trees:', error);
      return [];
    }

    const trees = (data || []) as PlantedTree[];
    this.userPlantedTrees.set(trees);
    return trees;
  }

  async recordNewPlantedTree(userId: string, projectId?: string): Promise<PlantedTree | null> {
    const { data, error } = await this.supabase.client.rpc('plant_matured_tree', {
      p_project_id: projectId || null
    });

    if (error || !data) {
      console.error('[DatabaseService] Error calling plant_matured_tree RPC:', error);
      return null;
    }

    const newTree = data as PlantedTree;

    // Refresh trees list and balance
    await this.getPlantedTrees(userId);
    await this.getUserWaterBalance(userId);

    return newTree;
  }

  // ----------------------------------------------------------------------------
  // 6. Eco Projects & Gamification Achievements
  // ----------------------------------------------------------------------------
  async getEcoProjects(): Promise<EcoProject[]> {
    const { data, error } = await this.supabase.client
      .from('eco_projects')
      .select('*')
      .eq('is_active', true);

    if (error) {
      console.error('[DatabaseService] Error fetching projects:', error);
      return [];
    }

    const projects = (data || []) as EcoProject[];
    this.ecoProjects.set(projects);
    return projects;
  }

  async getAchievements(): Promise<Achievement[]> {
    const { data, error } = await this.supabase.client
      .from('achievements')
      .select('*');

    if (error) {
      console.error('[DatabaseService] Error fetching achievements:', error);
      return [];
    }

    const ach = (data || []) as Achievement[];
    this.achievements.set(ach);
    return ach;
  }

  async getUserAchievements(userId: string): Promise<UserAchievement[]> {
    const { data, error } = await this.supabase.client
      .from('user_achievements')
      .select('*, achievement:achievements(*)')
      .eq('user_id', userId);

    if (error) {
      console.error('[DatabaseService] Error fetching user achievements:', error);
      return [];
    }

    const userAch = (data || []) as UserAchievement[];
    this.userAchievements.set(userAch);
    return userAch;
  }

  // ----------------------------------------------------------------------------
  // 7. Public Leaderboard (SECURE RPC)
  // ----------------------------------------------------------------------------
  async getPublicLeaderboard(limit: number = 20): Promise<LeaderboardEntry[]> {
    const { data, error } = await this.supabase.client.rpc('get_public_leaderboard', {
      p_limit: limit
    });

    if (error || !data) {
      console.error('[DatabaseService] Error fetching public leaderboard RPC:', error);
      return [];
    }

    return data as LeaderboardEntry[];
  }
}
