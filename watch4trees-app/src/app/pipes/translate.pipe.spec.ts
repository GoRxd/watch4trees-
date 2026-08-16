import { TestBed } from '@angular/core/testing';
import { TranslatePipe } from './translate.pipe';
import { TranslationService } from '../services/translation.service';
import { provideHttpClient } from '@angular/common/http';

describe('TranslatePipe', () => {
  let pipe: TranslatePipe;
  let translationService: TranslationService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), TranslationService, TranslatePipe]
    });
    translationService = TestBed.inject(TranslationService);
    pipe = TestBed.inject(TranslatePipe);
  });

  it('should create the pipe', () => {
    expect(pipe).toBeTruthy();
  });

  it('should return key fallback if translation dictionary is not yet loaded', () => {
    const res = pipe.transform('nav.dashboard');
    expect(res).toBeDefined();
  });
});
