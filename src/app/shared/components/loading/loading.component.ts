import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-loading',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="loading-overlay">
      <div class="loading-content">
        <div class="spinner"></div>
        <p class="loading-text">Estamos almacenando tus respuestas, solo nos tomará un momento...</p>
      </div>
    </div>
  `,
  styleUrl: './loading.component.scss',
})
export class LoadingComponent {}
