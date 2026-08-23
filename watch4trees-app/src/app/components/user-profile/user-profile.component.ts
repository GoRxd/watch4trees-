import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { NgIcon } from '@ng-icons/core';
import { AuthService } from '../../services/auth.service';
import { TranslatePipe } from '../../pipes/translate.pipe';

@Component({
  selector: 'app-user-profile',
  standalone: true,
  imports: [CommonModule, NgIcon, TranslatePipe],
  templateUrl: './user-profile.component.html'
})
export class UserProfileComponent {
  auth = inject(AuthService);

  logout() {
    this.auth.logout();
  }
}
