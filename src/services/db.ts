import initSqlJs, { type Database, type SqlJsStatic } from 'sql.js';
import { getSqlWasmBinary } from './sql-wasm-binary';
import type { 
  Deck, 
  Question, 
  QuestionStats, 
  ActiveSession, 
  SearchFilter, 
  SearchResult,
  CustomQuestionQueryOptions,
  QuestionScope,
  SessionMode,
  ProgressExportData
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
  private currentUserId: string | null = null;

  async init(): Promise<void> {
    if (this.initPromise) return this.initPromise;
    this.initPromise = this._doInit();
    return this.initPromise;
  }

  private async _doInit(): Promise<void> {
    const wasmBinary = getSqlWasmBinary().buffer as ArrayBuffer;
    this.SQL = await initSqlJs({
      wasmBinary,
    });

    if (typeof localStorage !== 'undefined') {
      this.currentUserId = localStorage.getItem('quiz_last_active_user_id') || null;
    }

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
        category_id TEXT DEFAULT 'fast_track',
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
    } catch {
      // FTS4 might already exist
    }

    // Safe migration: Add category_id to decks if missing from earlier schema versions
    try {
      this.db.run(`ALTER TABLE decks ADD COLUMN category_id TEXT DEFAULT 'fast_track';`);
    } catch {
      // Column already exists, safe to ignore
    }

    try {
      this.db.run(`UPDATE decks SET category_id = 'fast_track' WHERE category_id IS NULL OR category_id = '';`);
    } catch {
      // Ignore
    }
  }

  public persistImmediate(): void {
    if (this.saveTimeout) {
      clearTimeout(this.saveTimeout);
      this.saveTimeout = null;
    }
    if (this.db) {
      const data = this.db.export();
      saveDbToIDB(data);

      // Đồng thời lưu tức thì bản sao lưu vào localStorage cho user hiện tại
      if (this.currentUserId && typeof localStorage !== 'undefined') {
        try {
          const exportStr = this.syncExportProgressJSON();
          localStorage.setItem(`quiz_user_progress_${this.currentUserId}`, exportStr);
        } catch (e) {
          console.warn('Lỗi ghi đè localStorage tức thời:', e);
        }
      }
    }
  }

  private persistDebounced(): void {
    // Để đảm bảo không bao giờ mất dữ liệu khi người dùng tắt app hoặc nhấn thoát,
    // ta chạy persistImmediate ngay lập tức!
    this.persistImmediate();
  }

  /**
   * Xuất nhanh toàn bộ dữ liệu tiến độ (question_stats, active_sessions) đồng bộ từ memory
   */
  public syncExportProgressJSON(): string {
    if (!this.db) return '{}';
    const statsStmt = this.db.prepare(`
      SELECT question_id, leitner_box, next_review_at, correct_count, 
             incorrect_count, streak, is_bookmarked, last_reviewed_at
      FROM question_stats;
    `);
    const questionStats: QuestionStats[] = [];
    while (statsStmt.step()) {
      const row = statsStmt.getAsObject();
      questionStats.push({
        question_id: row.question_id as string,
        leitner_box: row.leitner_box as number,
        next_review_at: row.next_review_at as number,
        correct_count: row.correct_count as number,
        incorrect_count: row.incorrect_count as number,
        streak: row.streak as number,
        is_bookmarked: Boolean(row.is_bookmarked),
        last_reviewed_at: row.last_reviewed_at as number,
      });
    }
    statsStmt.free();

    const sessStmt = this.db.prepare('SELECT * FROM active_sessions WHERE is_completed = 0;');
    const sessions: ActiveSession[] = [];
    while (sessStmt.step()) {
      const row = sessStmt.getAsObject();
      sessions.push(this._mapRowToSession(row));
    }
    sessStmt.free();

    const exportData: ProgressExportData = {
      app: 'QuizLearningPro',
      version: 1,
      exported_at: Date.now(),
      exported_at_iso: new Date().toISOString(),
      stats_summary: {
        total_questions: questionStats.length,
        mastered: questionStats.filter((s) => s.leitner_box === 5).length,
        learning: questionStats.filter((s) => s.leitner_box >= 2 && s.leitner_box <= 4).length,
        bookmarked: questionStats.filter((s) => s.is_bookmarked).length,
        completed_sessions: 0,
      },
      question_stats: questionStats,
      active_sessions: sessions,
    };
    return JSON.stringify(exportData);
  }

  /**
   * Chuyển đổi tài khoản người dùng đang đăng nhập.
   * Cách ly hoàn toàn tiến độ (hộp Leitner, bookmark, bài dở dang) giữa các account.
   */
  async switchUser(newUserId: string | null): Promise<void> {
    await this.init();
    if (!this.db) return;

    // QUAN TRỌNG NHẤT: Nếu là cùng một tài khoản đang hoạt động (ví dụ khi tắt mở lại app),
    // TUYỆT ĐỐI KHÔNG XÓA DỮ LIỆU ĐANG CÓ!
    if (this.currentUserId && this.currentUserId === newUserId) {
      return;
    }

    // 1. Nếu có tài khoản cũ đang chạy và khác với newUserId, lưu bản backup tiến độ vào localStorage
    if (this.currentUserId && this.currentUserId !== newUserId && typeof localStorage !== 'undefined') {
      try {
        const currentData = this.syncExportProgressJSON();
        localStorage.setItem(`quiz_user_progress_${this.currentUserId}`, currentData);
      } catch (err) {
        console.warn('Lưu tiến độ người dùng trước thất bại:', err);
      }
    }

    // 2. Dọn sạch tiến độ hiện tại trong SQLite để tránh bị lẫn dữ liệu giữa các user
    this.db.run('DELETE FROM question_stats;');
    this.db.run('DELETE FROM active_sessions;');

    this.currentUserId = newUserId;
    if (typeof localStorage !== 'undefined') {
      if (newUserId) {
        localStorage.setItem('quiz_last_active_user_id', newUserId);
      } else {
        localStorage.removeItem('quiz_last_active_user_id');
      }
    }

    // 3. Nếu là user hợp lệ, nạp lại tiến độ đã lưu trước đó của user này (nếu có)
    if (newUserId && typeof localStorage !== 'undefined') {
      const cached = localStorage.getItem(`quiz_user_progress_${newUserId}`);
      if (cached) {
        try {
          await this.importProgressJSON(cached, 'overwrite');
        } catch (err) {
          console.warn('Khôi phục tiến độ cache của tài khoản thất bại:', err);
        }
      }
    }

    // 4. Lưu ngay snapshot mới vào IndexedDB
    this.persistImmediate();
  }

  getCurrentUserId(): string | null {
    return this.currentUserId;
  }

  private async _seedDecksIfEmpty(): Promise<void> {
    if (!this.db) return;

    // Ingest all JSON decks bundled in src/data/decks that are not yet in SQLite
    const deckFiles = import.meta.glob<{ default: any }>('../data/decks/*.json', { eager: true });
    let newlyIngested = false;

    for (const path in deckFiles) {
      const deckData = deckFiles[path].default || deckFiles[path];
      if (!deckData || !deckData.questions) continue;

      const filename = path.split('/').pop()?.replace('.json', '') || 'Deck';
      const deckId = filename.toLowerCase().replace(/[^a-z0-9_-]/g, '_');

      // Check if this deck is already ingested
      const existing = this.db.exec('SELECT id FROM decks WHERE id = ?;', [deckId]);
      if (existing.length > 0 && existing[0].values.length > 0) {
        continue;
      }

      newlyIngested = true;
      const title = deckData.title || filename;
      const source = deckData.source || filename;
      let categoryId = deckData.category_id || 'fast_track';
      if (!deckData.category_id) {
        const lower = (filename + ' ' + title).toLowerCase();
        if (lower.includes('japan') || lower.includes('nhật') || lower.includes('jlpt')) {
          categoryId = 'japanese';
        } else if (lower.includes('english') || lower.includes('toeic') || lower.includes('ielts')) {
          categoryId = 'english';
        }
      }
      const now = Date.now();

      this.db.run(
        'INSERT OR REPLACE INTO decks (id, title, source, total_questions, category_id, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?);',
        [deckId, title, source, deckData.questions.length, categoryId, now, now]
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

    if (newlyIngested) {
      this.persistImmediate();
    }
  }

  async getDecks(): Promise<Deck[]> {
    await this.init();
    if (!this.db) return [];

    const stmt = this.db.prepare(`
      SELECT 
        d.id, d.title, d.source, d.total_questions, d.category_id, d.created_at, d.updated_at,
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
        category_id: (row.category_id as string) || 'fast_track',
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
        d.id, d.title, d.source, d.total_questions, d.category_id, d.created_at, d.updated_at,
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
        category_id: (row.category_id as string) || 'fast_track',
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

    if (filter.min_box !== undefined && filter.max_box !== undefined) {
      conditions.push('qs.leitner_box BETWEEN ? AND ?');
      params.push(filter.min_box, filter.max_box);
    } else if (filter.box !== undefined) {
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

  private _buildCustomWhereClause(options: { scope: QuestionScope; deckIds?: string[]; categoryId?: string }): { whereClause: string; params: any[] } {
    const conditions: string[] = [];
    const params: any[] = [];

    if (options.deckIds && options.deckIds.length > 0) {
      const placeholders = options.deckIds.map(() => '?').join(',');
      conditions.push(`q.id IN (SELECT question_id FROM deck_questions WHERE deck_id IN (${placeholders}))`);
      params.push(...options.deckIds);
    } else if (options.categoryId && options.categoryId !== 'all') {
      conditions.push(`q.id IN (SELECT dq.question_id FROM deck_questions dq JOIN decks d ON dq.deck_id = d.id WHERE d.category_id = ?)`);
      params.push(options.categoryId);
    }

    switch (options.scope) {
      case 'new':
        // Questions that have never been attempted
        conditions.push('(qs.correct_count = 0 AND qs.incorrect_count = 0)');
        break;
      case 'learning_box12':
        // Questions in Box 1 or Box 2 (struggling or unmastered)
        conditions.push('(qs.leitner_box IN (1, 2))');
        break;
      case 'bookmarked':
        conditions.push('qs.is_bookmarked = 1');
        break;
      case 'all':
      default:
        // No extra condition
        break;
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    return { whereClause, params };
  }

  async getCustomQuestions(options: CustomQuestionQueryOptions): Promise<Question[]> {
    await this.init();
    if (!this.db) return [];

    const { whereClause, params } = this._buildCustomWhereClause(options);
    const limit = Math.max(1, options.count || 15);
    const orderBy = options.shuffle !== false ? 'ORDER BY RANDOM()' : 'ORDER BY q.id ASC';

    const sql = `
      SELECT DISTINCT
        q.id, q.deck_id, q.type, q.question, q.options_json, q.answer_json,
        q.explanation, q.note, q.answer_source, q.shuffle_options,
        q.vi_question, q.vi_options_json,
        qs.leitner_box, qs.next_review_at, qs.correct_count, qs.incorrect_count,
        qs.streak, qs.is_bookmarked, qs.last_reviewed_at
      FROM questions q
      LEFT JOIN question_stats qs ON q.id = qs.question_id
      ${whereClause}
      ${orderBy}
      LIMIT ?;
    `;

    const stmt = this.db.prepare(sql);
    stmt.bind([...params, limit]);

    const questions: Question[] = [];
    while (stmt.step()) {
      questions.push(this._mapRowToQuestion(stmt.getAsObject()));
    }
    stmt.free();
    return questions;
  }

  async countAvailableQuestions(options: Omit<CustomQuestionQueryOptions, 'count'>): Promise<number> {
    await this.init();
    if (!this.db) return 0;

    const { whereClause, params } = this._buildCustomWhereClause(options);
    const sql = `
      SELECT COUNT(DISTINCT q.id) as count
      FROM questions q
      LEFT JOIN question_stats qs ON q.id = qs.question_id
      ${whereClause};
    `;

    const stmt = this.db.prepare(sql);
    stmt.bind(params);
    let count = 0;
    if (stmt.step()) {
      count = (stmt.getAsObject().count as number) || 0;
    }
    stmt.free();
    return count;
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

  async deleteSession(sessionId: string, resetStats: boolean = true): Promise<void> {
    await this.init();
    if (!this.db) return;

    if (resetStats) {
      const session = await this.getActiveSession(sessionId);
      if (session) {
        // Reset Leitner stats for all questions answered in this cancelled session
        const answeredQIds = Object.keys(session.user_answers || {});
        for (const qId of answeredQIds) {
          this.db.run('DELETE FROM question_stats WHERE question_id = ?;', [qId]);
        }
      }
    }

    this.db.run('DELETE FROM active_sessions WHERE id = ?;', [sessionId]);
    this.persistImmediate();
  }

  async resetDeckProgress(deckId: string): Promise<void> {
    await this.init();
    if (!this.db) return;

    if (deckId === '_all' || deckId === 'all') {
      this.db.run('DELETE FROM question_stats;');
      this.db.run('DELETE FROM active_sessions;');
    } else {
      this.db.run(`
        DELETE FROM question_stats 
        WHERE question_id IN (
          SELECT question_id FROM deck_questions WHERE deck_id = ?
        );
      `, [deckId]);
      this.db.run('DELETE FROM active_sessions WHERE deck_id = ?;', [deckId]);
    }
    this.persistImmediate();
  }

  async resetAllProgress(): Promise<void> {
    await this.init();
    if (!this.db) return;

    this.db.run('DELETE FROM question_stats;');
    this.db.run('DELETE FROM active_sessions;');
    this.persistImmediate();
  }

  async getOverallStats(categoryId?: string): Promise<{
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

    let qRes: any[];
    if (categoryId && categoryId !== 'all') {
      const escaped = categoryId.replace(/'/g, "''");
      qRes = this.db.exec(`
        SELECT 
          COUNT(DISTINCT q.id) as total,
          COUNT(DISTINCT CASE WHEN qs.leitner_box = 5 THEN q.id END) as mastered,
          COUNT(DISTINCT CASE WHEN qs.leitner_box BETWEEN 2 AND 4 THEN q.id END) as learning,
          COUNT(DISTINCT CASE WHEN qs.is_bookmarked = 1 THEN q.id END) as bookmarked
        FROM questions q
        JOIN deck_questions dq ON q.id = dq.question_id
        JOIN decks d ON dq.deck_id = d.id
        LEFT JOIN question_stats qs ON q.id = qs.question_id
        WHERE d.category_id = '${escaped}';
      `);
    } else {
      qRes = this.db.exec(`
        SELECT 
          COUNT(*) as total,
          COUNT(CASE WHEN qs.leitner_box = 5 THEN 1 END) as mastered,
          COUNT(CASE WHEN qs.leitner_box BETWEEN 2 AND 4 THEN 1 END) as learning,
          COUNT(CASE WHEN qs.is_bookmarked = 1 THEN 1 END) as bookmarked
        FROM questions q
        LEFT JOIN question_stats qs ON q.id = qs.question_id;
      `);
    }

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

  async importCustomDeck(
    deckData: any,
    targetCategoryId: string = 'fast_track'
  ): Promise<{ id: string; title: string; count: number }> {
    await this.init();
    if (!this.db) throw new Error('Database not ready');

    if (!deckData || typeof deckData !== 'object') {
      throw new Error('Dữ liệu không phải là đối tượng JSON hợp lệ.');
    }

    if (!deckData.questions || !Array.isArray(deckData.questions) || deckData.questions.length === 0) {
      throw new Error('Bộ đề không có danh sách câu hỏi hợp lệ (thiếu mảng questions).');
    }

    const title = String(deckData.title || 'Bộ đề mới').trim();
    const source = String(deckData.source || 'Nhập từ file JSON').trim();
    const categoryId = String(deckData.category_id || targetCategoryId || 'fast_track').trim().toLowerCase();
    
    // Generate clean unique deck ID
    const baseId = title.toLowerCase().replace(/[^a-z0-9_-]/g, '_').slice(0, 30) || 'deck';
    const deckId = `custom_${baseId}_${Date.now()}`;
    const now = Date.now();

    this.db.run(
      'INSERT OR REPLACE INTO decks (id, title, source, total_questions, category_id, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?);',
      [deckId, title, source, deckData.questions.length, categoryId, now, now]
    );

    let position = 0;
    for (const q of deckData.questions) {
      position++;
      const qId = q.id ? String(q.id) : `q_${deckId}_${position}`;

      this.db.run(
        `INSERT OR REPLACE INTO questions (
          id, deck_id, type, question, options_json, answer_json, 
          explanation, note, answer_source, shuffle_options, 
          vi_question, vi_options_json, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);`,
        [
          qId,
          deckId,
          q.type || 'single',
          q.question || '',
          JSON.stringify(q.options || []),
          JSON.stringify(q.answer || [0]),
          q.explanation || '',
          q.note || '',
          q.answer_source || 'user_import',
          q.shuffle_options !== false ? 1 : 0,
          q.vi?.question || '',
          JSON.stringify(q.vi?.options || []),
          now,
        ]
      );

      this.db.run(
        'INSERT OR REPLACE INTO deck_questions (deck_id, question_id, position) VALUES (?, ?, ?);',
        [deckId, qId, position]
      );

      this.db.run(
        'INSERT OR IGNORE INTO question_stats (question_id, leitner_box, next_review_at, correct_count, incorrect_count, streak, is_bookmarked, last_reviewed_at) VALUES (?, 1, 0, 0, 0, 0, 0, 0);',
        [qId]
      );

      try {
        this.db.run(
          'INSERT INTO questions_fts (question_id, question, vi_question, explanation, note) VALUES (?, ?, ?, ?, ?);',
          [qId, q.question || '', q.vi?.question || '', q.explanation || '', q.note || '']
        );
      } catch {
        // ignore duplicate FTS
      }
    }

    this.persistImmediate();
    return { id: deckId, title, count: deckData.questions.length };
  }

  async deleteDeck(deckId: string): Promise<void> {
    await this.init();
    if (!this.db) return;

    this.db.run('DELETE FROM deck_questions WHERE deck_id = ?;', [deckId]);
    this.db.run('DELETE FROM questions WHERE deck_id = ?;', [deckId]);
    this.db.run('DELETE FROM active_sessions WHERE deck_id = ?;', [deckId]);
    this.db.run('DELETE FROM decks WHERE id = ?;', [deckId]);
    this.persistImmediate();
  }

  async exportProgressJSON(): Promise<string> {
    await this.init();
    if (!this.db) throw new Error('Database not initialized');

    // 1. Get all question stats
    const statsStmt = this.db.prepare(`
      SELECT question_id, leitner_box, next_review_at, correct_count, 
             incorrect_count, streak, is_bookmarked, last_reviewed_at
      FROM question_stats;
    `);
    const questionStats: QuestionStats[] = [];
    while (statsStmt.step()) {
      const row = statsStmt.getAsObject();
      questionStats.push({
        question_id: row.question_id as string,
        leitner_box: row.leitner_box as number,
        next_review_at: row.next_review_at as number,
        correct_count: row.correct_count as number,
        incorrect_count: row.incorrect_count as number,
        streak: row.streak as number,
        is_bookmarked: Boolean(row.is_bookmarked),
        last_reviewed_at: row.last_reviewed_at as number,
      });
    }
    statsStmt.free();

    // 2. Get active sessions
    const sessions = await this.getUnfinishedSessions();

    // 3. Overall stats
    const overallStats = await this.getOverallStats();

    const exportData: ProgressExportData = {
      app: 'QuizLearningPro',
      version: 1,
      exported_at: Date.now(),
      exported_at_iso: new Date().toISOString(),
      stats_summary: {
        total_questions: overallStats.totalQuestions,
        mastered: overallStats.mastered,
        learning: overallStats.learning,
        bookmarked: overallStats.bookmarked,
        completed_sessions: overallStats.completedSessions,
      },
      question_stats: questionStats,
      active_sessions: sessions,
    };

    return JSON.stringify(exportData, null, 2);
  }

  async importProgressJSON(
    jsonString: string,
    mergeMode: 'overwrite' | 'merge' = 'merge'
  ): Promise<{ importedStats: number; importedSessions: number }> {
    await this.init();
    if (!this.db) throw new Error('Database not initialized');

    let parsed: any;
    try {
      parsed = JSON.parse(jsonString);
    } catch {
      throw new Error('Dữ liệu JSON không hợp lệ.');
    }

    const questionStats: any[] = parsed.question_stats || [];
    const activeSessions: any[] = parsed.active_sessions || [];

    if (!Array.isArray(questionStats)) {
      throw new Error('Định dạng file không đúng: Thiếu danh sách question_stats.');
    }

    if (mergeMode === 'overwrite') {
      // Clear current stats and sessions before inserting
      this.db.run('DELETE FROM question_stats;');
      this.db.run('DELETE FROM active_sessions;');
    }

    let importedStats = 0;
    for (const stat of questionStats) {
      if (!stat.question_id) continue;
      importedStats++;

      if (mergeMode === 'merge') {
        const existing = await this.getQuestion(stat.question_id);
        const oldStats = existing?.stats;

        const leitner_box = Math.max(oldStats?.leitner_box || 1, stat.leitner_box || 1);
        const correct_count = (oldStats?.correct_count || 0) + (stat.correct_count || 0);
        const incorrect_count = (oldStats?.incorrect_count || 0) + (stat.incorrect_count || 0);
        const streak = Math.max(oldStats?.streak || 0, stat.streak || 0);
        const is_bookmarked = (oldStats?.is_bookmarked || stat.is_bookmarked) ? 1 : 0;
        const last_reviewed_at = Math.max(oldStats?.last_reviewed_at || 0, stat.last_reviewed_at || 0);
        const next_review_at = Math.max(oldStats?.next_review_at || 0, stat.next_review_at || 0);

        this.db.run(`
          INSERT INTO question_stats (
            question_id, leitner_box, next_review_at, correct_count,
            incorrect_count, streak, is_bookmarked, last_reviewed_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
          ON CONFLICT(question_id) DO UPDATE SET
            leitner_box = excluded.leitner_box,
            next_review_at = excluded.next_review_at,
            correct_count = excluded.correct_count,
            incorrect_count = excluded.incorrect_count,
            streak = excluded.streak,
            is_bookmarked = excluded.is_bookmarked,
            last_reviewed_at = excluded.last_reviewed_at;
        `, [
          stat.question_id,
          leitner_box,
          next_review_at,
          correct_count,
          incorrect_count,
          streak,
          is_bookmarked,
          last_reviewed_at,
        ]);
      } else {
        // Overwrite
        this.db.run(`
          INSERT OR REPLACE INTO question_stats (
            question_id, leitner_box, next_review_at, correct_count,
            incorrect_count, streak, is_bookmarked, last_reviewed_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?);
        `, [
          stat.question_id,
          stat.leitner_box || 1,
          stat.next_review_at || 0,
          stat.correct_count || 0,
          stat.incorrect_count || 0,
          stat.streak || 0,
          stat.is_bookmarked ? 1 : 0,
          stat.last_reviewed_at || 0,
        ]);
      }
    }

    let importedSessions = 0;
    if (Array.isArray(activeSessions)) {
      for (const s of activeSessions) {
        if (!s.id) continue;
        importedSessions++;
        await this.saveSession({
          id: s.id,
          deck_id: s.deck_id || 'unknown',
          deck_title: s.deck_title || 'Untitled',
          mode: s.mode || 'study',
          current_index: s.current_index || 0,
          total_questions: s.total_questions || 0,
          time_limit_sec: s.time_limit_sec || 0,
          time_remaining_sec: s.time_remaining_sec || 0,
          question_ids: s.question_ids || [],
          user_answers: s.user_answers || {},
          flagged_ids: s.flagged_ids || [],
          is_completed: Boolean(s.is_completed),
          score: s.score || 0,
          created_at: s.created_at || Date.now(),
          updated_at: s.updated_at || Date.now(),
        });
      }
    }

    // Immediately persist binary snapshot to IndexedDB
    if (this.db) {
      const data = this.db.export();
      await saveDbToIDB(data);
    }

    return { importedStats, importedSessions };
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
      mode: (row.mode as SessionMode) || 'study',
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
