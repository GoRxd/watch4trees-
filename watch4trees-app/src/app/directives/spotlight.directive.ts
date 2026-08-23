import { Directive, ElementRef, OnDestroy, inject } from '@angular/core';

/**
 * Spotlight: pointer-tracked radial highlight for cards using .spotlight-card.
 * Writes --mx/--my custom properties (percentages) on pointermove; pure CSS paints it.
 */
@Directive({
  selector: '[appSpotlight]',
  standalone: true
})
export class SpotlightDirective implements OnDestroy {
  private el = inject(ElementRef<HTMLElement>);

  constructor() {
    const node = this.el.nativeElement as HTMLElement;
    node.addEventListener('pointermove', this.onMove);
    node.addEventListener('pointerleave', this.onLeave);
  }

  private onMove = (event: PointerEvent) => {
    const node = this.el.nativeElement as HTMLElement;
    const rect = node.getBoundingClientRect();
    node.style.setProperty('--mx', `${((event.clientX - rect.left) / rect.width) * 100}%`);
    node.style.setProperty('--my', `${((event.clientY - rect.top) / rect.height) * 100}%`);
  };

  private onLeave = () => {
    const node = this.el.nativeElement as HTMLElement;
    node.style.setProperty('--mx', '50%');
    node.style.setProperty('--my', '50%');
  };

  ngOnDestroy(): void {
    const node = this.el.nativeElement as HTMLElement;
    node.removeEventListener('pointermove', this.onMove);
    node.removeEventListener('pointerleave', this.onLeave);
  }
}
