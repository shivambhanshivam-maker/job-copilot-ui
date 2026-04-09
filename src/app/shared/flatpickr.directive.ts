import {
  Directive, ElementRef, EventEmitter, Input,
  OnChanges, OnDestroy, OnInit, Output, PLATFORM_ID, inject
} from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import flatpickr from 'flatpickr';

@Directive({ selector: '[appFlatpickr]', standalone: true })
export class FlatpickrDirective implements OnInit, OnChanges, OnDestroy {
  @Input() fpValue: string | null = null;
  @Output() fpChange = new EventEmitter<string | null>();
  @Output() fpClose = new EventEmitter<void>();

  private fp: any;
  private readonly el = inject(ElementRef);
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));

  ngOnInit(): void {
    if (!this.isBrowser) return;
    this.fp = flatpickr(this.el.nativeElement, {
      enableTime: true,
      dateFormat: 'Y-m-dTH:i:S',
      time_24hr: true,
      appendTo: document.body,
      defaultDate: this.fpValue ?? undefined,
      onChange: (dates: Date[]) => {
        if (dates.length) {
          this.fpChange.emit(dates[0].toISOString());
        } else {
          this.fpChange.emit(null);
        }
      },
      onClose: () => {
        this.fpClose.emit();
      },
      onReady: (_: any, __: any, fp: any) => {
        const btn = document.createElement('button');
        btn.textContent = 'Clear date';
        btn.type = 'button';
        btn.style.cssText = 'display:block;width:100%;padding:0.4rem 0.75rem;text-align:left;font-size:0.78rem;color:#dc2626;background:none;border:none;border-top:1px solid #f3f4f6;cursor:pointer;font-family:inherit;';
        btn.onmouseenter = () => btn.style.background = '#fff5f5';
        btn.onmouseleave = () => btn.style.background = 'none';
        btn.addEventListener('mousedown', (e) => {
          e.preventDefault();
          this.fpChange.emit(null);
          fp.close();
        });
        fp.calendarContainer.appendChild(btn);
      }
    });
    setTimeout(() => this.fp.open(), 50);
  }

  ngOnChanges(): void {
    if (this.fp && this.fpValue !== undefined) {
      this.fp.setDate(this.fpValue ?? '', false);
    }
  }

  ngOnDestroy(): void {
    this.fp?.destroy();
  }
}
