import { ComponentFixture, TestBed } from '@angular/core/testing';
import { AuthComponent } from './auth.component';
import { provideRouter } from '@angular/router';
import { AuthService } from '../../services/auth.service';
import { TranslationService } from '../../services/translation.service';

describe('AuthComponent', () => {
  let component: AuthComponent;
  let fixture: ComponentFixture<AuthComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AuthComponent],
      providers: [
        provideRouter([]),
        {
          provide: AuthService,
          useValue: {
            login: jasmine.createSpy('login'),
            signUp: jasmine.createSpy('signUp'),
            loginDemo: jasmine.createSpy('loginDemo'),
            loginWithGoogle: jasmine.createSpy('loginWithGoogle')
          }
        },
        { provide: TranslationService, useValue: { currentLang: () => 'pl', translate: (k: string) => k } }
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(AuthComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create auth component', () => {
    expect(component).toBeTruthy();
  });
});
