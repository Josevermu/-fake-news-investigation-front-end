import { ChangeDetectorRef, Component, computed, inject, OnInit, signal, WritableSignal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { GlassCardComponent } from '@shared/components/glass-card/glass-card.component';
import { SurveyService } from '@services/survey/survey.service';
import { ProgressService } from '@services/common/progress.service';
import { PRE_SURVEY_SCALE, PRE_SURVEY_GROUP_SIZE } from '@constants/survey-data';
import { AnswerType, QuestionSession } from '@models/survey.interface';

@Component({
  selector: 'app-pre-survey',
  standalone: true,
  imports: [CommonModule, GlassCardComponent],
  templateUrl: './pre-survey.component.html',
  styleUrl: './pre-survey.component.scss',
})
export class PreSurveyComponent implements OnInit {
  private readonly router = inject(Router);
  private readonly surveyService = inject(SurveyService);
  private readonly progressService = inject(ProgressService);
  private readonly cdr = inject(ChangeDetectorRef);

  /** PROFILE questions from the session, sorted by assignedOrder. */
  profileQuestions: QuestionSession[] = [];

  /** Total number of groups (pages) of questions. */
  totalGroups = 0;

  /** Currently displayed group index (0-based). */
  currentGroupIndex: WritableSignal<number> = signal(0);

  /** Answers collected so far: questionCode → score. */
  answers: WritableSignal<Map<string, number>> = signal(new Map());

  /** Question codes that are locked (answer submitted, cannot change). */
  lockedCodes: WritableSignal<Set<string>> = signal(new Set());

  /** Whether the final submission is in progress. */
  isSubmitting: WritableSignal<boolean> = signal(false);

readonly scale = PRE_SURVEY_SCALE.map(value => ({
  label: value.toString(),
  value
}));
  /** Questions shown on the current page. */
  readonly currentGroupQuestions = computed<QuestionSession[]>(() => {
    const start = this.currentGroupIndex() * PRE_SURVEY_GROUP_SIZE;
    return this.profileQuestions.slice(start, start + PRE_SURVEY_GROUP_SIZE);
  });

  /** Progress percentage across all questions (based on locked answers). */
  readonly progressPercent = computed<number>(() => {
    const total = this.profileQuestions.length;
    if (total === 0) return 0;
    return Math.round((this.lockedCodes().size / total) * 100);
  });

  /** True when all questions in the current group have been answered. */
  readonly isCurrentGroupComplete = computed<boolean>(() => {
    return this.currentGroupQuestions().every((q) =>
      this.lockedCodes().has(q.questionCode)
    );
  });

  readonly isLastGroup = computed<boolean>(
    () => this.currentGroupIndex() === this.totalGroups - 1
  );

  ngOnInit(): void {
    this.profileQuestions = this.surveyService.profileQuestions;
    this.totalGroups = Math.ceil(this.profileQuestions.length / PRE_SURVEY_GROUP_SIZE);
    
    // Initialize progress service
    this.progressService.setPreSurveyProgress(this.currentGroupIndex(), this.totalGroups);
  }

selectAnswer(questionCode: string, score: number): void {
    if (this.lockedCodes().has(questionCode)) return;

    const question = this.profileQuestions.find(
      (q) => q.questionCode === questionCode
    );

    if (!question) return;

    this.answers.update((map) => {
      const next = new Map(map);
      next.set(questionCode, score);
      return next;
    });

    this.lockedCodes.update((set) => {
      const next = new Set(set);
      next.add(questionCode);
      return next;
    });

    this.surveyService.recordAnswer(
      questionCode,
      score,
      question.assignedOrder, // 👈 aquí está el order real
      AnswerType.PROFILE
    );

    if (this.isCurrentGroupComplete()) {
      setTimeout(() => {
        if (!this.isLastGroup()) {
          this.nextGroup();
        } else {
          this.finish();
        }
      }, 500);
    }
  }

  getAnswer(questionCode: string): number | null {
    return this.answers().get(questionCode) ?? null;
  }

  isLocked(questionCode: string): boolean {
    return this.lockedCodes().has(questionCode);
  }

  /** Move to the next group of questions. */
  nextGroup(): void {
    if (!this.isCurrentGroupComplete()) return;
    if (!this.isLastGroup()) {
      this.currentGroupIndex.update((i) => i + 1);
      this.progressService.setPreSurveyProgress(this.currentGroupIndex(), this.totalGroups);
    }
  }

  /** All PROFILE answers recorded — navigate to the main survey. */
  finish(): void {
    if (!this.isCurrentGroupComplete() || this.isSubmitting()) return;
    this.router.navigate(['/survey-tutorial']);
  }
}
