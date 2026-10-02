import initSqlJs, { type Database, type SqlJsStatic } from 'sql.js';
import type { 
  Deck, 
  Question, 
  QuestionStats, 
  ActiveSession, 
  SearchFilter, 
  SearchResult 
} from '@/types/quiz';

// IndexedDB database name and store name for persistence
const IDB_NAME = 'QuizPlatformDB';
const IDB_STORE = 'sqlite_snapshots';
const IDB_KEY = 'latest_db';

// Simple lightweight IndexedDB wrapper for binary SQLite storage
function openIDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(IDB_NAME, 1);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(IDB_STORE)) {
        db.createObjectStore(IDB_STORE);
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function loadDbFromIDB(): Promise<Uint8Array | null> {
  try {
    const db = await openIDB();
    return new Promise((resolve) => {
      const tx = db.transaction(IDB_STORE, 'readonly');
      const store = tx.objectStore(IDB_STORE);
      const req = store.get(IDB_KEY);
      req.onsuccess = () => {
        if (req.result instanceof Uint8Array) {
          resolve(req.result);
        } else {
          resolve(null);
        }
      };
      req.onerror = () => resolve(null);
    });
  } catch {
    return null;
  }
}

async function saveDbToIDB(data: Uint8Array): Promise<void> {
  try {
    const db = await openIDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(IDB_STORE, 'readwrite');
      const store = tx.objectStore(IDB_STORE);
      const req = store.put(data, IDB_KEY);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  } catch (err) {
    console.error('Failed to persist SQLite to IndexedDB:', err);
  }
}

class DatabaseManager {
  private SQL: SqlJsStatic | null = null;
  private db: Database | null = null;
  private saveTimeout: ReturnType<typeof setTimeout> | null = null;
  private initPromise: Promise<void> | null = null;

  async init(): Promise<void> {
    if (this.initPromise) return this.initPromise;
    this.initPromise = this._doInit();
    return this.initPromise;
  }

  private async _doInit(): Promise<void> {
    this.SQL = await initSqlJs({
      locateFile: (file) => `/${file}`,
    });

    const savedBinary = await loadDbFromIDB();
    if (savedBinary && savedBinary.length > 0) {
      try {
        this.db = new this.SQL.Database(savedBinary);
      } catch (e) {
        console.warn('Could not restore SQLite snapshot, creating new:', e);
        this.db = new this.SQL.Database();
        this._createSchema();
      }
    } else {
      this.db = new this.SQL.Database();
      this._createSchema();
    }

    // Ensure schema is up to date
    this._createSchema();

    // Check if initial ingestion is needed
    await this._seedDecksIfEmpty();
  }

  private _createSchema(): void {
    if (!this.db) return;

    this.db.run(`
      CREATE TABLE IF NOT EXISTS decks (
        id TEXT PRIMARY KEY,
        title TEXT NOT NULL,
        source TEXT,
        total_questions INTEGER NOT NULL DEFAULT 0,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL
      );

      CREATE TABLE IF NOT EXISTS questions (
        id TEXT PRIMARY KEY,
        deck_id TEXT NOT NULL,
        type TEXT NOT NULL,
        question TEXT NOT NULL,
        options_json TEXT NOT NULL,
        answer_json TEXT NOT NULL,
        explanation TEXT,
        note TEXT,
        answer_source TEXT,
        shuffle_options INTEGER NOT NULL DEFAULT 1,
        vi_question TEXT,
        vi_options_json TEXT,
        created_at INTEGER NOT NULL
      );

      CREATE TABLE IF NOT EXISTS deck_questions (
        deck_id TEXT NOT NULL,
        question_id TEXT NOT NULL,
        position INTEGER NOT NULL,
        PRIMARY KEY (deck_id, question_id)
      );

      CREATE TABLE IF NOT EXISTS question_stats (
        question_id TEXT PRIMARY KEY,
        leitner_box INTEGER NOT NULL DEFAULT 1,
        next_review_at INTEGER NOT NULL DEFAULT 0,
        correct_count INTEGER NOT NULL DEFAULT 0,
        incorrect_count INTEGER NOT NULL DEFAULT 0,
        streak INTEGER NOT NULL DEFAULT 0,
        is_bookmarked INTEGER NOT NULL DEFAULT 0,
        last_reviewed_at INTEGER NOT NULL DEFAULT 0
      );

      CREATE TABLE IF NOT EXISTS active_sessions (
        id TEXT PRIMARY KEY,
        deck_id TEXT NOT NULL,
        deck_title TEXT NOT NULL,
        mode TEXT NOT NULL,
        current_index INTEGER NOT NULL DEFAULT 0,
        total_questions INTEGER NOT NULL,
        time_limit_sec INTEGER DEFAULT 0,
        time_remaining_sec INTEGER DEFAULT 0,
        question_ids_json TEXT NOT NULL,
        user_answers_json TEXT NOT NULL,
        flagged_ids_json TEXT NOT NULL,
        is_completed INTEGER NOT NULL DEFAULT 0,
        score REAL DEFAULT 0,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL
      );

      CREATE TABLE IF NOT EXISTS user_settings (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL
      );
    `);

    // Create FTS4 virtual table for full-text search across EN/VI questions, explanations, and notes
    try {
      this.db.run(`
        CREATE VIRTUAL TABLE IF NOT EXISTS questions_fts USING fts4(
          question_id,
          question,
          vi_question,
          explanation,
          note
        );
      `);
    } catch (err) {
      console.warn('FTS4 creation warning:', err);
    }
  }

  private persistDebounced(): void {
    if (this.saveTimeout) {
      clearTimeout(this.saveTimeout);
    }
    this.saveTimeout = setTimeout(() => {
      if (this.db) {
        const data = this.db.export();
        saveDbToIDB(data);
      }
    }, 400);
  }

  private async _seedDecksIfEmpty(): Promise<void> {
    if (!this.db) return;

    const res = this.db.exec('SELECT COUNT(*) as count FROM decks;');
    const deckCount = res.length > 0 && res[0].values.length > 0 ? (res[0].values[0][0] as number) : 0;
    
    if (deckCount > 0) {
      return; // Already populated
    }

    // Ingest all JSON decks bundled in src/data/decks
    const deckFiles = import.meta.glob<{ default: any }>('../data/decks/*.json', { eager: true });
    
    for (const path in deckFiles) {
      const deckData = deckFiles[path].default || deckFiles[path];
      if (!deckData || !deckData.questions) continue;

      const filename = path.split('/').pop()?.replace('.json', '') || 'Deck';
      const deckId = filename.toLowerCase().replace(/[^a-z0-9_-]/g, '_');
      const title = deckData.title || filename;
      const source = deckData.source || filename;
      const now = Date.now();

      this.db.run(
        'INSERT OR REPLACE INTO decks (id, title, source, total_questions, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?);',
        [deckId, title, source, deckData.questions.length, now, now]
      );

      let position = 0;
      for (const q of deckData.questions) {
        position++;
        // Insert question if not exists
        this.db.run(
          `INSERT OR IGNORE INTO questions (
            id, deck_id, type, question, options_json, answer_json, 
            explanation, note, answer_source, shuffle_options, 
            vi_question, vi_options_json, created_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);`,
          [
            q.id,
            deckId,
            q.type || 'single',
            q.question || '',
            JSON.stringify(q.options || []),
            JSON.stringify(q.answer || [0]),
            q.explanation || '',
            q.note || '',
            q.answer_source || '',
            q.shuffle_options !== false ? 1 : 0,
            q.vi?.question || '',
            JSON.stringify(q.vi?.options || []),
            now,
          ]
        );

        // Link deck to question
        this.db.run(
          'INSERT OR REPLACE INTO deck_questions (deck_id, question_id, position) VALUES (?, ?, ?);',
          [deckId, q.id, position]
        );

        // Initialize question stats if not exists
        this.db.run(
          'INSERT OR IGNORE INTO question_stats (question_id, leitner_box, next_review_at, correct_count, incorrect_count, streak, is_bookmarked, last_reviewed_at) VALUES (?, 1, 0, 0, 0, 0, 0, 0);',
          [q.id]
        );

        // Insert into FTS4 index
        try {
          this.db.run(
            'INSERT INTO questions_fts (question_id, question, vi_question, explanation, note) VALUES (?, ?, ?, ?, ?);',
            [q.id, q.question || '', q.vi?.question || '', q.explanation || '', q.note || '']
          );
        } catch {
          // Ignore duplicate fts insert
        }
      }
    }

    this.persistDebounced();
  }

  async getDecks(): Promise<Deck[]> {
    await this.init();
    if (!this.db) return [];

    const stmt = this.db.prepare(`
      SELECT 
        d.id, d.title, d.source, d.total_questions, d.created_at, d.updated_at,
        COUNT(CASE WHEN qs.leitner_box = 5 THEN 1 END) as mastered_count,
        COUNT(CASE WHEN qs.leitner_box BETWEEN 2 AND 4 THEN 1 END) as learning_count,
        COUNT(CASE WHEN qs.leitner_box = 1 THEN 1 END) as new_count
      FROM decks d
      LEFT JOIN deck_questions dq ON d.id = dq.deck_id
      LEFT JOIN question_stats qs ON dq.question_id = qs.question_id
      GROUP BY d.id
      ORDER BY 
        CASE WHEN d.id = '_all' THEN 1 ELSE 0 END,
        d.title ASC;
    `);

    const decks: Deck[] = [];
    while (stmt.step()) {
      const row = stmt.getAsObject();
      decks.push({
        id: row.id as string,
        title: row.title as string,
        source: row.source as string,
        total_questions: row.total_questions as number,
        mastered_count: (row.mastered_count as number) || 0,
        learning_count: (row.learning_count as number) || 0,
        new_count: (row.new_count as number) || 0,
        created_at: row.created_at as number,
        updated_at: row.updated_at as number,
      });
    }
    stmt.free();
    return decks;
  }

  async getDeck(deckId: string): Promise<Deck | null> {
    await this.init();
    if (!this.db) return null;

    const stmt = this.db.prepare(`
      SELECT 
        d.id, d.title, d.source, d.total_questions, d.created_at, d.updated_at,
        COUNT(CASE WHEN qs.leitner_box = 5 THEN 1 END) as mastered_count,
        COUNT(CASE WHEN qs.leitner_box BETWEEN 2 AND 4 THEN 1 END) as learning_count,
        COUNT(CASE WHEN qs.leitner_box = 1 THEN 1 END) as new_count
      FROM decks d
      LEFT JOIN deck_questions dq ON d.id = dq.deck_id
      LEFT JOIN question_stats qs ON dq.question_id = qs.question_id
      WHERE d.id = ?
      GROUP BY d.id;
    `);
    stmt.bind([deckId]);

    let deck: Deck | null = null;
    if (stmt.step()) {
      const row = stmt.getAsObject();
      deck = {
        id: row.id as string,
        title: row.title as string,
        source: row.source as string,
        total_questions: row.total_questions as number,
        mastered_count: (row.mastered_count as number) || 0,
        learning_count: (row.learning_count as number) || 0,
        new_count: (row.new_count as number) || 0,
        created_at: row.created_at as number,
        updated_at: row.updated_at as number,
      };
    }
    stmt.free();
    return deck;
  }

  async getDeckQuestions(deckId: string): Promise<Question[]> {
    await this.init();
    if (!this.db) return [];

    const stmt = this.db.prepare(`
      SELECT 
        q.id, q.deck_id, q.type, q.question, q.options_json, q.answer_json,
        q.explanation, q.note, q.answer_source, q.shuffle_options,
        q.vi_question, q.vi_options_json,
        qs.leitner_box, qs.next_review_at, qs.correct_count, qs.incorrect_count,
        qs.streak, qs.is_bookmarked, qs.last_reviewed_at
      FROM deck_questions dq
      JOIN questions q ON dq.question_id = q.id
      LEFT JOIN question_stats qs ON q.id = qs.question_id
      WHERE dq.deck_id = ?
      ORDER BY dq.position ASC;
    `);
    stmt.bind([deckId]);

    const list: Question[] = [];
    while (stmt.step()) {
      const row = stmt.getAsObject();
      list.push(this._mapRowToQuestion(row));
    }
    stmt.free();
    return list;
  }

  async getQuestion(id: string): Promise<Question | null> {
    await this.init();
    if (!this.db) return null;

    const stmt = this.db.prepare(`
      SELECT 
        q.id, q.deck_id, q.type, q.question, q.options_json, q.answer_json,
        q.explanation, q.note, q.answer_source, q.shuffle_options,
        q.vi_question, q.vi_options_json,
        qs.leitner_box, qs.next_review_at, qs.correct_count, qs.incorrect_count,
        qs.streak, qs.is_bookmarked, qs.last_reviewed_at
      FROM questions q
      LEFT JOIN question_stats qs ON q.id = qs.question_id
      WHERE q.id = ?;
    `);
    stmt.bind([id]);

    let res: Question | null = null;
    if (stmt.step()) {
      res = this._mapRowToQuestion(stmt.getAsObject());
    }
    stmt.free();
    return res;
  }

  async searchQuestions(filter: SearchFilter): Promise<SearchResult> {
    await this.init();
    if (!this.db) return { questions: [], total: 0 };

    const limit = filter.limit || 50;
    const offset = filter.offset || 0;
    const conditions: string[] = [];
    const params: any[] = [];

    let joinFts = '';
    if (filter.query && filter.query.trim().length > 0) {
      const cleanQuery = filter.query.trim().replace(/['"*]/g, '');
      if (cleanQuery.length > 0) {
        joinFts = 'JOIN questions_fts fts ON q.id = fts.question_id';
        conditions.push('questions_fts MATCH ?');
        // Match prefix or token
        params.push(`${cleanQuery}*`);
      }
    }

    if (filter.deck_id) {
      conditions.push('q.id IN (SELECT question_id FROM deck_questions WHERE deck_id = ?)');
      params.push(filter.deck_id);
    }

    if (filter.box !== undefined) {
      conditions.push('qs.leitner_box = ?');
      params.push(filter.box);
    }

    if (filter.is_bookmarked !== undefined) {
      conditions.push('qs.is_bookmarked = ?');
      params.push(filter.is_bookmarked ? 1 : 0);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    // Count total matches
    const countSql = `
      SELECT COUNT(DISTINCT q.id) as total
      FROM questions q
      ${joinFts}
      LEFT JOIN question_stats qs ON q.id = qs.question_id
      ${whereClause};
    `;
    const countStmt = this.db.prepare(countSql);
    countStmt.bind(params);
    let total = 0;
    if (countStmt.step()) {
      total = countStmt.getAsObject().total as number;
    }
    countStmt.free();

    // Query paginated results
    const selectSql = `
      SELECT DISTINCT
        q.id, q.deck_id, q.type, q.question, q.options_json, q.answer_json,
        q.explanation, q.note, q.answer_source, q.shuffle_options,
        q.vi_question, q.vi_options_json,
        qs.leitner_box, qs.next_review_at, qs.correct_count, qs.incorrect_count,
        qs.streak, qs.is_bookmarked, qs.last_reviewed_at
      FROM questions q
      ${joinFts}
      LEFT JOIN question_stats qs ON q.id = qs.question_id
      ${whereClause}
      ORDER BY q.id ASC
      LIMIT ? OFFSET ?;
    `;
    const selectStmt = this.db.prepare(selectSql);
    selectStmt.bind([...params, limit, offset]);

    const questions: Question[] = [];
    while (selectStmt.step()) {
      questions.push(this._mapRowToQuestion(selectStmt.getAsObject()));
    }
    selectStmt.free();

    return { questions, total };
  }

  async updateQuestionStats(questionId: string, isCorrect: boolean): Promise<QuestionStats> {
    await this.init();
    if (!this.db) throw new Error('Database not initialized');

    const now = Date.now();
    const existing = await this.getQuestion(questionId);
    let currentBox = existing?.stats?.leitner_box || 1;
    let streak = existing?.stats?.streak || 0;
    let correctCount = existing?.stats?.correct_count || 0;
    let incorrectCount = existing?.stats?.incorrect_count || 0;
    const isBookmarked = existing?.stats?.is_bookmarked ? 1 : 0;

    if (isCorrect) {
      currentBox = Math.min(5, currentBox + 1);
      streak += 1;
      correctCount += 1;
    } else {
      currentBox = Math.max(1, currentBox - 1);
      streak = 0;
      incorrectCount += 1;
    }

    // Leitner intervals in milliseconds: Box 1: 1 day, Box 2: 3 days, Box 3: 7 days, Box 4: 14 days, Box 5: 30 days
    const intervalsMs = [0, 86400000, 259200000, 604800000, 1209600000, 2592000000];
    const nextReviewAt = now + (intervalsMs[currentBox] || 86400000);

    this.db.run(`
      INSERT OR REPLACE INTO question_stats (
        question_id, leitner_box, next_review_at, correct_count, 
        incorrect_count, streak, is_bookmarked, last_reviewed_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?);
    `, [questionId, currentBox, nextReviewAt, correctCount, incorrectCount, streak, isBookmarked, now]);

    this.persistDebounced();

    return {
      question_id: questionId,
      leitner_box: currentBox,
      next_review_at: nextReviewAt,
      correct_count: correctCount,
      incorrect_count: incorrectCount,
      streak,
      is_bookmarked: Boolean(isBookmarked),
      last_reviewed_at: now,
    };
  }

  async toggleBookmark(questionId: string): Promise<boolean> {
    await this.init();
    if (!this.db) return false;

    const existing = await this.getQuestion(questionId);
    const newStatus = existing?.stats?.is_bookmarked ? 0 : 1;

    this.db.run(`
      INSERT INTO question_stats (question_id, leitner_box, next_review_at, correct_count, incorrect_count, streak, is_bookmarked, last_reviewed_at)
      VALUES (?, 1, 0, 0, 0, 0, ?, 0)
      ON CONFLICT(question_id) DO UPDATE SET is_bookmarked = ?;
    `, [questionId, newStatus, newStatus]);

    this.persistDebounced();
    return Boolean(newStatus);
  }

  async saveSession(session: ActiveSession): Promise<void> {
    await this.init();
    if (!this.db) return;

    this.db.run(`
      INSERT OR REPLACE INTO active_sessions (
        id, deck_id, deck_title, mode, current_index, total_questions,
        time_limit_sec, time_remaining_sec, question_ids_json, 
        user_answers_json, flagged_ids_json, is_completed, score, 
        created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);
    `, [
      session.id,
      session.deck_id,
      session.deck_title,
      session.mode,
      session.current_index,
      session.total_questions,
      session.time_limit_sec,
      session.time_remaining_sec,
      JSON.stringify(session.question_ids),
      JSON.stringify(session.user_answers),
      JSON.stringify(session.flagged_ids),
      session.is_completed ? 1 : 0,
      session.score || 0,
      session.created_at,
      Date.now(),
    ]);

    this.persistDebounced();
  }

  async getActiveSession(sessionId: string): Promise<ActiveSession | null> {
    await this.init();
    if (!this.db) return null;

    const stmt = this.db.prepare('SELECT * FROM active_sessions WHERE id = ?;');
    stmt.bind([sessionId]);

    let session: ActiveSession | null = null;
    if (stmt.step()) {
      const row = stmt.getAsObject();
      session = this._mapRowToSession(row);
    }
    stmt.free();
    return session;
  }

  async getUnfinishedSessions(): Promise<ActiveSession[]> {
    await this.init();
    if (!this.db) return [];

    const stmt = this.db.prepare(`
      SELECT * FROM active_sessions 
      WHERE is_completed = 0 
      ORDER BY updated_at DESC;
    `);

    const sessions: ActiveSession[] = [];
    while (stmt.step()) {
      sessions.push(this._mapRowToSession(stmt.getAsObject()));
    }
    stmt.free();
    return sessions;
  }

  async deleteSession(sessionId: string): Promise<void> {
    await this.init();
    if (!this.db) return;

    this.db.run('DELETE FROM active_sessions WHERE id = ?;', [sessionId]);
    this.persistDebounced();
  }

  async getOverallStats(): Promise<{
    totalQuestions: number;
    mastered: number;
    learning: number;
    bookmarked: number;
    completedSessions: number;
  }> {
    await this.init();
    if (!this.db) {
      return { totalQuestions: 0, mastered: 0, learning: 0, bookmarked: 0, completedSessions: 0 };
    }

    const qRes = this.db.exec(`
      SELECT 
        COUNT(*) as total,
        COUNT(CASE WHEN qs.leitner_box = 5 THEN 1 END) as mastered,
        COUNT(CASE WHEN qs.leitner_box BETWEEN 2 AND 4 THEN 1 END) as learning,
        COUNT(CASE WHEN qs.is_bookmarked = 1 THEN 1 END) as bookmarked
      FROM questions q
      LEFT JOIN question_stats qs ON q.id = qs.question_id;
    `);

    const sRes = this.db.exec(`
      SELECT COUNT(*) as completed_count FROM active_sessions WHERE is_completed = 1;
    `);

    const qRow = qRes.length > 0 && qRes[0].values.length > 0 ? qRes[0].values[0] : [0, 0, 0, 0];
    const sRow = sRes.length > 0 && sRes[0].values.length > 0 ? sRes[0].values[0] : [0];

    return {
      totalQuestions: Number(qRow[0]) || 0,
      mastered: Number(qRow[1]) || 0,
      learning: Number(qRow[2]) || 0,
      bookmarked: Number(qRow[3]) || 0,
      completedSessions: Number(sRow[0]) || 0,
    };
  }

  private _mapRowToQuestion(row: Record<string, any>): Question {
    return {
      id: row.id as string,
      deck_id: row.deck_id as string,
      type: (row.type as 'single' | 'multi') || 'single',
      question: row.question as string,
      options: JSON.parse(row.options_json || '[]'),
      answer: JSON.parse(row.answer_json || '[]'),
      explanation: (row.explanation as string) || '',
      note: (row.note as string) || '',
      answer_source: (row.answer_source as string) || '',
      shuffle_options: Boolean(row.shuffle_options),
      vi: {
        question: (row.vi_question as string) || '',
        options: JSON.parse(row.vi_options_json || '[]'),
      },
      stats: {
        question_id: row.id as string,
        leitner_box: (row.leitner_box as number) || 1,
        next_review_at: (row.next_review_at as number) || 0,
        correct_count: (row.correct_count as number) || 0,
        incorrect_count: (row.incorrect_count as number) || 0,
        streak: (row.streak as number) || 0,
        is_bookmarked: Boolean(row.is_bookmarked),
        last_reviewed_at: (row.last_reviewed_at as number) || 0,
      },
    };
  }

  private _mapRowToSession(row: Record<string, any>): ActiveSession {
    return {
      id: row.id as string,
      deck_id: row.deck_id as string,
      deck_title: row.deck_title as string,
      mode: row.mode as 'study' | 'exam',
      current_index: row.current_index as number,
      total_questions: row.total_questions as number,
      time_limit_sec: (row.time_limit_sec as number) || 0,
      time_remaining_sec: (row.time_remaining_sec as number) || 0,
      question_ids: JSON.parse(row.question_ids_json || '[]'),
      user_answers: JSON.parse(row.user_answers_json || '{}'),
      flagged_ids: JSON.parse(row.flagged_ids_json || '[]'),
      is_completed: Boolean(row.is_completed),
      score: row.score as number,
      created_at: row.created_at as number,
      updated_at: row.updated_at as number,
    };
  }
}

export const dbService = new DatabaseManager();
