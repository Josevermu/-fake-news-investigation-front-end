import { Component, inject, signal, WritableSignal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { GlassCardComponent } from '@shared/components/glass-card/glass-card.component';
import { SurveyService } from '@services/survey/survey.service';

@Component({
  selector: 'app-pre-survey-intro',
  standalone: true,
  imports: [CommonModule, GlassCardComponent],
  templateUrl: './pre-survey-intro.component.html',
  styleUrl: './pre-survey-intro.component.scss',
})
export class PreSurveyIntroComponent {
  private readonly router = inject(Router);
  private readonly surveyService = inject(SurveyService);

  errorMessage: WritableSignal<string> = signal('');

  /** User accepts to answer the pre-survey profile questions. */
  accept(): void {
    this.router.navigate(['/pre-survey']);
  }

  /**
   * User declines the pre-survey.
   * Show error message that it's required to continue.
   */
  decline(): void {
    this.errorMessage.set('Es necesario responder el cuestionario previo para continuar con el experimento.');
  }
}
