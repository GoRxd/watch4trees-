import { TestBed } from '@angular/core/testing';
import { UserHudComponent } from './user-hud.component';
import { provideHttpClient } from '@angular/common/http';
import { TranslationService } from '../../services/translation.service';

describe('UserHudComponent', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [UserHudComponent],
      providers: [provideHttpClient(), TranslationService]
    }).compileComponents();
  });

  it('should create user HUD component', () => {
    const fixture = TestBed.createComponent(UserHudComponent);
    const comp = fixture.componentInstance;
    expect(comp).toBeTruthy();
  });

  it('should default to full mode when not specified', () => {
    const fixture = TestBed.createComponent(UserHudComponent);
    const comp = fixture.componentInstance;
    expect(comp.mode).toEqual('full');
  });
});
