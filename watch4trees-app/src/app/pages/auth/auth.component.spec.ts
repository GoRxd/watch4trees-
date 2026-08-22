import { ComponentFixture, TestBed, fakeAsync, tick } from '@angular/core/testing';
import { AuthComponent } from './auth.component';
import { provideRouter } from '@angular/router';
import { AuthService } from '../../services/auth.service';
import { DatabaseService } from '../../services/database.service';
import { TranslationService } from '../../services/translation.service';
import { SafeStorage } from '../../utils/storage.helper';

describe('AuthComponent', () => {
  let component: AuthComponent;
  let fixture: ComponentFixture<AuthComponent>;
  let mockAuthService: any;
  let mockDatabaseService: any;

  beforeEach(async () => {
    localStorage.clear();
    mockAuthService = {
      login: jasmine.createSpy('login').and.returnValue(Promise.resolve({ success: false, error: 'Invalid credentials' })),
      signUp: jasmine.createSpy('signUp').and.returnValue(Promise.resolve({ success: false, error: 'Signup error' })),
      loginDemo: jasmine.createSpy('loginDemo').and.returnValue(Promise.resolve({ success: true })),
      loginWithGoogle: jasmine.createSpy('loginWithGoogle')
    };

    mockDatabaseService = {
      checkAuthLockout: jasmine.createSpy('checkAuthLockout').and.returnValue(Promise.resolve({ allowed: true, lockoutRemainingSeconds: 0 })),
      recordAuthAttempt: jasmine.createSpy('recordAuthAttempt').and.returnValue(Promise.resolve({ allowed: true, lockoutRemainingSeconds: 0 }))
    };

    await TestBed.configureTestingModule({
      imports: [AuthComponent],
      providers: [
        provideRouter([]),
        { provide: AuthService, useValue: mockAuthService },
        { provide: DatabaseService, useValue: mockDatabaseService },
        { provide: TranslationService, useValue: { currentLang: () => 'pl', translate: (k: string) => k } }
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(AuthComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  afterEach(() => {
    localStorage.clear();
  });

  it('should create auth component', () => {
    expect(component).toBeTruthy();
  });

  it('should restore active lockout from SafeStorage on init without making backend calls', fakeAsync(() => {
    const futureLockoutUntil = Date.now() + 45000;
    SafeStorage.setJSON('w4t_auth_lockout', { lockoutUntil: futureLockoutUntil });

    const newFixture = TestBed.createComponent(AuthComponent);
    const newComponent = newFixture.componentInstance;
    newFixture.detectChanges();
    tick();

    expect(newComponent.lockoutRemaining()).toBeGreaterThanOrEqual(44);
    expect(mockDatabaseService.checkAuthLockout).not.toHaveBeenCalled();
    newComponent.ngOnDestroy();
  }));

  it('should activate lockout when server rejects with penalty in PostgreSQL', fakeAsync(() => {
    mockDatabaseService.recordAuthAttempt.and.returnValue(Promise.resolve({
      allowed: false,
      lockoutRemainingSeconds: 60,
      message: 'Zbyt wiele nieudanych prób logowania.'
    }));

    component.emailInput.set('test@example.com');
    component.passwordInput.set('wrong-pass');

    component.submitAuth(new Event('submit'));
    tick();

    expect(component.lockoutRemaining()).toBe(60);
    // Cached to SafeStorage
    const saved = SafeStorage.getJSON<{ lockoutUntil: number }>('w4t_auth_lockout');
    expect(saved?.lockoutUntil).toBeDefined();

    // Tick 20s
    tick(20000);
    expect(component.lockoutRemaining()).toBe(40);

    // Tick remaining 40s
    tick(40000);
    expect(component.lockoutRemaining()).toBe(0);
  }));

  it('should clear local lockout and notify backend on successful login', fakeAsync(() => {
    mockAuthService.login.and.returnValue(Promise.resolve({ success: true }));
    mockDatabaseService.recordAuthAttempt.and.returnValue(Promise.resolve({ allowed: true, lockoutRemainingSeconds: 0 }));

    SafeStorage.setJSON('w4t_auth_lockout', { lockoutUntil: Date.now() + 10000 });

    component.emailInput.set('valid@example.com');
    component.passwordInput.set('valid-password');

    component.submitAuth(new Event('submit'));
    tick();

    expect(mockDatabaseService.recordAuthAttempt).toHaveBeenCalledWith('valid@example.com', true);
    expect(component.lockoutRemaining()).toBe(0);
    expect(SafeStorage.getJSON('w4t_auth_lockout')).toBeNull();
  }));
});
