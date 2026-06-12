import { Component, WritableSignal, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { GlassCardComponent } from '@shared/components/glass-card/glass-card.component';
import { AdminExportService } from '@services/admin/admin-export.service';

@Component({
  selector: 'app-admin-control-room',
  standalone: true,
  imports: [CommonModule, FormsModule, GlassCardComponent],
  templateUrl: './admin-control-room.component.html',
  styleUrl: './admin-control-room.component.scss',
})
export class AdminControlRoomComponent {
  private readonly adminExportService = inject(AdminExportService);

  isLoading: WritableSignal<boolean> = signal(false);
  errorMessage: WritableSignal<string> = signal('');
  username = '';
  password = '';

  onDownloadCsv(): void {
    if (this.isLoading()) {
      return;
    }

    if (!this.username.trim() || !this.password) {
      this.errorMessage.set('Debes ingresar usuario y contraseña para descargar el CSV.');
      return;
    }

    this.errorMessage.set('');
    this.isLoading.set(true);

    this.adminExportService.downloadCsv(this.username.trim(), this.password).subscribe({
      next: (blob) => {
        this.downloadBlob(blob, 'survey-info.csv');
        this.isLoading.set(false);
      },
      error: (err) => {
        this.isLoading.set(false);

        if (err?.status === 401 || err?.status === 403) {
          this.errorMessage.set('No autorizado para descargar el archivo CSV.');
          return;
        }

        if (err?.status === 0) {
          this.errorMessage.set('No se pudo conectar con el servidor. Verifica tu conexión.');
          return;
        }

        this.errorMessage.set('No fue posible descargar el archivo CSV. Intenta nuevamente.');
      },
    });
  }

  private downloadBlob(blob: Blob, fileName: string): void {
    const objectUrl = URL.createObjectURL(blob);
    const anchor = document.createElement('a');

    anchor.href = objectUrl;
    anchor.download = fileName;
    document.body.appendChild(anchor);
    anchor.click();
    document.body.removeChild(anchor);

    setTimeout(() => URL.revokeObjectURL(objectUrl), 0);
  }
}
