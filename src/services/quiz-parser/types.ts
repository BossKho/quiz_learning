// Data contract and types for the Quiz Parser Engine

export type QuestionStatus =
  | 'valid'            // 🟢 100% valid: has question, >= 2 options, definitive answer(s)
  | 'missing_answer'   // 🟡 Question and options clean, but no answer detected
  | 'ambiguous'        // 🟡 Ambiguous answer: conflict between inline and answer key, or ambiguous text ("A hoặc B")
  | 'invalid_options'  // 🔴 < 2 options, duplicate option labels, or empty options
  | 'missing_question' // 🔴 Options present but question text is missing
  | 'parse_error';     // 🔴 Severe structure error

export type ParseWarningCode =
  | 'MISSING_QUESTION'
  | 'MISSING_OPTIONS'
  | 'TOO_FEW_OPTIONS'
  | 'DUPLICATE_OPTION_LABEL'
  | 'MISSING_ANSWER'
  | 'AMBIGUOUS_ANSWER'
  | 'ANSWER_KEY_CONFLICT'        // Conflict between inline answer and separate answer key
  | 'ANSWER_OUT_OF_RANGE'
  | 'DUPLICATE_QUESTION_NUMBER'   // Same question number encountered multiple times
  | 'UNPARSED_CONTENT';

export interface ParseWarning {
  code: ParseWarningCode;
  message: string;
}

export interface ParseSignals {
  questionDetected: boolean;
  optionsCount: number;
  answerDetected: boolean;
  answerFromSeparateKey: boolean;
  hasExplanation: boolean;
}

export interface ParsedQuestion {
  id: string;                      // Temporary UUID for UI key
  questionNumber?: number;         // Detected question number (e.g., 15 for "Câu 15")
  question: string;                // Cleaned question text
  options: string[];               // Options list (supports 2 to 8+)
  answer: number[] | null;         // null = no answer detected yet; [1] = B; [0, 2] = A & C
  explanation?: string;            // Optional explanation or notes
  
  status: QuestionStatus;          // Derived state calculated by pure validator
  warnings: ParseWarning[];        // Structured warning list
  signals: ParseSignals;           // Internal debug signals
  rawText: string;                 // Raw text snippet (in-memory only, discarded before SQLite commit)
}

export interface ParsedDeckResult {
  title: string;
  totalQuestions: number;
  validCount: number;
  needReviewCount: number;
  questions: ParsedQuestion[];
  unparsedBlocks: string[];        // Non-question text blocks (headers, notes, page numbers)
}

export type BlockType = 'QUESTION_BLOCK' | 'ANSWER_KEY_BLOCK' | 'NOISE_BLOCK';

export interface DetectedBlock {
  type: BlockType;
  lines: string[];
  rawText: string;
}

/**
 * Helper to convert single letter 'A'-'H' to 0-indexed number
 */
export function letterToIndex(letter: string): number {
  const upper = letter.trim().toUpperCase();
  const code = upper.charCodeAt(0);
  if (code >= 65 && code <= 90) {
    return code - 65; // A -> 0, B -> 1, C -> 2, ...
  }
  return -1;
}

/**
 * Helper to convert 0-indexed number to letter 'A'-'Z'
 */
export function indexToLetter(idx: number): string {
  if (idx >= 0 && idx < 26) {
    return String.fromCharCode(65 + idx);
  }
  return String(idx + 1);
}

