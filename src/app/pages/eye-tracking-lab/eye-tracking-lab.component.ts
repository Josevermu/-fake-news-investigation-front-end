import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { SurveyService } from '@services/survey/survey.service';
import { EyeTrackingService } from '@services/survey/eye-tracking.service';
import { FeedbackTiming } from '@models/survey.interface';

/**
 * Launches the real experiment's survey component with the same session DTO
 * returned by registration, but entirely in memory.
 * The real survey and local lab share ONE WebGazer collector.
 */
@Component({
  selector: 'app-eye-tracking-lab',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './eye-tracking-lab.component.html',
  styleUrl: './eye-tracking-lab.component.scss',
})
export class EyeTrackingLabComponent {
  private readonly router = inject(Router);
  private readonly survey = inject(SurveyService);
  readonly eye = inject(EyeTrackingService);

  openDemo(group: FeedbackTiming): void {
    this.eye.clear();
    this.survey.startEyeTrackingDemo(group);
    void this.router.navigate(['/survey']);
  }

  openGroupA(): void { this.openDemo(FeedbackTiming.GROUP_A); }
  openGroupB(): void { this.openDemo(FeedbackTiming.GROUP_B); }
}
