import { inject, Injectable, signal, WritableSignal } from '@angular/core';
import { Observable, tap, catchError, throwError, of } from 'rxjs';
import { HttpService } from '@services/common/http.service';
import { API_ROUTES } from '@constants/api-routes.config';
import {
  ParticipantRequest,
  ExperimentSession,
  QuestionSession,
  AnswerRequest,
  BatchAnswerRequest,
  BatchAnswerResponse,
  FeedbackTiming,
  NewsSet,
  PresentationFormat,
  QuestionType,
  CorrectAnswer,
  Reward,
  AnswerType,
  RewardSelectionRequest,
  RewardSelectionResponse,
} from '@models/survey.interface';
import { DEFAULT_REWARDS, buildMockSession } from '@constants/survey-data';

@Injectable({
  providedIn: 'root',
})
export class SurveyService {
  private readonly http = inject(HttpService);

  /** The full experiment session returned after registration. */
  public readonly session: WritableSignal<ExperimentSession | null> = signal(null);

  /** Current question index within the active question list (0-based). */
  public readonly currentQuestionIndex: WritableSignal<number> = signal(0);

  /** Collected answers (accumulated as the user answers each question). */
  public readonly collectedAnswers: WritableSignal<AnswerRequest[]> = signal([]);

  /** Epoch seconds when the survey (news phase) started. */
  public startedAt = 0;

  /** Isolated local WebGazer demo; never submits anything to the research API. */
  readonly isEyeTrackingDemo = signal(false);

  /** Symbolic rewards (frontend-only). */
  public readonly rewards: WritableSignal<Reward[]> = signal(DEFAULT_REWARDS);

  get profileQuestions()    { return this.session()?.profileQuestions    ?? []; }
  get part1Questions()      { return this.session()?.newsPart1Questions  ?? []; }
  get part2Questions()      { return this.session()?.newsPart2Questions  ?? []; }
  get allNewsQuestions()    { return [...this.part1Questions, ...this.part2Questions]; }
  get part1Count()          { return this.part1Questions.length; }
  get isCurrentlyInPhase2() { return this.currentQuestionIndex() >= this.part1Count; }

  get participantId(): number | null {
    return this.session()?.participantId ?? null;
  }

  get feedbackTiming(): FeedbackTiming {
    return this.session()?.feedbackTiming ?? FeedbackTiming.GROUP_B;
  }

  get isGroupA(): boolean {
    return this.feedbackTiming === FeedbackTiming.GROUP_A;
  }

  /**
   * Step 1: Register participant → receive ExperimentSession with questions.
   * Propagates HTTP errors (4xx/5xx) so the component can display them.
   * Only genuine network failures (status 0) fall back to a local demo session.
   */
  register(data: ParticipantRequest): Observable<ExperimentSession> {
    this.isEyeTrackingDemo.set(false);
    return this.http
      .post<ExperimentSession>(API_ROUTES.participants.register, data)
      .pipe(
        tap((session) => this.initSession(session)),
        catchError((err) => {
          // Network failure (status 0) → fall back to offline/demo mode
          if (err?.status === 0) {
            console.warn('⚠️ Backend no disponible — modo demo activado');
            const mock = buildMockSession(data);
            this.initSession(mock);
            return of(mock);
          }
          // HTTP errors (4xx/5xx) propagate so the component shows the message
          return throwError(() => err);
        })
      );
  }

  /**
   * Mimics POST /participants/register by creating a real ExperimentSession
   * shape in memory. No HTTP calls, auth bypass, or production data changes.
   */
  startEyeTrackingDemo(feedbackTiming: FeedbackTiming = FeedbackTiming.GROUP_B): void {
    const create = (
      code: string, order: number, itemText: string,
      correctAnswer: CorrectAnswer | null,
    ): QuestionSession => ({
      questionCode: code,
      questionType: QuestionType.NEWS,
      itemText,
      assignedOrder: order,
      presentationFormat: PresentationFormat.TEXT,
      correctAnswer,
      referenceApa: null,
      supportingQuote: null,
      phase: null,
      category: 'DEMO',
      novelty: null,
      sourceVerificationUrl: null,
      factCheckUrl: null,
      originName: 'Mock local',
      fileName: null,
      scaleOptions: null,
    });
    const part1 = [
      create('MOCK_D1', 1, 'Un titular afirma que un telescopio encontró un océano de chocolate en Marte. ¿Es falso o verdadero?', CorrectAnswer.FAKE),
      create('MOCK_D2', 2, 'Una noticia explica que la Luna refleja parte de la luz del Sol. ¿Es falsa o verdadera?', CorrectAnswer.REAL),
      create('MOCK_D3', 3, 'Un anuncio dice que las plantas crecen sin ninguna fuente de energía. ¿Es falso o verdadero?', CorrectAnswer.FAKE),
      create('MOCK_D4', 4, 'Una noticia describe el uso de satélites para observar las nubes. ¿Es falsa o verdadera?', CorrectAnswer.REAL),
    ];
    const part2 = [
      create('MOCK_D2', 1, part1[1].itemText, CorrectAnswer.REAL),
      create('MOCK_N1', 2, 'Un titular de prueba menciona una ciudad submarina de cristal. ¿Es vieja o nueva?', CorrectAnswer.FAKE),
      create('MOCK_D4', 3, part1[3].itemText, CorrectAnswer.REAL),
      create('MOCK_N2', 4, 'Una noticia de prueba habla de la agricultura en una estación orbital. ¿Es vieja o nueva?', CorrectAnswer.FAKE),
    ];
    const mock: ExperimentSession = {
      participantId: 999001,
      feedbackTiming,
      presentationFormat: PresentationFormat.TEXT,
      newsSet: NewsSet.TECHNOLOGY,
      profileQuestions: [],
      newsPart1Questions: part1,
      newsPart2Questions: part2,
    };
    this.initSession(mock);
    this.isEyeTrackingDemo.set(true);
  }

