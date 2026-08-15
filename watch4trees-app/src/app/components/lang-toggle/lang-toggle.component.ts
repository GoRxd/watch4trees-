import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TranslationService } from '../../services/translation.service';

@Component({
  selector: 'app-lang-toggle',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './lang-toggle.component.html',
  styleUrls: ['./lang-toggle.component.scss']
})
export class LangToggleComponent {
  i18n = inject(TranslationService);
}
