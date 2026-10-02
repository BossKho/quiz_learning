export type QuestionType = 'single' | 'multi';

export interface VietnameseTranslation {
  question: string;
  options: string[];
}

export interface Question {
  id: string;
  deck_id: string;
  type: QuestionType;
  question: string;
  options: string[];
  answer: number[];
  explanation: string;
  note: string;
  answer_source: string;
  shuffle_options: boolean;
  vi: VietnameseTranslation;
  stats?: QuestionStats;
}

export interface Deck {
  id: string;
  title: string;
  source: string;
  total_questions: number;
  mastered_count?: number;
  learning_count?: number;
  new_count?: number;
  created_at: number;
  updated_at: number;
}

export interface QuestionStats {
  question_id: string;
  leitner_box: number; // 1: New, 2: Learning, 3: Familiar, 4: Proficient, 5: Mastered
  next_review_at: number;
  correct_count: number;
  incorrect_count: number;
  streak: number;
  is_bookmarked: boolean;
  last_reviewed_at: number;
}

export type SessionMode = 'study' | 'exam';

export interface ActiveSession {
  id: string;
  deck_id: string;
  deck_title: string;
  mode: SessionMode;
  current_index: number;
  total_questions: number;
  time_limit_sec: number;
  time_remaining_sec: number;
  question_ids: string[];
  user_answers: Record<string, number[]>; // questionId -> selectedOptionIndices
  flagged_ids: string[]; // for Exam mode [F]
  is_completed: boolean;
  score?: number;
  created_at: number;
  updated_at: number;
}

export interface ExamResultSummary {
  session_id: string;
  deck_title: string;
  total_questions: number;
  answered_count: number;
  correct_count: number;
  incorrect_count: number;
  score_percent: number;
  passed: boolean; // >= 70% or configurable
  time_spent_sec: number;
  details: Array<{
    question: Question;
    userAnswer: number[];
    isCorrect: boolean;
  }>;
}

export interface SearchFilter {
  query?: string;
  deck_id?: string;
  box?: number;
  is_bookmarked?: boolean;
  limit?: number;
  offset?: number;
}

export interface SearchResult {
  questions: Question[];
  total: number;
}
