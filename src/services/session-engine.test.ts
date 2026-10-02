import { describe, it, expect } from 'vitest';
import { 
  prepareQuestionForSession, 
  isAnswerCorrect, 
  calculateExamResult 
} from './session-engine';
import type { Question, ActiveSession } from '@/types/quiz';

describe('session-engine', () => {
  const sampleQuestion: Question = {
    id: 'q001',
    deck_id: 'mock_01',
    type: 'single',
    question: 'What is Kaizen?',
    options: ['Planning', 'Continuous improvement', 'Testing', 'Marketing'],
    answer: [1], // 'Continuous improvement'
    explanation: 'Kaizen is continuous improvement.',
    note: '',
    answer_source: 'pdf',
    shuffle_options: true,
    vi: {
      question: 'Kaizen là gì?',
      options: ['Lập kế hoạch', 'Cải tiến liên tục', 'Kiểm thử', 'Tiếp thị'],
    },
  };

  describe('isAnswerCorrect', () => {
    it('returns true when answers match exactly', () => {
      expect(isAnswerCorrect([1], [1])).toBe(true);
    });

    it('returns false when answers differ', () => {
      expect(isAnswerCorrect([0], [1])).toBe(false);
      expect(isAnswerCorrect([], [1])).toBe(false);
    });

    it('handles multi-choice order-independently', () => {
      expect(isAnswerCorrect([0, 2], [2, 0])).toBe(true);
      expect(isAnswerCorrect([0, 2], [0, 1])).toBe(false);
      expect(isAnswerCorrect([0], [0, 2])).toBe(false);
    });
  });

  describe('prepareQuestionForSession', () => {
    it('synchronously shuffles English and Vietnamese options and updates answer index', () => {
      const prepared = prepareQuestionForSession(sampleQuestion, true);

      expect(prepared.options.length).toBe(4);
      expect(prepared.vi.options.length).toBe(4);
      expect(prepared.answer.length).toBe(1);

      // Verify correct option content matches the updated answer index
      const correctOptionText = prepared.options[prepared.answer[0]];
      expect(correctOptionText).toBe('Continuous improvement');

      // Verify Vietnamese option at the same index matches
      const correctViText = prepared.vi.options[prepared.answer[0]];
      expect(correctViText).toBe('Cải tiến liên tục');

      // Verify every option index matches its corresponding Vietnamese option
      prepared.options.forEach((opt, idx) => {
        if (opt === 'Planning') expect(prepared.vi.options[idx]).toBe('Lập kế hoạch');
        if (opt === 'Continuous improvement') expect(prepared.vi.options[idx]).toBe('Cải tiến liên tục');
        if (opt === 'Testing') expect(prepared.vi.options[idx]).toBe('Kiểm thử');
        if (opt === 'Marketing') expect(prepared.vi.options[idx]).toBe('Tiếp thị');
      });
    });

    it('respects shuffle_options = false', () => {
      const nonShuffledQ: Question = {
        ...sampleQuestion,
        shuffle_options: false,
      };
      const prepared = prepareQuestionForSession(nonShuffledQ, true);
      expect(prepared.options).toEqual(sampleQuestion.options);
      expect(prepared.vi.options).toEqual(sampleQuestion.vi.options);
      expect(prepared.answer).toEqual(sampleQuestion.answer);
    });
  });

  describe('calculateExamResult', () => {
    it('calculates score and pass status accurately', () => {
      const session: ActiveSession = {
        id: 'sess_1',
        deck_id: 'mock_01',
        deck_title: 'Mock Test 01',
        mode: 'exam',
        current_index: 0,
        total_questions: 2,
        time_limit_sec: 3600,
        time_remaining_sec: 3000,
        question_ids: ['q001', 'q002'],
        user_answers: {
          q001: [1], // correct
          q002: [0], // incorrect
        },
        flagged_ids: ['q002'],
        is_completed: true,
        created_at: Date.now(),
        updated_at: Date.now(),
      };

      const questions: Question[] = [
        sampleQuestion,
        {
          ...sampleQuestion,
          id: 'q002',
          question: 'Question 2',
          options: ['A', 'B'],
          answer: [1],
        },
      ];

      const result = calculateExamResult(session, questions);

      expect(result.total_questions).toBe(2);
      expect(result.answered_count).toBe(2);
      expect(result.correct_count).toBe(1);
      expect(result.incorrect_count).toBe(1);
      expect(result.score_percent).toBe(50);
      expect(result.passed).toBe(false); // < 70%
      expect(result.time_spent_sec).toBe(600); // 3600 - 3000
    });
  });
});
