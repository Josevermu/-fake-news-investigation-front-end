import { Component, Input } from '@angular/core';

@Component({
  selector: 'app-progress-bar',
  standalone: true,
  template: `
    <div class="progress-bar">
      <div class="progress-fill" [style.width.%]="value"></div>
    </div>
  `,
  styleUrl: './progress-bar.component.scss',
})
export class ProgressBarComponent {
  @Input() value = 0;
}
