import { CommonModule } from '@angular/common';
import { Component, inject } from '@angular/core';
import { Reward } from '@models/survey.interface';
import { SurveyService } from '@services/survey/survey.service';
import { GlassCardComponent } from '@shared/components/glass-card/glass-card.component';

@Component({
  selector: 'app-reward',
  standalone: true,
  imports: [CommonModule, GlassCardComponent],
  templateUrl: './reward.component.html',
  styleUrl: './reward.component.scss',
})
export class RewardComponent {
  private readonly surveyService = inject(SurveyService);

  selectedRewardId: number | null = null;
  submittingRewardId: number | null = null;

  successMessage = '';
  errorMessage = '';

  get rewards(): Reward[] {
    return this.surveyService.rewards();
  }

  selectReward(reward: Reward): void {
    // Prevent another request while one is being processed
    // or after a reward has already been successfully selected.
    if (
      this.submittingRewardId !== null ||
      this.selectedRewardId !== null
    ) {
      return;
    }

    if (!this.surveyService.participantId) {
      this.errorMessage =
        'No se encontró una sesión activa del participante.';
      return;
    }

    this.errorMessage = '';
    this.successMessage = '';
    this.submittingRewardId = reward.id;

    this.surveyService.selectReward(reward.id).subscribe({
      next: (response) => {
        this.submittingRewardId = null;
        this.selectedRewardId = response.rewardId;
        this.successMessage =
          '✓ Tu selección ha sido registrada exitosamente';
      },

      error: (err) => {
        this.submittingRewardId = null;
        this.errorMessage = this.getRewardErrorMessage(err);
      },
    });
  }

  private getRewardErrorMessage(err: any): string {
    const backendMessage = err?.error?.message ?? '';

    if (err?.status === 400) {
      return 'La recompensa seleccionada no es válida.';
    }

    if (err?.status === 404) {
      return backendMessage || 'No se encontró el participante.';
    }

    if (err?.status === 409) {
      const normalizedMessage = backendMessage.toLowerCase();

      if (
        normalizedMessage.includes('already') ||
        normalizedMessage.includes('selected')
      ) {
        return 'Ya seleccionaste una recompensa anteriormente.';
      }

      if (
        normalizedMessage.includes('completed') ||
        normalizedMessage.includes('experiment')
      ) {
        return 'Debes completar el experimento antes de seleccionar una recompensa.';
      }

      return backendMessage || 'No fue posible registrar la recompensa.';
    }

    if (err?.status === 0) {
      return 'No se pudo conectar con el servidor. Verifica tu conexión.';
    }

    return backendMessage || 'No fue posible registrar la recompensa.';
  }
}