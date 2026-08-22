import { Injectable, inject, signal } from '@angular/core';
import { SupabaseService } from './supabase.service';
import {
  Profile,
  UserBalance,
  EcoProject,
  PlantedTree,
  Achievement,
  UserAchievement,
  SessionType,
  AdSessionStartResponse,
  AdSessionClaimResponse,
  TreeWaterResponse
} from '../models';

@Injectable({
  providedIn: 'root'
})
export class DatabaseService {
  private supabase = inject(SupabaseService);

  // Reactive state signals
  readonly activeBalance = signal<UserBalance | null>(null);
  readonly userPlantedTrees = signal<PlantedTree[]>([]);
  readonly ecoProjects = signal<EcoProject[]>([]);

  // ----------------------------------------------------------------------------
  // 1. Profile Operations (Direct Read / Safe Update)
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

  async updateProfile(userId: string, updates: { fullName?: string; avatarUrl?: string; username?: string }): Promise<boolean> {
    const payload: Record<string, any> = {};
    if (updates.fullName !== undefined) payload['full_name'] = updates.fullName;
    if (updates.avatarUrl !== undefined) payload['avatar_url'] = updates.avatarUrl;
    if (updates.username !== undefined) payload['username'] = updates.username;

    const { error } = await this.supabase.client
      .from('profiles')
      .update(payload)
      .eq('id', userId);

    if (error) {
      console.error('[DatabaseService] Error updating profile:', error);
      return false;
    }
    return true;
  }

  // ----------------------------------------------------------------------------
  // 2. User Balance (Direct Read via RLS)
  // ----------------------------------------------------------------------------
  async getUserWaterBalance(userId: string): Promise<UserBalance | null> {
    const { data, error } = await this.supabase.client
      .from('user_balance')
      .select('*')
      .eq('user_id', userId)
      .single();

    if (error) {
      console.error('[DatabaseService] Error fetching balance:', error);
      return null;
    }

    const balance = data as UserBalance;
    this.activeBalance.set(balance);
    return balance;
  }

