import { TestBed } from '@angular/core/testing';
import { TreeStageComponent } from './tree-stage.component';
import { provideHttpClient } from '@angular/common/http';
import { TranslationService } from '../../services/translation.service';

describe('TreeStageComponent', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [TreeStageComponent],
      providers: [provideHttpClient(), TranslationService]
    }).compileComponents();
  });

  it('should create the tree stage component', () => {
    const fixture = TestBed.createComponent(TreeStageComponent);
    const comp = fixture.componentInstance;
    expect(comp).toBeTruthy();
  });

  it('should compute initial seed stage (0/10 drops)', () => {
    const fixture = TestBed.createComponent(TreeStageComponent);
    const comp = fixture.componentInstance;
    fixture.componentRef.setInput('currentDrops', 0);
    fixture.componentRef.setInput('maxDrops', 10);
    fixture.detectChanges();

    expect(comp.stageIndex()).toEqual(0);
    expect(comp.isMature()).toBeFalse();
  });

  it('should compute sprout stage (4/10 drops)', () => {
    const fixture = TestBed.createComponent(TreeStageComponent);
    const comp = fixture.componentInstance;
    fixture.componentRef.setInput('currentDrops', 4);
    fixture.componentRef.setInput('maxDrops', 10);
    fixture.detectChanges();

    expect(comp.stageIndex()).toEqual(1);
  });

  it('should compute young tree stage (7/10 drops)', () => {
    const fixture = TestBed.createComponent(TreeStageComponent);
    const comp = fixture.componentInstance;
    fixture.componentRef.setInput('currentDrops', 7);
    fixture.componentRef.setInput('maxDrops', 10);
    fixture.detectChanges();

    expect(comp.stageIndex()).toEqual(2);
  });

  it('should compute mature stage and 100% progress when fully watered', () => {
    const fixture = TestBed.createComponent(TreeStageComponent);
    const comp = fixture.componentInstance;
    fixture.componentRef.setInput('currentDrops', 10);
    fixture.componentRef.setInput('maxDrops', 10);
    fixture.detectChanges();

    expect(comp.stageIndex()).toEqual(3);
    expect(comp.isMature()).toBeTrue();
    expect(comp.progressPercentage()).toEqual(100);
  });

  it('should render watering can container when isWatering is true', () => {
    const fixture = TestBed.createComponent(TreeStageComponent);
    const comp = fixture.componentInstance;
    fixture.componentRef.setInput('isWatering', true);
    fixture.detectChanges();

    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('.watering-can-container')).toBeTruthy();
    expect(compiled.querySelector('.can-svg')).toBeTruthy();
    expect(compiled.querySelector('.water-drops-shower')).toBeTruthy();
  });
});
