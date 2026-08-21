import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MobileDrawerComponent } from './mobile-drawer.component';
import { provideRouter } from '@angular/router';
import { AuthService } from '../../services/auth.service';
import { TranslationService } from '../../services/translation.service';

describe('MobileDrawerComponent', () => {
  let component: MobileDrawerComponent;
  let fixture: ComponentFixture<MobileDrawerComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [MobileDrawerComponent],
      providers: [
        provideRouter([]),
        { provide: AuthService, useValue: { currentUser: () => null, isAuthenticated: () => false, logout: jasmine.createSpy('logout') } },
        { provide: TranslationService, useValue: { currentLang: () => 'pl', translate: (k: string) => k } }
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(MobileDrawerComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create mobile drawer component', () => {
    expect(component).toBeTruthy();
  });
});
