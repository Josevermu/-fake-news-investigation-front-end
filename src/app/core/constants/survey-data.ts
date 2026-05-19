import { Reward, ExperimentSession, QuestionType, CorrectAnswer, FeedbackTiming, PresentationFormat, ParticipantRequest, NewsSet } from '@models/survey.interface';

// ─── Mock session (offline / demo mode) ──────────────────────────────────────

/**
 * Builds a fake ExperimentSession so the frontend can be tested without
 * a running backend. Disable once the backend is stable.
 */
export function buildMockSession(_data: ParticipantRequest): ExperimentSession {
  return {
    participantId: Date.now(),
    feedbackTiming: FeedbackTiming.GROUP_A,
    presentationFormat: PresentationFormat.TEXT,
    newsSet: NewsSet.TECHNOLOGY,
    profileQuestions:    [ /* 18 PROFILE items */ ],
    newsPart1Questions:  [ /* 8 NEWS items */     ],
    newsPart2Questions:  [ /* 8 NEWS items */     ],
  };
}



export const FAKE_DETECTION_SCALE: number[] = Array.from({ length: 21 }, (_, i) => i -10);
export const MEMORY_TEST_SCALE: number[]    =  Array.from({ length: 21 }, (_, i) => i - 10);
// Keep these aliases so nothing else breaks
export const EXP1_SCALE  = FAKE_DETECTION_SCALE;
export const EXP2_SCALE  = MEMORY_TEST_SCALE;
export const SCALE_VALUES = FAKE_DETECTION_SCALE;

// ─── Shared constants ─────────────────────────────────────────────────────────

/**
 * PROFILE (pre-survey) scale: 0, 5, 10 … 100 → 21 buttons.
 * Labels: Nada (0) … Poco … Bastante … Mucho (100)
 */
export const PRE_SURVEY_SCALE: number[] = Array.from({ length: 21 }, (_, i) => i * 5);

/** Number of PROFILE questions displayed per page in the pre-survey screen. */
export const PRE_SURVEY_GROUP_SIZE = 3;

/**
 * Symbolic rewards shown after completing the survey.
 * Sorted from least favorable to most favorable (left to right).
 * These are frontend-only — the backend has no reward endpoint.
 */
export const DEFAULT_REWARDS: Reward[] = [
  { id: 1, emoji: '📚', title: 'Me encanta formarme', description: 'Ebook relacionado con la detección de información' },
  { id: 2, emoji: '🤝', title: 'Soy altruista', description: 'Apoya la ciencia. Mi apoyo es altruista para ayudar a la ciencia' },
  { id: 3, emoji: '🔍', title: 'Me encantaría conocer', description: 'Ebook relacionado con los resultados de la investigación' },
];

/**
 * Colombian regions for the registration form dropdown.
 */
export const REGIONS: string[] = [
  'Bogotá D.C.',
  'Medellín',
  'Cali',
  'Barranquilla',
  'Cartagena',
  'Bucaramanga',
  'Pereira',
  'Manizales',
  'Santa Marta',
  'Ibagué',
  'Otra',
];

