import { Component, signal, WritableSignal } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-toast',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="toast" [class.show]="visible()">
      <div class="toast-icon">✓</div>
      <span>{{ message() }}</span>
    </div>
  `,
  styleUrl: './toast.component.scss',
})
export class ToastComponent {
  visible: WritableSignal<boolean> = signal(false);
  message: WritableSignal<string> = signal('Su respuesta fue guardada exitosamente');

  show(msg?: string): void {
    if (msg) {
      this.message.set(msg);
    }
    this.visible.set(true);
    setTimeout(() => this.visible.set(false), 3000);
  }
}
