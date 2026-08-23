import { Directive, ElementRef, OnDestroy, OnInit, inject, input, numberAttribute } from '@angular/core';

/**
 * Count-up: animates an element's textContent from 0 to `countUp` on first view.
 * Numbers keep their formatted separators; honors prefers-reduced-motion (jumps instantly).
 * Usage: <span [countUp]="142850" countUpSuffix="+">0</span>
 */
@Directive({
  selector: '[appCountUp]',
  standalone: true
})
export class CountUpDirective implements OnInit, OnDestroy {
  private el = inject(ElementRef<HTMLElement>);
  private observer: IntersectionObserver | null = null;
  private rafId = 0;

  /** Target value. Non-numeric targets render untouched. */
  countUp = input.required({ transform: numberAttribute });
  countUpSuffix = input('');
  countUpDurationMs = input(1400, { transform: numberAttribute });

  ngOnInit(): void {
    const node = this.el.nativeElement as HTMLElement;
    const target = Number(this.countUp());
    if (!Number.isFinite(target)) {
      return;
    }

    const reduceMotion =
      typeof matchMedia !== 'undefined' &&
      matchMedia('(prefers-reduced-motion: reduce)').matches;

    const render = (value: number) => {
      node.textContent = `${Math.round(value).toLocaleString('pl-PL')}${this.countUpSuffix()}`;
    };

    if (reduceMotion || typeof IntersectionObserver === 'undefined') {
      render(target);
      return;
    }

    node.textContent = `0${this.countUpSuffix()}`;

    this.observer = new IntersectionObserver(
      entries => {
        if (!entries.some(e => e.isIntersecting)) {
          return;
        }
        this.observer?.disconnect();
        this.observer = null;

        const duration = Math.max(200, this.countUpDurationMs());
        const start = performance.now();
        const tick = (now: number) => {
          const t = Math.min(1, (now - start) / duration);
          const eased = 1 - Math.pow(1 - t, 3);
          render(target * eased);
          if (t < 1) {
            this.rafId = requestAnimationFrame(tick);
          }
        };
        this.rafId = requestAnimationFrame(tick);
      },
      { threshold: 0.4 }
    );
    this.observer.observe(node);
  }

  ngOnDestroy(): void {
    cancelAnimationFrame(this.rafId);
    this.observer?.disconnect();
  }
}
