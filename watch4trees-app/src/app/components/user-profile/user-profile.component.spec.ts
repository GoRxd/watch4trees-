import { ComponentFixture, TestBed } from '@angular/core/testing';
import { UserProfileComponent } from './user-profile.component';
import { AuthService } from '../../services/auth.service';
import { TranslationService } from '../../services/translation.service';

describe('UserProfileComponent', () => {
  let component: UserProfileComponent;
  let fixture: ComponentFixture<UserProfileComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [UserProfileComponent],
      providers: [
        {
          provide: AuthService,
          useValue: {
            currentUser: () => ({ name: 'Damian', email: 'dam@test.pl' }),
            logout: jasmine.createSpy('logout')
          }
        },
        { provide: TranslationService, useValue: { currentLang: () => 'pl', translate: (k: string) => k } }
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(UserProfileComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create user profile component', () => {
    expect(component).toBeTruthy();
  });
});
