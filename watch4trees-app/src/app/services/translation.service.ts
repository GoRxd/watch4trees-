import { Injectable, signal, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Language } from '../models';
import { SafeStorage } from '../utils/storage.helper';
import { STORAGE_KEYS } from '../constants';

export type { Language } from '../models';

@Injectable({
  providedIn: 'root'
})
export class TranslationService {
  private http = inject(HttpClient);

  // In-memory cache for loaded language dictionaries
  private cache = new Map<Language, any>();

  // Current active language signal
  currentLang = signal<Language>(this.detectInitialLanguage());

  // Reactive translations dictionary signal (updates when new JSON is loaded)
  translations = signal<any>({});

  // Loading state
  isLoading = signal<boolean>(false);

  constructor() {
    // Initial load
    this.loadLanguage(this.currentLang());
  }

  private detectInitialLanguage(): Language {
    const saved = SafeStorage.getItem(STORAGE_KEYS.LANG) as Language | null;
    if (saved && (saved === 'pl' || saved === 'en')) {
      return saved;
    }
    if (typeof navigator !== 'undefined') {
      const browserLang = navigator.language?.toLowerCase() || '';
      if (browserLang.startsWith('pl')) {
        return 'pl';
      }
      return 'en';
    }
    return 'pl';
  }

  /**
   * Load JSON translations file from /i18n/{lang}.json
   */
  loadLanguage(lang: Language) {
    this.isLoading.set(true);

    if (this.cache.has(lang)) {
      this.translations.set(this.cache.get(lang));
      this.currentLang.set(lang);
      this.isLoading.set(false);
      return;
    }

    this.http.get<any>(`/i18n/${lang}.json`).subscribe({
      next: (data) => {
        this.cache.set(lang, data);
        this.translations.set(data);
        this.currentLang.set(lang);
        this.isLoading.set(false);
      },
      error: (err) => {
        console.error(`Failed to load translation file for ${lang}`, err);
        this.isLoading.set(false);
      }
    });
  }

  /**
   * Set and persist active language
   */
  setLanguage(lang: Language) {
    this.loadLanguage(lang);
    SafeStorage.setItem(STORAGE_KEYS.LANG, lang);
  }

  /**
   * Toggle between PL and EN
   */
  toggleLanguage() {
    const nextLang: Language = this.currentLang() === 'pl' ? 'en' : 'pl';
    this.setLanguage(nextLang);
  }

  /**
   * Translate a dotted key with optional parameters
   * Example: translate('hero.title1') or translate('greeting', { name: 'Jan' })
   */
  translate(key: string, params?: Record<string, any>): string {
    const dict = this.translations();
    if (!dict || !key) return key;

    const keys = key.split('.');
    let value: any = dict;

    for (const k of keys) {
      if (value && typeof value === 'object' && k in value) {
        value = value[k];
      } else {
        return key; // fallback to key itself if not found
      }
    }

    if (typeof value !== 'string') {
      return key;
    }

    if (params) {
      return Object.entries(params).reduce((acc, [pKey, pVal]) => {
        return acc.replace(new RegExp(`{{\\s*${pKey}\\s*}}`, 'g'), String(pVal));
      }, value);
    }

    return value;
  }

  /**
   * Short alias for template bindings: t('hero.title1')
   */
  t(key: string, params?: Record<string, any>): string {
    return this.translate(key, params);
  }
}
