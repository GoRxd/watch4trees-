import { Directive, ElementRef, OnDestroy, OnInit, inject, input, numberAttribute } from '@angular/core';

/**
 * Scroll-reveal: element fades/slides in the first time it enters the viewport.
 * Usage: appReveal [revealDelay]="120"
 * Collapses to static under prefers-reduced-motion (see components.css .reveal rules).
 */
@Directive({
  selector: '[appReveal]',
  standalone: true
})
export class RevealDirective implements OnInit, OnDestroy {
  private el = inject(ElementRef<HTMLElement>);
  private observer: IntersectionObserver | null = null;

  revealDelay = input(0, { transform: numberAttribute });

  ngOnInit(): void {
    const node = this.el.nativeElement as HTMLElement;
    node.classList.add('reveal');
    if (this.revealDelay() > 0) {
      node.style.setProperty('--reveal-delay', `${this.revealDelay()}ms`);
    }

    // No IntersectionObserver (or reduced motion): show immediately.
    if (typeof IntersectionObserver === 'undefined' || !node.animate) {
      node.classList.add('reveal-in');
      return;
    }

    this.observer = new IntersectionObserver(
      entries => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            node.classList.add('reveal-in');
            this.observer?.disconnect();
            this.observer = null;
          }
        }
      },
      { threshold: 0.15, rootMargin: '0px 0px -40px 0px' }
    );
    this.observer.observe(node);
  }

  ngOnDestroy(): void {
    this.observer?.disconnect();
  }
}
