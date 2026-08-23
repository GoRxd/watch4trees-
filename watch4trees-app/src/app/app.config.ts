import { ApplicationConfig, provideZoneChangeDetection } from '@angular/core';
import { provideRouter } from '@angular/router';
import { provideHttpClient, withFetch } from '@angular/common/http';
import { provideIcons, provideNgIconsConfig } from '@ng-icons/core';
import { routes } from './app.routes';
import { APP_ICONS } from './icons/app-icons';

export const appConfig: ApplicationConfig = {
  providers: [
    provideZoneChangeDetection({ eventCoalescing: true }),
    provideRouter(routes),
    provideHttpClient(withFetch()),
    provideIcons(APP_ICONS),
    // ng-icon renders at 1em by default (tiny in most contexts); component-level
    // width/height utilities lose the specificity tie to :host rules, so the
    // global default must come from the library config, not CSS classes.
    provideNgIconsConfig({ size: '1.3em' })
  ]
};
