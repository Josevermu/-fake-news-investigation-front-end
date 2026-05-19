import { Component, inject, OnInit, signal, ViewChild, WritableSignal, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { GlassCardComponent } from '@shared/components/glass-card/glass-card.component';
import { ProgressBarComponent } from '@shared/components/progress-bar/progress-bar.component';
import { ToastComponent } from '@shared/components/toast/toast.component';
import { LoadingComponent } from '@shared/components/loading/loading.component';
import { OrientationAlertComponent } from '@shared/components/orientation-alert/orientation-alert.component';
import { SurveyService } from '@services/survey/survey.service';
import { ProgressService } from '@services/common/progress.service';
import { QuestionSession, CorrectAnswer, AnswerType } from '@models/survey.interface';
import { EXP1_SCALE, EXP2_SCALE } from '@constants/survey-data';
import { FAKE_DETECTION_SCALE, MEMORY_TEST_SCALE } from '@constants/survey-data';

@Component({
  selector: 'app-survey',
  standalone: true,
  imports: [
    CommonModule,
    GlassCardComponent,
    ProgressBarComponent,
    ToastComponent,
    LoadingComponent,
    OrientationAlertComponent,
  ],
  templateUrl: './survey.component.html',
  styleUrl: './survey.component.scss',
})
export class SurveyComponent implements OnInit {
  private readonly router = inject(Router);
  private readonly surveyService = inject(SurveyService);
  private readonly progressService = inject(ProgressService);
  private readonly cdr = inject(ChangeDetectorRef);

  @ViewChild(ToastComponent) toast!: ToastComponent;

  /** Scale values for EXP1 and EXP2 (-10 to 10, 21 buttons). */
  readonly memoryTestScale = MEMORY_TEST_SCALE;
  readonly fakeDetectionScale = FAKE_DETECTION_SCALE;

  /** Returns the correct scale for the current question. */
  get scaleValues(): number[] {
    return this.isMemoryTest ? this.memoryTestScale : this.fakeDetectionScale;
  }

  get isMemoryTest(): boolean {
    return this.surveyService.isCurrentlyInPhase2;
  }

  get questionCounter(): string {
    const idx = this.surveyService.currentQuestionIndex();
    const total = this.surveyService.allNewsQuestions.length;
    const phase = this.isMemoryTest ? 'Parte 2' : 'Parte 1';
    const questionsPerPart = total / 2;
    const questionInPart = this.isMemoryTest ? idx - questionsPerPart + 1 : idx + 1;
    return `Pregunta ${questionInPart} de ${questionsPerPart} · ${phase}`;
  }

  /** Currently selected value (null = none selected). */
  selectedValue: WritableSignal<number | null> = signal(null);

  /** Whether the selection is locked (user already chose a value). */
  selectionLocked: WritableSignal<boolean> = signal(false);

  /** Whether the confirm button is busy. */
  isSaving: WritableSignal<boolean> = signal(false);

  /** Whether we're showing feedback (GROUP_A only). */
  showingFeedback: WritableSignal<boolean> = signal(false);

  get currentQuestion(): QuestionSession | undefined {
    return this.surveyService.getCurrentQuestion();
  }


  get progressPercent(): number {
    const total = this.surveyService.allNewsQuestions.length;
    const questionsPerPart = total / 2;
    const idx = this.surveyService.currentQuestionIndex();
    const questionInPart = this.isMemoryTest ? idx - questionsPerPart : idx;
    return Math.round(((questionInPart + 1) / questionsPerPart) * 100);
  }

  get isGroupA(): boolean {
    return this.surveyService.isGroupA;
  }

  /** Image path for the current question (includes TEXT format with sin-redes). */
  get questionImagePath(): string | null {
    const q = this.currentQuestion;
    return q ? this.surveyService.getQuestionImagePath(q) : null;
  }

  /** Whether the current format shows images (now includes TEXT). */
  get isVisualFormat(): boolean {
    return this.questionImagePath !== null;
  }

  /** Label for the current presentation format. */
  get formatLabel(): string {
    return this.surveyService.presentationFormat;
  }

  /** Feedback text for current question (shown in GROUP_A). */
  get feedbackLabel(): string {
    const q = this.currentQuestion;
    if (!q) return '';

    if (this.isMemoryTest) {
      // Determine if the news is OLD (appeared in Part 1) or NEW
      const isOldNews = this.isOldNews(q.questionCode);
      return isOldNews
        ? '🕒 Esta noticia es VIEJA'
        : '🆕 Esta noticia es NUEVA';
    }

    if (!q.correctAnswer) return '';
    return q.correctAnswer === CorrectAnswer.FAKE
      ? '❌ Esta afirmación es FALSA'
      : '✅ Esta afirmación es REAL';
  }

  /** Check if a question from Part 2 appeared in Part 1 (OLD news). */
  private isOldNews(questionCode: string): boolean {
    return this.surveyService.part1Questions.some(
      (q) => q.questionCode === questionCode
    );
  }

  get feedbackReference(): string {
    return this.currentQuestion?.referenceApa ?? '';
  }

  ngOnInit(): void {
    if (!this.surveyService.session()) {
      this.router.navigate(['/welcome']);
      return;
    }
    
    // Initialize progress
    const currentIdx = this.surveyService.currentQuestionIndex();
    const total = this.surveyService.allNewsQuestions.length;
    this.progressService.setSurveyProgress(currentIdx, total);
  }

  selectScale(value: number): void {
    if (this.showingFeedback() || this.selectionLocked()) return;

    this.selectedValue.set(value);
    this.selectionLocked.set(true);

    const question = this.currentQuestion;
    if (!question) return;
    
    const answerType = this.isMemoryTest ? AnswerType.MEMORY_TEST : AnswerType.FAKE_DETECTION;
    const backendScore = this.mapDisplayedScaleToBackendScore(value);

    // Record answer locally
    this.surveyService.recordAnswer(
      question.questionCode,
      backendScore,
      question.assignedOrder,
      answerType
    );

    // Show active feedback for GROUP_A
    const canShowActiveFeedback = this.isGroupA && (
      (!this.isMemoryTest && !!question.correctAnswer) ||
      this.isMemoryTest  // Always show feedback in Part 2 for GROUP_A
    );

    if (canShowActiveFeedback) {
      this.showingFeedback.set(true);
      setTimeout(() => {
        this.showingFeedback.set(false);
        this.toast.show('Su respuesta fue guardada exitosamente ✓');
        this.advanceAfterDelay();
      }, 2000);
    } else {
      this.toast.show('Su respuesta fue guardada exitosamente ✓');
      this.advanceAfterDelay();
    }
  }

  private mapDisplayedScaleToBackendScore(displayValue: number): number {
    // UI shows -10..10, backend expects 0..100
    // -10 → 0, 0 → 50, 10 → 100 (step 5)
    const mapped = Math.round((displayValue + 10) * 5);
    return Math.max(0, Math.min(100, mapped));
  }

  private advanceAfterDelay(): void {
    const wasInPhase1 = !this.surveyService.isCurrentlyInPhase2; // snapshot BEFORE advance

    setTimeout(() => {
      // Reset only after delay
      this.selectedValue.set(null);
      this.selectionLocked.set(false);
      this.showingFeedback.set(false);
      
      const hasMore = this.surveyService.nextQuestion();
      
      // Update progress
      const currentIdx = this.surveyService.currentQuestionIndex();
      const total = this.surveyService.allNewsQuestions.length;
      this.progressService.setSurveyProgress(currentIdx, total);
      
      // Ensure UI updates immediately after the question index changes
      try { this.cdr.detectChanges(); } catch { /* no-op */ }
      if (!hasMore) {
          // All questions answered — submit batch to backend
          this.isSaving.set(true);
          this.surveyService.submitBatch().subscribe({
            next: () => {
              this.isSaving.set(false);
              this.router.navigate(['/completion']);
            },
            error: (err) => {
              this.isSaving.set(false);
              const msg = err?.error?.message || 'No se pudo guardar las respuestas, pero continuaremos.';
              console.error('submitBatch error:', msg);
              this.router.navigate(['/completion']);
            },
          });
        } else {
        if (wasInPhase1 && this.surveyService.isCurrentlyInPhase2) {
          this.router.navigate(['/survey-break']);
        }
      }
    }, 600);
  }
}
