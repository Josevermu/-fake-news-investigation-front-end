import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { GlassCardComponent } from '@shared/components/glass-card/glass-card.component';
import { SurveyService } from '@services/survey/survey.service';
import { Reward } from '@models/survey.interface';

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

  get rewards(): Reward[] {
    return this.surveyService.rewards();
  }

  selectReward(reward: Reward): void {
    this.selectedRewardId = reward.id;
    // Reward selection is registered automatically
    console.log('Reward selected:', reward.id, reward.title);
  }
}
