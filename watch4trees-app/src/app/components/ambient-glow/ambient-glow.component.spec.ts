import { ComponentFixture, TestBed } from '@angular/core/testing';
import { AmbientGlowComponent } from './ambient-glow.component';

describe('AmbientGlowComponent', () => {
  let component: AmbientGlowComponent;
  let fixture: ComponentFixture<AmbientGlowComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AmbientGlowComponent]
    }).compileComponents();

    fixture = TestBed.createComponent(AmbientGlowComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create ambient glow component', () => {
    expect(component).toBeTruthy();
  });
});
