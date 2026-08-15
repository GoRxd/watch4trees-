import { Injectable, signal, computed } from '@angular/core';
import { Router } from '@angular/router';
import { User } from '../models';
import { SafeStorage } from '../utils/storage.helper';
import { STORAGE_KEYS } from '../constants';

export type { User } from '../models';

const DEFAULT_DEMO_USER: User = {
  id: 'usr-demo-001',
  email: 'ekolog@watch4trees.org',
  name: 'Damian (Eko-Ogrodnik)',
  avatar: '👨‍🌾',
  ecoPoints: 340,
  waterDrops: 7,
  treesPlanted: 18,
  activeStreak: 6,
  dailyLimitRemaining: 12,
  targetFoundation: 'Posadzimy.pl'
};

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  // Current user signal
  currentUser = signal<User | null>(this.loadStoredUser());

  // Computed auth status
  isAuthenticated = computed(() => !!this.currentUser());

  constructor(private router: Router) {}

  private loadStoredUser(): User | null {
    return SafeStorage.getJSON<User>(STORAGE_KEYS.USER);
  }

  private saveUser(user: User | null) {
    this.currentUser.set(user);
    SafeStorage.setJSON(STORAGE_KEYS.USER, user);
  }

  private authenticate(user: User, redirectUrl: string = '/dashboard'): boolean {
    this.saveUser(user);
    this.router.navigate([redirectUrl]);
    return true;
  }

  // [TODO_TEMPLATE: Connect to real backend / OAuth (Google / Email Auth)]
  login(email: string, pass: string): boolean {
    const user: User = {
      ...DEFAULT_DEMO_USER,
      email: email,
      name: email.split('@')[0] || 'Eko-Aktywista'
    };
    return this.authenticate(user);
  }

  loginWithGoogle() {
    this.authenticate({
      ...DEFAULT_DEMO_USER,
      email: 'damian.google@gmail.com',
      name: 'Damian G.'
    });
  }

  loginDemo() {
    this.authenticate(DEFAULT_DEMO_USER);
  }

  logout() {
    this.saveUser(null);
    this.router.navigate(['/']);
  }

  // Update user state after watering / ad completion
  updateUser(updates: Partial<User>) {
    const current = this.currentUser();
    if (current) {
      const updated: User = { ...current, ...updates };
      this.saveUser(updated);
    }
  }
}
