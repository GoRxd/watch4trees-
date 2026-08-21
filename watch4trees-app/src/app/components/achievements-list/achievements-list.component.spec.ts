import { ComponentFixture, TestBed } from '@angular/core/testing';
import { AchievementsListComponent } from './achievements-list.component';
import { DatabaseService } from '../../services/database.service';
import { AuthService } from '../../services/auth.service';
import { TranslationService } from '../../services/translation.service';

describe('AchievementsListComponent', () => {
  let component: AchievementsListComponent;
  let fixture: ComponentFixture<AchievementsListComponent>;

  const mockDbService = {
    getAchievements: jasmine.createSpy('getAchievements').and.returnValue(Promise.resolve([
      { id: 'first_seed', title: 'Pierwsze Nasiono', description: 'Test', icon_name: '🌰', category: 'onboarding' }
    ])),
    getUserAchievements: jasmine.createSpy('getUserAchievements').and.returnValue(Promise.resolve([
      { user_id: 'user-1', achievement_id: 'first_seed', unlocked_at: new Date().toISOString() }
    ]))
  };

  const mockAuthService = {
    currentUser: jasmine.createSpy('currentUser').and.returnValue({ id: 'user-1', name: 'Test' })
  };

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AchievementsListComponent],
      providers: [
        { provide: DatabaseService, useValue: mockDbService },
        { provide: AuthService, useValue: mockAuthService },
        { provide: TranslationService, useValue: { currentLang: () => 'pl', translate: (k: string) => k } }
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(AchievementsListComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create achievements list component', () => {
    expect(component).toBeTruthy();
  });
});