  private initSession(session: ExperimentSession): void {
    const byAssignedOrder = (a: QuestionSession, b: QuestionSession) =>
      a.assignedOrder - b.assignedOrder;
    session.profileQuestions.sort(byAssignedOrder);
    session.newsPart1Questions.sort(byAssignedOrder);
    session.newsPart2Questions.sort(byAssignedOrder);
    this.session.set(session);
    this.currentQuestionIndex.set(0);
    this.collectedAnswers.set([]);
    this.startedAt = Math.floor(Date.now() / 1000);
  }

  /**
   * Resolves the image path for a NEWS question.
   * Uses the per-question presentationFormat and the EXP1/EXP2 subfolder.
   * For TEXT format, returns the path to sin-redes folder.
   *
   * Path structure:
   *   TEXT:      assets/images/questions/EXP1/sin-redes/{number}_exp1_NRS.png
   *   INSTAGRAM: assets/images/questions/EXP1/instagram/{questionCode}_INST.png
   *   WHATSAPP:  assets/images/questions/EXP2/whatsapp/{questionCode}_WHP.png
   */
  getQuestionImagePath(question: QuestionSession): string | null {
    const format = (question.presentationFormat ?? 'TEXT').toUpperCase();
    const code = question.questionCode.toLowerCase();

    // Extract question number from questionCode (e.g., "1_exp1" -> "1")
    const match = code.match(/^(\d+)_exp([12])/);
    if (!match) return null;

    const questionNumber = match[1];
    const expNumber = match[2]; // "1" or "2"

    if (format === 'TEXT') {
      // TEXT format uses sin-redes folder
      return `assets/images/questions/EXP${expNumber}/sin-redes/${questionNumber}_exp${expNumber}_NRS.png`;
    }

    // Visual formats (Instagram/WhatsApp)
    const folder = format === 'WHATSAPP' ? 'whatsapp' : 'instagram';
    const suffix = format === 'WHATSAPP' ? '_WHP' : '_INST';

    return `assets/images/questions/EXP${expNumber}/${folder}/${question.questionCode}${suffix}.png`;
  }

  getCurrentQuestion(): QuestionSession | undefined {
    return this.allNewsQuestions[this.currentQuestionIndex()];
  }

  /**
   * Record an answer locally (not sent to backend yet).
   * Used for both PROFILE and NEWS questions — all go into the same batch.
   */
  recordAnswer(
    questionCode: string,
    score: number,
    questionOrder: number,
    answerType: AnswerType,
    novelty?: string | null, // N = new, V = old (only for MEMORY_TEST answers)
  ): void {
    const answer: AnswerRequest = { questionCode, answerType, score, questionOrder, novelty };
    this.collectedAnswers.update((prev) => [...prev, answer]);
  }

  nextQuestion(): boolean {
    const next = this.currentQuestionIndex() + 1;
    if (next < this.allNewsQuestions.length) {
      this.currentQuestionIndex.set(next);
      return true;
    }
    return false;
  }

  /**
   * Step 2: Submit all collected answers (PROFILE + NEWS) in a single batch.
   * Falls back gracefully if the backend is unreachable.
   */
  submitBatch(): Observable<BatchAnswerResponse> {
    if (this.isEyeTrackingDemo()) {
      return of({ participantId: this.participantId ?? 999001, savedCount: this.collectedAnswers().length });
    }
    const id = this.participantId;
    if (!id) {
      return of({ participantId: 0, savedCount: 0 });
    }

    const payload: BatchAnswerRequest = {
      answers: this.collectedAnswers(),
      startedAt: this.startedAt,
    };

    return this.http.post<BatchAnswerResponse>(
      API_ROUTES.participants.submitBatch(id),
      payload
    ).pipe(
      catchError((err) => {
        // Network failure (status 0) → return a simulated response so UI shows changes
        if (err?.status === 0) {
          console.warn('⚠️ Backend no disponible — modo demo activado (respuestas no persistidas)');
          const simulated: BatchAnswerResponse = { participantId: id, savedCount: payload.answers.length };
          return of(simulated);
        }

        console.warn('⚠️ Error al enviar respuestas al backend:', err);
        return throwError(() => err);
      })
    );
  }

  /**
   * Step 3: Save the reward selected by the participant.
   * The participant must have completed the experiment first.
   */
  selectReward(rewardId: number): Observable<RewardSelectionResponse> {
    if (this.isEyeTrackingDemo()) {
      return of({ participantId: this.participantId ?? 999001, rewardId, message: 'Selección simulada local.' });
    }
    const id = this.participantId;

    if (!id) {
      return throwError(() => new Error('No active participant session.'));
    }

    const payload: RewardSelectionRequest = { rewardId };

    return this.http.post<RewardSelectionResponse>(
      API_ROUTES.participants.selectReward(id),
      payload
    );
  }

  /**
   * Reset survey state for a new session.
   */
  reset(): void {
    this.isEyeTrackingDemo.set(false);
    this.session.set(null);
    this.currentQuestionIndex.set(0);
    this.collectedAnswers.set([]);
    this.startedAt = 0;
  }
}