  // ----------------------------------------------------------------------------
  // 3. Planted Trees (Direct Read via RLS)
  // ----------------------------------------------------------------------------
  async getPlantedTrees(userId: string): Promise<PlantedTree[]> {
    const { data, error } = await this.supabase.client
      .from('planted_trees')
      .select('*, project:eco_projects(*)')
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

  // ----------------------------------------------------------------------------
  // 3b. Achievements & Gamification (Direct Read via RLS)
  // [TODO_TEMPLATE: User will implement custom backend triggers / Edge Functions to evaluate and award achievements]
  // ----------------------------------------------------------------------------
  async getAchievements(): Promise<Achievement[]> {
    const { data, error } = await this.supabase.client
      .from('achievements')
      .select('*')
      .order('created_at', { ascending: true });

    if (error) {
      console.error('[DatabaseService] Error fetching achievements:', error);
      return [];
    }

    return (data || []) as Achievement[];
  }

  async getUserAchievements(userId: string): Promise<UserAchievement[]> {
    const { data, error } = await this.supabase.client
      .from('user_achievements')
      .select('*, achievement:achievements(*)')
      .eq('user_id', userId)
      .order('unlocked_at', { ascending: false });

    if (error) {
      console.error('[DatabaseService] Error fetching user achievements:', error);
      return [];
    }

    return (data || []) as UserAchievement[];
  }

  async getAchievementById(achievementId: string): Promise<Achievement | null> {
    const { data, error } = await this.supabase.client
      .from('achievements')
      .select('*')
      .eq('id', achievementId)
      .single();

    if (error) {
      console.error('[DatabaseService] Error fetching achievement by id:', error);
      return null;
    }

    return data as Achievement;
  }

  // ----------------------------------------------------------------------------
  // 4. Secure Rewarded Ads Flow (Supabase Edge Functions)
  // ----------------------------------------------------------------------------
  async startAdSession(sessionType: SessionType): Promise<AdSessionStartResponse> {
    try {
      const { data, error } = await this.supabase.client.functions.invoke<AdSessionStartResponse>(
        'ad-session-start',
        { body: { sessionType } }
      );

      if (error) {
        let errorBody: any = null;
        if ((error as any).context && typeof (error as any).context.json === 'function') {
          try {
            errorBody = await (error as any).context.json();
          } catch (_) {}
        }
        return errorBody ?? { success: false, error: error.message };
      }

      return data ?? { success: false, error: 'Empty response from server' };
    } catch (err: any) {
      console.error('[DatabaseService] Exception in startAdSession:', err);
      return { success: false, error: err.message };
    }
  }

  async claimAdReward(sessionToken: string, selectedOptionId: string): Promise<AdSessionClaimResponse> {
    try {
      const { data, error } = await this.supabase.client.functions.invoke<AdSessionClaimResponse>(
        'ad-session-claim',
        { body: { sessionToken, selectedOptionId } }
      );

      if (error) {
        let errorBody: any = null;
        if ((error as any).context && typeof (error as any).context.json === 'function') {
          try {
            errorBody = await (error as any).context.json();
          } catch (_) {}
        }
        
        if (errorBody) {
          return {
            success: false,
            error: errorBody.error || error.message,
            quizVerified: errorBody.quizVerified,
            ...errorBody
          };
        }

        return { success: false, error: error.message };
      }

      if (data?.success && data.current_drops !== undefined) {
        const current = this.activeBalance();
        if (current) {
          this.activeBalance.set({
            ...current,
            current_drops: data.current_drops,
            eco_points: data.eco_points ?? current.eco_points,
            total_drops_earned: data.total_drops_earned ?? current.total_drops_earned
          });
        }
      }

      return data ?? { success: false, error: 'Empty response from server' };
    } catch (err: any) {
      console.error('[DatabaseService] Exception in claimAdReward:', err);
      return { success: false, error: err.message };
    }
  }

  // ----------------------------------------------------------------------------
  // 5. Tree Watering & Planting Engine (Supabase Edge Function)
  // ----------------------------------------------------------------------------
  async waterActiveTree(drops: number = 1, projectId?: string): Promise<TreeWaterResponse> {
    try {
      const { data, error } = await this.supabase.client.functions.invoke<TreeWaterResponse>(
        'tree-water',
        { body: { drops, projectId } }
      );

      if (error) {
        let errorBody: any = null;
        if ((error as any).context && typeof (error as any).context.json === 'function') {
          try {
            errorBody = await (error as any).context.json();
          } catch (_) {}
        }
        return errorBody ?? { success: false, error: error.message };
      }

      if (data?.success && data.current_drops !== undefined) {
        const current = this.activeBalance();
        if (current) {
          this.activeBalance.set({
            ...current,
            current_drops: data.current_drops,
            active_tree_drops: data.active_tree_drops ?? current.active_tree_drops,
            eco_points: data.eco_points ?? current.eco_points,
            total_trees_planted: data.total_trees_planted ?? current.total_trees_planted,
            total_co2_offset_kg: data.total_co2_offset_kg ?? current.total_co2_offset_kg
          });
        }

        if (data.tree_planted_now && data.new_tree) {
          this.userPlantedTrees.update(trees => [data.new_tree!, ...trees]);
        }
      }

      return data ?? { success: false, error: 'Empty response from server' };
    } catch (err: any) {
      console.error('[DatabaseService] Exception in waterActiveTree:', err);
      return { success: false, error: err.message };
    }
  }

  // ----------------------------------------------------------------------------
  // 6. Server-Side Auth Rate Limiting & Lockout Management
  // ----------------------------------------------------------------------------
  async checkAuthLockout(email?: string): Promise<{ allowed: boolean; lockoutRemainingSeconds?: number; message?: string }> {
    try {
      const { data, error } = await this.supabase.client.functions.invoke<{ allowed: boolean; lockoutRemainingSeconds?: number; message?: string }>(
        'auth-attempt',
        { body: { email, action: 'check' } }
      );

      if (error) {
        let errorBody: any = null;
        if ((error as any).context && typeof (error as any).context.json === 'function') {
          try {
            errorBody = await (error as any).context.json();
          } catch (_) {}
        }
        if (errorBody) return errorBody;
      }

      return data ?? { allowed: true, lockoutRemainingSeconds: 0 };
    } catch (err) {
      console.error('[DatabaseService] Exception in checkAuthLockout:', err);
      return { allowed: true, lockoutRemainingSeconds: 0 };
    }
  }

  async recordAuthAttempt(email: string, isSuccess: boolean): Promise<{ allowed: boolean; lockoutRemainingSeconds?: number; message?: string }> {
    try {
      const action = isSuccess ? 'record_success' : 'record_failed';
      const { data, error } = await this.supabase.client.functions.invoke<{ allowed: boolean; lockoutRemainingSeconds?: number; message?: string }>(
        'auth-attempt',
        { body: { email, action } }
      );

      if (error) {
        let errorBody: any = null;
        if ((error as any).context && typeof (error as any).context.json === 'function') {
          try {
            errorBody = await (error as any).context.json();
          } catch (_) {}
        }
        if (errorBody) return errorBody;
      }

      return data ?? { allowed: true, lockoutRemainingSeconds: 0 };
    } catch (err) {
      console.error('[DatabaseService] Exception in recordAuthAttempt:', err);
      return { allowed: true, lockoutRemainingSeconds: 0 };
    }
  }
}
