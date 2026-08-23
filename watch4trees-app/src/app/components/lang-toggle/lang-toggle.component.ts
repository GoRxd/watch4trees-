import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TranslationService } from '../../services/translation.service';
import { TranslatePipe } from '../../pipes/translate.pipe';

@Component({
  selector: 'app-lang-toggle',
  standalone: true,
  imports: [CommonModule, TranslatePipe],
  templateUrl: './lang-toggle.component.html'
})
export class LangToggleComponent {
  i18n = inject(TranslationService);
}
