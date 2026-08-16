import { Injectable, signal, computed, inject } from '@angular/core';
import { Router } from '@angular/router';
import { User } from '../models';
import { SafeStorage } from '../utils/storage.helper';
import { STORAGE_KEYS, ECO_METRICS } from '../constants';
import { SupabaseService } from './supabase.service';

export type { User } from '../models';

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  private router = inject(Router);
  private supabase = inject(SupabaseService);

  // Current user signal
  currentUser = signal<User | null>(this.loadStoredUser());

  // Computed auth status
  isAuthenticated = computed(() => !!this.currentUser());

  constructor() {
    this.initAuthStateListener();
  }

  private loadStoredUser(): User | null {
    return SafeStorage.getJSON<User>(STORAGE_KEYS.USER);
  }

  private saveUser(user: User | null) {
    this.currentUser.set(user);
    SafeStorage.setJSON(STORAGE_KEYS.USER, user);
  }

  private async initAuthStateListener() {
    this.supabase.auth.onAuthStateChange(async (event, session) => {
      if (session?.user) {
        await this.syncUserFromDatabase(session.user);
      } else if (event === 'SIGNED_OUT') {
        this.saveUser(null);
      }
    });
  }

  private async syncUserFromDatabase(authUser: any): Promise<User> {
    const userId = authUser.id;

    // 1. Fetch profile from database
    const { data: profile } = await this.supabase.client
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single();

    // 2. Fetch user balance from database
    const { data: balance } = await this.supabase.client
      .from('user_balance')
      .select('*')
      .eq('user_id', userId)
      .single();

    const userMeta = authUser.user_metadata || {};
    const user: User = {
      id: userId,
      email: authUser.email || '',
      name: profile?.full_name || profile?.username || userMeta['full_name'] || authUser.email?.split('@')[0] || 'Eko-Hero',
      avatar: profile?.avatar_url || userMeta['avatar_url'] || '👨‍🌾',
      ecoPoints: balance?.eco_points ?? 0,
      waterDrops: balance?.current_drops ?? 0,
      treesPlanted: balance?.total_trees_planted ?? 0,
      activeStreak: profile?.streak_days ?? 1,
      dailyLimitRemaining: Math.max(0, ECO_METRICS.DEFAULT_DAILY_LIMIT - (profile?.daily_watched_count || 0)),
      targetFoundation: 'Posadzimy.pl'
    };

    this.saveUser(user);
    return user;
  }

  async login(email: string, pass: string): Promise<{ success: boolean; error?: string }> {
    const { data, error } = await this.supabase.auth.signInWithPassword({
      email,
      password: pass
    });

    if (error) {
      console.error('[AuthService] Login error:', error.message);
      return { success: false, error: error.message };
    }

    if (data.user) {
      const user = await this.syncUserFromDatabase(data.user);
      this.router.navigate(['/dashboard']);
      return { success: true };
    }

    return { success: false, error: 'Unknown login error' };
  }

  async signUp(email: string, pass: string, username?: string): Promise<{ success: boolean; error?: string }> {
    const displayName = username || email.split('@')[0];
    const { data, error } = await this.supabase.auth.signUp({
      email,
      password: pass,
      options: {
        data: {
          username: displayName,
          full_name: displayName,
          avatar_url: '👨‍🌾'
        }
      }
    });

    if (error) {
      console.error('[AuthService] Sign up error:', error.message);
      return { success: false, error: error.message };
    }

    if (data.user) {
      // Auto login after sign up
      await this.syncUserFromDatabase(data.user);
      this.router.navigate(['/dashboard']);
      return { success: true };
    }

    return { success: false, error: 'Unknown sign up error' };
  }

  async loginWithGoogle() {
    await this.supabase.auth.signInWithOAuth({
      provider: 'google'
    });
  }

  async loginDemo(): Promise<{ success: boolean; error?: string }> {
    // Authenticate with seeded demo user credentials
    return this.login('ekolog@watch4trees.org', 'demoPassword123!');
  }

  async logout() {
    await this.supabase.auth.signOut();
    this.saveUser(null);
    this.router.navigate(['/']);
  }

  // Update user state locally and in database
  updateUser(updates: Partial<User>) {
    const current = this.currentUser();
    if (current) {
      const updated: User = { ...current, ...updates };
      this.saveUser(updated);
    }
  }
}
