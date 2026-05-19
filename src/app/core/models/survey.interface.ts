// ================================================================
// Models aligned with the backend DTOs
// com.konrad.konradquiz.dto.*
// ================================================================

// --- Enums matching backend entities ---

export enum Sex {
  MALE = 'MALE',
  FEMALE = 'FEMALE',
  OTHER = 'OTHER',
}

export enum FeedbackTiming {
  GROUP_A = 'GROUP_A', // feedback after EACH question
  GROUP_B = 'GROUP_B', // feedback only AFTER ALL questions
}

export enum PresentationFormat {
  INSTAGRAM = 'INSTAGRAM',
  WHATSAPP = 'WHATSAPP',
  TEXT = 'TEXT',
}

export enum CorrectAnswer {
  FAKE = 'FAKE',
  REAL = 'REAL',
}

export enum QuestionType {
  PROFILE = 'PROFILE',  // pre-survey Likert questions
  NEWS = 'NEWS',        // fake-news detection questions
}

export enum NewsSet {
  ENVIRONMENT = 'ENVIRONMENT',
  TECHNOLOGY  = 'TECHNOLOGY',
}

export enum AnswerType {
  PROFILE        = 'PROFILE',
  FAKE_DETECTION = 'FAKE_DETECTION',
  MEMORY_TEST    = 'MEMORY_TEST',
}

// --- Request DTOs ---

/** POST /api/v1/participants/register */
export interface ParticipantRequest {
  alias: string;
  email: string;
  sex: Sex;
  age: number;
  region: string;
  consentAcademicPurpose: boolean;
  consentParticipationProcess: boolean;
  consentDataProcessing: boolean;
  consentNoRisk: boolean;
  consentNoPayment: boolean;
  consentProjectInfo: boolean;
}

export interface AnswerRequest {
  questionCode: string;
  answerType: AnswerType;   // ← new
  score: number;
  questionOrder: number;
}

/** POST /api/v1/participants/{id}/answers/batch */
export interface BatchAnswerRequest {
  answers: AnswerRequest[];
  startedAt: number;   // epoch seconds — when participant saw first question
}

// --- Response DTOs ---

/** Question returned inside ExperimentSession (maps QuestionSessionDto) */
export interface QuestionSession {
  questionCode: string;
  questionType: QuestionType;           // PROFILE or NEWS
  itemText: string;
  assignedOrder: number;
  presentationFormat: string;           // per-question format override

  // Reveal data (frontend controls when to show based on feedbackTiming)
  correctAnswer: CorrectAnswer | null;
  referenceApa: string | null;
  supportingQuote: string | null;

  // NEWS-specific — null for PROFILE questions
  phase: string | null;
  category: string | null;
  novelty: string | null;
  sourceVerificationUrl: string | null;
  factCheckUrl: string | null;
  originName: string | null;
  fileName: string | null;

  // PROFILE-specific — null for NEWS questions
  // e.g. "nada,poco,bastante,mucho" or null (use default numeric scale)
  scaleOptions: string | null;
}

/** Response from POST /api/v1/participants/register */
export interface ExperimentSession {
  participantId: number;
  feedbackTiming: FeedbackTiming;
  presentationFormat: PresentationFormat;
  newsSet: NewsSet;
  profileQuestions: QuestionSession[];
  newsPart1Questions: QuestionSession[];
  newsPart2Questions: QuestionSession[];
  // no alias here
}


/** Response from GET /api/v1/participants/{id} */
export interface ParticipantResponse {
  id: number;
  alias: string;
  email: string;

  sex: Sex;
  age: number;
  registeredAt: string;
  region: string;
  completionTimeSeconds: number | null;
  feedbackTiming: FeedbackTiming;
  presentationFormat: PresentationFormat;
}

/** Response from POST /api/v1/participants/{id}/answers/batch */
export interface BatchAnswerResponse {
  participantId: number;
  savedCount: number;
}

/** Error response from backend */
export interface ErrorResponse {
  status: number;
  error: string;
  message: string;
  path: string;
  timestamp: string;
}

/** A symbolic reward option (frontend-only, not backed by API). */
export interface Reward {
  id: number;
  emoji: string;
  title: string;
  description: string;
}
