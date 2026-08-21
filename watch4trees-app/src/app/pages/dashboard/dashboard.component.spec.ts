import { ComponentFixture, TestBed } from '@angular/core/testing';
import { DashboardComponent } from './dashboard.component';
import { provideRouter } from '@angular/router';
import { AuthService } from '../../services/auth.service';
import { DatabaseService } from '../../services/database.service';
import { TranslationService } from '../../services/translation.service';
import { ToastService } from '../../services/toast.service';

describe('DashboardComponent', () => {
  let component: DashboardComponent;
  let fixture: ComponentFixture<DashboardComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [DashboardComponent],
      providers: [
        provideRouter([]),
        {
          provide: AuthService,
          useValue: {
            currentUser: () => ({ id: 'user-1', name: 'Damian', waterDrops: 5, ecoPoints: 100, treesPlanted: 2, dailyLimitRemaining: 15 }),
            updateUser: jasmine.createSpy('updateUser')
          }
        },
        {
          provide: DatabaseService,
          useValue: {
            getUserWaterBalance: jasmine.createSpy('getUserWaterBalance').and.returnValue(Promise.resolve({ active_tree_drops: 3 })),
            getPlantedTrees: jasmine.createSpy('getPlantedTrees').and.returnValue(Promise.resolve([])),
            getAchievements: jasmine.createSpy('getAchievements').and.returnValue(Promise.resolve([])),
            getUserAchievements: jasmine.createSpy('getUserAchievements').and.returnValue(Promise.resolve([]))
          }
        },
        { provide: ToastService, useValue: { warning: jasmine.createSpy('warning'), error: jasmine.createSpy('error') } },
        { provide: TranslationService, useValue: { currentLang: () => 'pl', translate: (k: string) => k } }
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(DashboardComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create dashboard component', () => {
    expect(component).toBeTruthy();
  });
});
