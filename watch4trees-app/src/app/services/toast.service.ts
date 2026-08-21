import { Injectable, signal, inject } from '@angular/core';
import { TranslationService } from './translation.service';

export type ToastType = 'success' | 'error' | 'warning' | 'info';

export interface ToastMessage {
  id: string;
  type: ToastType;
  title?: string;
  message: string;
  durationMs?: number;
  isClosing?: boolean;
}

@Injectable({
  providedIn: 'root'
})
export class ToastService {
  private i18n = inject(TranslationService);
  readonly toasts = signal<ToastMessage[]>([]);

  show(
    messageOrKey: string, 
    type: ToastType = 'info', 
    titleOrKey?: string, 
    durationMs: number = 4500, 
    params?: Record<string, any>
  ) {
    const id = `toast_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    
    // Resolve translation if it matches a key, with dynamic params interpolation
    const message = this.i18n.translate(messageOrKey, params);
    const title = titleOrKey ? this.i18n.translate(titleOrKey, params) : undefined;

    const newToast: ToastMessage = {
      id,
      type,
      title,
      message,
      durationMs,
      isClosing: false
    };

    this.toasts.update(current => [...current, newToast]);

    if (durationMs > 0) {
      setTimeout(() => {
        this.dismiss(id);
      }, durationMs);
    }
  }

  success(messageKey: string, titleKey?: string, params?: Record<string, any>) {
    this.show(messageKey, 'success', titleKey, 4500, params);
  }

  error(messageKey: string, titleKey?: string, params?: Record<string, any>) {
    this.show(messageKey, 'error', titleKey, 5500, params);
  }

  warning(messageKey: string, titleKey?: string, params?: Record<string, any>) {
    this.show(messageKey, 'warning', titleKey, 5000, params);
  }

  info(messageKey: string, titleKey?: string, params?: Record<string, any>) {
    this.show(messageKey, 'info', titleKey, 4500, params);
  }

  dismiss(id: string) {
    this.toasts.update(current => 
      current.map(t => t.id === id ? { ...t, isClosing: true } : t)
    );

    setTimeout(() => {
      this.remove(id);
    }, 280);
  }

  remove(id: string) {
    this.toasts.update(current => current.filter(t => t.id !== id));
  }
}

