import { Component } from '@angular/core';

@Component({
  selector: 'app-glass-card',
  standalone: true,
  template: `
    <div class="glass-card">
      <ng-content />
    </div>
  `,
  styleUrl: './glass-card.component.scss',
})
export class GlassCardComponent {}
