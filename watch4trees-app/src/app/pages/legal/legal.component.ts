import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { NgIcon } from '@ng-icons/core';
import { TranslatePipe } from '../../pipes/translate.pipe';
import { LangToggleComponent } from '../../components/lang-toggle/lang-toggle.component';

type LegalPage = 'privacy' | 'terms';

@Component({
  selector: 'app-legal',
  standalone: true,
  imports: [CommonModule, RouterLink, NgIcon, TranslatePipe, LangToggleComponent],
  templateUrl: './legal.component.html'
})
export class LegalComponent {
  private route = inject(ActivatedRoute);

  page: LegalPage = this.route.snapshot.data['legalPage'] === 'terms' ? 'terms' : 'privacy';

  readonly paragraphs: Record<LegalPage, string[]> = {
    privacy: ['legal.privacyIntro', 'legal.privacyData', 'legal.privacyAds'],
    terms: ['legal.termsIntro', 'legal.termsUse', 'legal.termsImpact']
  };

  get titleKey(): string {
    return this.page === 'terms' ? 'legal.termsTitle' : 'legal.privacyTitle';
  }
}
