import { Component, Input, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AuthService } from '../../services/auth.service';
import { TranslatePipe } from '../../pipes/translate.pipe';

@Component({
  selector: 'app-user-hud',
  standalone: true,
  imports: [CommonModule, TranslatePipe],
  templateUrl: './user-hud.component.html',
  styleUrls: ['./user-hud.component.scss']
})
export class UserHudComponent {
  auth = inject(AuthService);

  @Input() mode: 'full' | 'compact' = 'full';
  @Input() showStreak: boolean = true;
}
