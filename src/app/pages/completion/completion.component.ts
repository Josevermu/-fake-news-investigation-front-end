import { Component, inject, OnInit, signal, WritableSignal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { GlassCardComponent } from '@shared/components/glass-card/glass-card.component';
import { SurveyService } from '@services/survey/survey.service';
import { ProgressService } from '@services/common/progress.service';
import { AnswerType, CorrectAnswer } from '@models/survey.interface';

@Component({
  selector: 'app-completion',
  standalone: true,
  imports: [CommonModule, GlassCardComponent],
  templateUrl: './completion.component.html',
  styleUrl: './completion.component.scss',
})
export class CompletionComponent implements OnInit {
  private readonly router = inject(Router);
  private readonly surveyService = inject(SurveyService);
  private readonly progressService = inject(ProgressService);

  currentStep: WritableSignal<number> = signal(0);
  totalSteps = 2;

  allResults: Array<{
    index: number;
    correct: string;
    yours: string;
    icon: string;
    imagePath: string | null;
    phase: string;
  }> = [];

  get isGroupB(): boolean {
    return !this.surveyService.isGroupA;
  }

  get currentStepResults() {
    const start = this.currentStep() * 6;
    return this.allResults.slice(start, start + 6);
  }

  get isLastStep(): boolean {
    return this.currentStep() === this.totalSteps - 1;
  }

  ngOnInit(): void {
    const session = this.surveyService.session();
    if (!session) {
      this.router.navigate(['/welcome']);
      return;
    }

    // Initialize progress
    this.progressService.setCompletionProgress(this.currentStep(), this.totalSteps);

    if (!this.isGroupB) return;

    const answers = this.surveyService.collectedAnswers();
    const part1AnswerMap = new Map(
      answers
        .filter((a) => a.answerType === AnswerType.FAKE_DETECTION)
        .map((a) => [a.questionCode, a.score] as const)
    );

    const part2AnswerMap = new Map(
      answers
        .filter((a) => a.answerType === AnswerType.MEMORY_TEST)
        .map((a) => [a.questionCode, a.score] as const)
    );

    const part1Results = session.newsPart1Questions.map((q, idx) => {
      const score = part1AnswerMap.get(q.questionCode) ?? null;
      const correct = q.correctAnswer === CorrectAnswer.FAKE
        ? 'FALSA'
        : q.correctAnswer === CorrectAnswer.REAL
          ? 'VERDADERA'
          : '—';

      const yours = this.scoreToBinaryLabel(score, 'PHASE1');
      const icon = this.buildIcon(correct, yours);
      const imagePath = this.surveyService.getQuestionImagePath(q);

      return {
        index: idx + 1,
        correct,
        yours,
        icon,
        imagePath,
        phase: 'Parte 1 · Verdadera / Falsa',
      };
    });

    const part2Results = session.newsPart2Questions.map((q, idx) => {
      const score = part2AnswerMap.get(q.questionCode) ?? null;
      
      // Determine if the news is OLD (appeared in Part 1) or NEW
      const isOldNews = session.newsPart1Questions.some(
        (p1q) => p1q.questionCode === q.questionCode
      );
      const correct = isOldNews ? 'VIEJA' : 'NUEVA';

      const yours = this.scoreToBinaryLabel(score, 'PHASE2');
      const icon = this.buildIcon(correct, yours);
      const imagePath = this.surveyService.getQuestionImagePath(q);

      return {
        index: idx + 1,
        correct,
        yours,
        icon,
        imagePath,
        phase: 'Parte 2 · Nueva / Vieja',
      };
    });

    this.allResults = [...part1Results, ...part2Results];
  }

  nextStep(): void {
    if (!this.isLastStep) {
      this.currentStep.update((s) => s + 1);
      this.progressService.setCompletionProgress(this.currentStep(), this.totalSteps);
    }
  }

  backStep(): void {
    if (this.currentStep() > 0) {
      this.currentStep.update((s) => s - 1);
      this.progressService.setCompletionProgress(this.currentStep(), this.totalSteps);
    }
  }

  goToReward(): void {
    this.router.navigate(['/reward']);
  }

  private scoreToBinaryLabel(score: number | null, phase: 'PHASE1' | 'PHASE2'): string {
    if (score === null || score === undefined) return '—';
    if (score === 50) return 'No estoy seguro';

    if (phase === 'PHASE1') {
      return score < 50 ? 'Falsa' : 'Verdadera';
    }

    return score < 50 ? 'Vieja' : 'Nueva';
  }

  private buildIcon(correct: string, yours: string): string {
    if (correct === '—' || yours === '—' || yours === 'No estoy seguro') return '⚪';
    return correct.toLowerCase() === yours.toLowerCase() ? '✅' : '❌';
  }
}
