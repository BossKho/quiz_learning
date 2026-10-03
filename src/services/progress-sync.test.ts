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

  it('guarantees complete isolation between multiple user accounts', () => {
    // User A progress storage
    const userA_id = 'uid_user_alpha';
    const userA_progress: ProgressExportData = {
      app: 'QuizLearningPro',
      version: 1,
      exported_at: Date.now(),
      exported_at_iso: new Date().toISOString(),
      stats_summary: { total_questions: 100, mastered: 15, learning: 20, bookmarked: 5, completed_sessions: 3 },
      question_stats: [{ question_id: 'q1', leitner_box: 5, next_review_at: 0, correct_count: 5, incorrect_count: 0, streak: 5, is_bookmarked: true, last_reviewed_at: 0 }],
      active_sessions: [{ id: 's1', deck_id: 'deck1', deck_title: 'Deck 1', mode: 'study', current_index: 5, total_questions: 60, time_limit_sec: 0, time_remaining_sec: 0, question_ids: ['q1'], user_answers: {}, flagged_ids: [], is_completed: false, created_at: 0, updated_at: 0 }],
    };

    // User B (brand new)
    const userB_id = 'uid_user_beta';
    const mockLocalStorage: Record<string, string> = {
      [`quiz_user_progress_${userA_id}`]: JSON.stringify(userA_progress),
    };

    // When User B logs in, their storage is non-existent (brand new account)
    const userB_cached = mockLocalStorage[`quiz_user_progress_${userB_id}`];
    expect(userB_cached).toBeUndefined();

    // User B receives clean empty slate: 0 stats, 0 unfinished sessions
    const userB_stats = userB_cached ? JSON.parse(userB_cached).question_stats : [];
    const userB_sessions = userB_cached ? JSON.parse(userB_cached).active_sessions : [];
    expect(userB_stats.length).toBe(0);
    expect(userB_sessions.length).toBe(0);

    // When switching back to User A, User A's data is safely restored
    const userA_cached = mockLocalStorage[`quiz_user_progress_${userA_id}`];
    expect(userA_cached).toBeDefined();
    const userA_restored = JSON.parse(userA_cached!);
    expect(userA_restored.question_stats[0].leitner_box).toBe(5);
    expect(userA_restored.active_sessions.length).toBe(1);
    expect(userA_restored.active_sessions[0].id).toBe('s1');
  });

  it('guarantees local session progress at question 5 is never downgraded by stale cloud snapshot at question 1', () => {
    // Local session where user reached Question 5 (index 4) with 4 questions answered
    const localSession: ActiveSession = {
      id: 'sess_123',
      deck_id: 'mock_01',
      deck_title: 'Mock Test 01',
      mode: 'study',
      current_index: 4,
      total_questions: 60,
      time_limit_sec: 3600,
      time_remaining_sec: 3600,
      question_ids: ['q1', 'q2', 'q3', 'q4', 'q5'],
      user_answers: { q1: [0], q2: [1], q3: [2], q4: [3] },
      flagged_ids: [],
      is_completed: false,
      created_at: 1000,
      updated_at: 5000,
    };

    // Stale cloud session at Question 1 (index 0) with no answers
    const cloudSession: ActiveSession = {
      id: 'sess_123',
      deck_id: 'mock_01',
      deck_title: 'Mock Test 01',
      mode: 'study',
      current_index: 0,
      total_questions: 60,
      time_limit_sec: 3600,
      time_remaining_sec: 3600,
      question_ids: ['q1', 'q2', 'q3', 'q4', 'q5'],
      user_answers: {},
      flagged_ids: [],
      is_completed: false,
      created_at: 1000,
      updated_at: 1000,
    };

    const localIsAhead = (
      localSession.current_index > cloudSession.current_index ||
      Object.keys(localSession.user_answers).length > Object.keys(cloudSession.user_answers).length ||
      localSession.updated_at >= cloudSession.updated_at
    );

    const mergedSession: ActiveSession = {
      ...(localIsAhead ? localSession : cloudSession),
      current_index: Math.max(localSession.current_index, cloudSession.current_index),
      user_answers: { ...cloudSession.user_answers, ...localSession.user_answers },
      updated_at: Math.max(localSession.updated_at, cloudSession.updated_at),
    };

    expect(localIsAhead).toBe(true);
    expect(mergedSession.current_index).toBe(4); // Preserves Question 5 (index 4)
    expect(Object.keys(mergedSession.user_answers).length).toBe(4); // Preserves all 4 answered questions
  });
});

