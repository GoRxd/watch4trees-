/**
 * Safe local storage utility with SSR safeguards and JSON serialization
 */
export class SafeStorage {
  private static isAvailable(): boolean {
    return typeof window !== 'undefined' && !!window.localStorage;
  }

  static getItem(key: string): string | null {
    if (!this.isAvailable()) return null;
    try {
      return window.localStorage.getItem(key);
    } catch {
      return null;
    }
  }

  static setItem(key: string, value: string): void {
    if (!this.isAvailable()) return;
    try {
      window.localStorage.setItem(key, value);
    } catch (e) {
      console.warn(`SafeStorage: could not set item for key "${key}"`, e);
    }
  }

  static removeItem(key: string): void {
    if (!this.isAvailable()) return;
    try {
      window.localStorage.removeItem(key);
    } catch (e) {
      console.warn(`SafeStorage: could not remove item for key "${key}"`, e);
    }
  }

  static getJSON<T>(key: string, fallback: T | null = null): T | null {
    const raw = this.getItem(key);
    if (!raw) return fallback;
    try {
      return JSON.parse(raw) as T;
    } catch {
      return fallback;
    }
  }

  static setJSON<T>(key: string, value: T | null): void {
    if (value === null || value === undefined) {
      this.removeItem(key);
    } else {
      this.setItem(key, JSON.stringify(value));
    }
  }
}
