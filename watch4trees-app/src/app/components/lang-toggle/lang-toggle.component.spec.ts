import { TestBed } from '@angular/core/testing';
import { LangToggleComponent } from './lang-toggle.component';
import { provideHttpClient } from '@angular/common/http';
import { TranslationService } from '../../services/translation.service';

describe('LangToggleComponent', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [LangToggleComponent],
      providers: [provideHttpClient(), TranslationService]
    }).compileComponents();
  });

  it('should create lang toggle component', () => {
    const fixture = TestBed.createComponent(LangToggleComponent);
    const comp = fixture.componentInstance;
    expect(comp).toBeTruthy();
  });
});
