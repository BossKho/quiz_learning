import { describe, it, expect } from 'vitest';
import type { QuestionStats, ActiveSession, ProgressExportData } from '@/types/quiz';

describe('Progress Export & Import logic', () => {
  it('correctly constructs ProgressExportData schema', () => {
    const mockStats: QuestionStats[] = [
      {
        question_id: 'q001',
        leitner_box: 3,
        next_review_at: 1000,
        correct_count: 5,
        incorrect_count: 1,
        streak: 3,
        is_bookmarked: true,
        last_reviewed_at: 1000,
      },
    ];

    const mockSessions: ActiveSession[] = [
      {
        id: 's001',
        deck_id: 'mock_01',
        deck_title: 'Mock 01',
        mode: 'flashcard',
        current_index: 10,
        total_questions: 60,
        time_limit_sec: 0,
        time_remaining_sec: 0,
        question_ids: ['q001'],
        user_answers: {},
        flagged_ids: [],
        is_completed: false,
        created_at: 1000,
        updated_at: 2000,
      },
    ];

    const exportData: ProgressExportData = {
      app: 'QuizLearningPro',
      version: 1,
      exported_at: 123456789,
      exported_at_iso: new Date(123456789).toISOString(),
      stats_summary: {
        total_questions: 100,
        mastered: 20,
        learning: 30,
        bookmarked: 5,
        completed_sessions: 10,
      },
      question_stats: mockStats,
      active_sessions: mockSessions,
    };

    const jsonString = JSON.stringify(exportData, null, 2);
    const parsed = JSON.parse(jsonString) as ProgressExportData;

    expect(parsed.app).toBe('QuizLearningPro');
    expect(parsed.version).toBe(1);
    expect(parsed.question_stats.length).toBe(1);
    expect(parsed.active_sessions[0].mode).toBe('flashcard');
    expect(parsed.question_stats[0].leitner_box).toBe(3);
    expect(parsed.question_stats[0].is_bookmarked).toBe(true);
  });

  it('demonstrates Smart Merge arithmetic correctly', () => {
    const existing = {
      leitner_box: 2,
      correct_count: 3,
      incorrect_count: 2,
      streak: 1,
      is_bookmarked: false,
    };

    const imported = {
      leitner_box: 4,
      correct_count: 5,
      incorrect_count: 1,
      streak: 3,
      is_bookmarked: true,
    };

    // Smart Merge algorithm
    const mergedBox = Math.max(existing.leitner_box, imported.leitner_box);
    const mergedCorrect = existing.correct_count + imported.correct_count;
    const mergedIncorrect = existing.incorrect_count + imported.incorrect_count;
    const mergedStreak = Math.max(existing.streak, imported.streak);
    const mergedBookmarked = existing.is_bookmarked || imported.is_bookmarked;

    expect(mergedBox).toBe(4);
    expect(mergedCorrect).toBe(8);
    expect(mergedIncorrect).toBe(3);
    expect(mergedStreak).toBe(3);
    expect(mergedBookmarked).toBe(true);
  });
});

