import type { Question, ActiveSession, ExamResultSummary, SessionMode } from '@/types/quiz';
import { dbService } from './db';

export interface ShuffledQuestion extends Question {
  originalIndices: number[]; // maps current option index to original index
}

/**
 * Shuffles options and synchronized Vietnamese options while preserving correct answer mapping.
 */
export function prepareQuestionForSession(q: Question, shouldShuffle: boolean = true): ShuffledQuestion {
  if (!shouldShuffle || !q.shuffle_options || q.options.length <= 1) {
    return {
      ...q,
      originalIndices: q.options.map((_, i) => i),
    };
  }

  // Create array of original indices [0, 1, ..., n-1]
  const indices = q.options.map((_, i) => i);
  // Fisher-Yates shuffle
  for (let i = indices.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [indices[i], indices[j]] = [indices[j], indices[i]];
  }

  const shuffledOptions = indices.map((idx) => q.options[idx]);
  const shuffledViOptions = q.vi?.options ? indices.map((idx) => q.vi.options[idx] || '') : [];

  // Map old answer indices to new indices
  const newAnswer = q.answer
    .map((oldIdx) => indices.indexOf(oldIdx))
    .filter((idx) => idx !== -1)
    .sort((a, b) => a - b);

  return {
    ...q,
    options: shuffledOptions,
    answer: newAnswer,
    vi: {
      ...q.vi,
      options: shuffledViOptions,
    },
    originalIndices: indices,
  };
}

export function isAnswerCorrect(userAnswer: number[], correctAnswer: number[]): boolean {
  if (!userAnswer || !correctAnswer) return false;
  if (userAnswer.length !== correctAnswer.length) return false;
  const sortedUser = [...userAnswer].sort((a, b) => a - b);
  const sortedCorrect = [...correctAnswer].sort((a, b) => a - b);
  return sortedUser.every((val, idx) => val === sortedCorrect[idx]);
}

export function calculateExamResult(
  session: ActiveSession,
  questions: Question[]
): ExamResultSummary {
  const questionMap = new Map(questions.map((q) => [q.id, q]));
  let correctCount = 0;
  let answeredCount = 0;

  const details = session.question_ids.map((qId) => {
    const q = questionMap.get(qId);
    const userAns = session.user_answers[qId] || [];
    if (userAns.length > 0) answeredCount++;

    const isCorrect = q ? isAnswerCorrect(userAns, q.answer) : false;
    if (isCorrect) correctCount++;

    return {
      question: q!,
      userAnswer: userAns,
      isCorrect,
    };
  });

  const total = session.total_questions;
  const scorePercent = total > 0 ? Math.round((correctCount / total) * 100) : 0;
  const timeSpentSec = Math.max(0, session.time_limit_sec - session.time_remaining_sec);

  return {
    session_id: session.id,
    deck_title: session.deck_title,
    total_questions: total,
    answered_count: answeredCount,
    correct_count: correctCount,
    incorrect_count: total - correctCount,
    score_percent: scorePercent,
    passed: scorePercent >= 70,
    time_spent_sec: timeSpentSec,
    details,
  };
}

export async function createNewSession(
  deckId: string,
  deckTitle: string,
  mode: SessionMode,
  questions: Question[],
  shuffleQuestions: boolean = true,
  timeLimitSec: number = 3600
): Promise<ActiveSession> {
  // Clean up any existing unfinished session for this deck so there's always at most 1 active session
  if (deckId && deckId !== 'custom_exam' && deckId !== 'flashcard_deck') {
    try {
      await dbService.init();
      const existing = (await dbService.getUnfinishedSessions()).find((s) => s.deck_id === deckId);
      if (existing) {
        await dbService.deleteSession(existing.id, false);
      }
    } catch (e) {
      console.warn('Clean up previous session for deck failed:', e);
    }
  }

  let orderedQuestions = [...questions];
  if (shuffleQuestions) {
    orderedQuestions.sort(() => Math.random() - 0.5);
  }

  const session: ActiveSession = {
    id: `sess_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
    deck_id: deckId,
    deck_title: deckTitle,
    mode,
    current_index: 0,
    total_questions: orderedQuestions.length,
    time_limit_sec: timeLimitSec,
    time_remaining_sec: timeLimitSec,
    question_ids: orderedQuestions.map((q) => q.id),
    user_answers: {},
    flagged_ids: [],
    is_completed: false,
    created_at: Date.now(),
    updated_at: Date.now(),
  };

  await dbService.saveSession(session);
  return session;
}
