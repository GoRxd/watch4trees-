import { ComponentFixture, TestBed } from '@angular/core/testing';
import { WatchComponent } from './watch.component';
import { provideRouter } from '@angular/router';
import { AuthService } from '../../services/auth.service';
import { DatabaseService } from '../../services/database.service';
import { TranslationService } from '../../services/translation.service';
import { ToastService } from '../../services/toast.service';

describe('WatchComponent', () => {
  let component: WatchComponent;
  let fixture: ComponentFixture<WatchComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [WatchComponent],
      providers: [
        provideRouter([]),
        {
          provide: AuthService,
          useValue: {
            currentUser: () => ({ id: 'user-1', name: 'Damian', waterDrops: 5, ecoPoints: 100, treesPlanted: 2 }),
            updateUser: jasmine.createSpy('updateUser')
          }
        },
        {
          provide: DatabaseService,
          useValue: {
            startAdSession: jasmine.createSpy('startAdSession').and.returnValue(Promise.resolve({ success: true })),
            claimAdReward: jasmine.createSpy('claimAdReward').and.returnValue(Promise.resolve({ success: true }))
          }
        },
        { provide: ToastService, useValue: { success: jasmine.createSpy('success'), error: jasmine.createSpy('error') } },
        { provide: TranslationService, useValue: { currentLang: () => 'pl', translate: (k: string) => k } }
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(WatchComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create watch component', () => {
    expect(component).toBeTruthy();
  });
});
