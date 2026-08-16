import { TestBed } from '@angular/core/testing';
import { BrandLogoComponent } from './brand-logo.component';
import { provideRouter } from '@angular/router';
import { provideHttpClient } from '@angular/common/http';
import { TranslationService } from '../../services/translation.service';

describe('BrandLogoComponent', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [BrandLogoComponent],
      providers: [provideRouter([]), provideHttpClient(), TranslationService]
    }).compileComponents();
  });

  it('should create the brand logo component', () => {
    const fixture = TestBed.createComponent(BrandLogoComponent);
    const comp = fixture.componentInstance;
    expect(comp).toBeTruthy();
  });

  it('should emit clicked event when logo container is clicked', () => {
    const fixture = TestBed.createComponent(BrandLogoComponent);
    const comp = fixture.componentInstance;
    let clickedFired = false;
    comp.clicked.subscribe(() => {
      clickedFired = true;
    });

    comp.onClick();
    expect(clickedFired).toBeTrue();
  });
});
