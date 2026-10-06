import { letterToIndex, type ParsedQuestion, type ParseWarning } from './types';

interface RawOptionDraft {
  letter: string;
  index: number;
  text: string;
  isMarkedWithAsterisk: boolean;
}

interface QuestionDraft {
  questionNumber?: number;
  questionLines: string[];
  options: RawOptionDraft[];
  inlineAnswerIndices: number[] | null;
  isAmbiguousAnswer: boolean;
  ambiguousReason?: string;
  explanationLines: string[];
  rawLines: string[];
}

// Regex to detect new question start
// Matches: "Câu 1: ...", "Câu 01. ...", "Bài 2: ...", "Question 3: ...", "Q4. ...", or standalone "1. ..."
const QUESTION_START_REGEX = /^(?:(?:Câu|Bài|Question|Q)\s*(\d+)[\s.:\-–)]|(\d+)[\s.:)])\s*(.*)$/i;

// Regex to detect option start
// Matches: "A. ...", "*A. ...", "A) ...", "a. ...", "(A) ...", "[A] ...", "A.* ..."
const OPTION_START_REGEX = /^(?:(\*?)([A-Ha-h])[\s.:)]|(\*?)[\(\[]([A-Ha-h])[\)\]]|([A-Ha-h])[\s.:)]\*)\s*(.*)$/;

// Regex to detect inline answer line
const INLINE_ANSWER_REGEX = /^(?:Đáp\s*án(?:\s*đúng)?|ĐÁ|ĐA|Answer|Ans|Key)[\s.:\-–]*(.*)$/i;

// Regex to detect explanation / notes line
const EXPLANATION_REGEX = /^(?:Giải\s*thích|Lời\s*giải|Hướng\s*dẫn\s*giải|Explanation|Note|Ghi\s*chú)[\s.:\-–]*(.*)$/i;

// Regex to detect noise lines (page headers/footers)
const NOISE_LINE_REGEX = /^(?:Trang\s+\d+|Page\s+\d+|Mã\s+đề\s*:\s*\d+|Họ\s+và\s+tên\s+thí\s+sinh\s*:|Số\s+báo\s+danh\s*:)/i;

/**
 * Checks if a line is a question header vs a false-positive (e.g. standalone "1. A" from an answer key)
 */
function isRealQuestionStart(line: string): { isQuestion: boolean; qNum?: number; initialText?: string } {
  const match = line.match(QUESTION_START_REGEX);
  if (!match) return { isQuestion: false };

  const numStr = match[1] || match[2];
  const qNum = parseInt(numStr, 10);
  const remaining = (match[3] || '').trim();

  // Guard against standalone answer key line like "1. A" or "1. B"
  if (/^[A-Ha-h][\s.:\-–]*$/i.test(remaining)) {
    return { isQuestion: false };
  }

  // If number is huge (> 1000) and no explicit "Câu/Bài" prefix, likely a year in content
  if (!match[1] && qNum > 500) {
    return { isQuestion: false };
  }

  return { isQuestion: true, qNum, initialText: remaining };
}

/**
 * Checks if a line is an option start
 */
function isOptionStart(line: string): { isOption: boolean; letter?: string; isAsterisk?: boolean; initialText?: string } {
  const match = line.match(OPTION_START_REGEX);
  if (!match) return { isOption: false };

  // Match groups from: (asterisk)(letter) | (asterisk)[(letter)] | (letter).*
  const letter = (match[2] || match[4] || match[5] || '').toUpperCase();
  const isAsterisk = Boolean(match[1] || match[3] || match[5]);
  const initialText = (match[6] || '').trim();

  return {
    isOption: true,
    letter,
    isAsterisk,
    initialText,
  };
}

/**
 * Parses inline answer string: handles "A", "A, C", "A hoặc B"
 */
function parseInlineAnswerString(ansText: string): { indices: number[] | null; isAmbiguous: boolean; reason?: string } {
  const text = ansText.trim();
  if (!text) return { indices: null, isAmbiguous: false };

  // Check for ambiguous words: "hoặc", "or", "/"
  if (/hoặc|\bor\b|\//i.test(text)) {
    return {
      indices: null,
      isAmbiguous: true,
      reason: `Phát hiện đáp án không chắc chắn ('${text}'). Vui lòng chọn đáp án cụ thể.`,
    };
  }

  // Extract letters
  const letters = text.match(/[A-Ha-h]/g);
  if (!letters || letters.length === 0) {
    return { indices: null, isAmbiguous: false };
  }

  const indices = letters
    .map((l) => letterToIndex(l))
    .filter((idx) => idx !== -1);

  return {
    indices: indices.length > 0 ? indices : null,
    isAmbiguous: false,
  };
}

/**
 * Parses an array of lines belonging to a QUESTION_BLOCK into ParsedQuestion drafts
 */
export function parseQuestionLines(lines: string[]): { questions: QuestionDraft[]; unparsedLines: string[] } {
  const drafts: QuestionDraft[] = [];
  const unparsedLines: string[] = [];

  let currentDraft: QuestionDraft | null = null;
  type ParserState = 'IN_QUESTION' | 'IN_OPTION' | 'IN_EXPLANATION';
  let state: ParserState = 'IN_QUESTION';

  const finalizeCurrent = () => {
    if (currentDraft) {
      drafts.push(currentDraft);
      currentDraft = null;
    }
  };

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line) continue;

    // Filter noise lines
    if (NOISE_LINE_REGEX.test(line)) {
      unparsedLines.push(line);
      continue;
    }

    // 1. Check if a new Question starts
    const qCheck = isRealQuestionStart(line);
    if (qCheck.isQuestion) {
      finalizeCurrent();
      currentDraft = {
        questionNumber: qCheck.qNum,
        questionLines: qCheck.initialText ? [qCheck.initialText] : [],
        options: [],
        inlineAnswerIndices: null,
        isAmbiguousAnswer: false,
        explanationLines: [],
        rawLines: [line],
      };
      state = 'IN_QUESTION';
      continue;
    }

    // If we haven't encountered any question yet, line is unparsed header/noise
    if (!currentDraft) {
      unparsedLines.push(line);
      continue;
    }

    currentDraft.rawLines.push(line);

    // 2. Check if an Option starts
    const optCheck = isOptionStart(line);
    if (optCheck.isOption && optCheck.letter) {
      const idx = letterToIndex(optCheck.letter);
      currentDraft.options.push({
        letter: optCheck.letter,
        index: idx,
        text: optCheck.initialText || '',
        isMarkedWithAsterisk: Boolean(optCheck.isAsterisk),
      });
      state = 'IN_OPTION';
      continue;
    }

    // 3. Check if an Inline Answer line starts
    const ansMatch = line.match(INLINE_ANSWER_REGEX);
    if (ansMatch) {
      const parsedAns = parseInlineAnswerString(ansMatch[1]);
      currentDraft.inlineAnswerIndices = parsedAns.indices;
      currentDraft.isAmbiguousAnswer = parsedAns.isAmbiguous;
      currentDraft.ambiguousReason = parsedAns.reason;
      continue;
    }

    // 4. Check if an Explanation starts
    const expMatch = line.match(EXPLANATION_REGEX);
    if (expMatch) {
      if (expMatch[1]) {
        currentDraft.explanationLines.push(expMatch[1].trim());
      }
      state = 'IN_EXPLANATION';
      continue;
    }

    // 5. Context-Aware Safe Buffer Continuation
    if (state === 'IN_QUESTION') {
      currentDraft.questionLines.push(line);
    } else if (state === 'IN_OPTION') {
      const currentOpt = currentDraft.options[currentDraft.options.length - 1];
      if (currentOpt) {
        currentOpt.text = (currentOpt.text + ' ' + line).trim();
      }
    } else if (state === 'IN_EXPLANATION') {
      currentDraft.explanationLines.push(line);
    }
  }

  finalizeCurrent();
  return { questions: drafts, unparsedLines };
}

/**
 * Converts QuestionDrafts into ParsedQuestion records
 */
export function convertDraftsToQuestions(
  drafts: QuestionDraft[],
  answerKeyMap: { [qNum: number]: number[] } = {}
): ParsedQuestion[] {
  const result: ParsedQuestion[] = [];
  const seenNumbers = new Set<number>();

  for (let i = 0; i < drafts.length; i++) {
    const d = drafts[i];
    const qNum = d.questionNumber ?? i + 1;
    const warnings: ParseWarning[] = [];

    // Check duplicate question number
    if (d.questionNumber && seenNumbers.has(d.questionNumber)) {
      warnings.push({
        code: 'DUPLICATE_QUESTION_NUMBER',
        message: `Phát hiện câu hỏi bị trùng số thứ tự (Câu ${d.questionNumber}).`,
      });
    }
    if (d.questionNumber) seenNumbers.add(d.questionNumber);

    // Build options
    const options = d.options.map((o) => o.text.trim());

    // Check duplicate option labels
    const seenOptionLetters = new Set<string>();
    for (const opt of d.options) {
      if (seenOptionLetters.has(opt.letter)) {
        warnings.push({
          code: 'DUPLICATE_OPTION_LABEL',
          message: `Trùng lặp nhãn phương án (${opt.letter}).`,
        });
      }
      seenOptionLetters.add(opt.letter);
    }

    // Resolve Answer: Priority & Conflict Checking
    let resolvedAnswer: number[] | null = null;
    let answerFromKey = false;

    // Check asterisk answers from options
    const asteriskIndices = d.options
      .filter((o) => o.isMarkedWithAsterisk && o.index !== -1)
      .map((o) => o.index);

    const inlineAnswer = d.inlineAnswerIndices || (asteriskIndices.length > 0 ? asteriskIndices : null);
    const keyAnswer = answerKeyMap[qNum] ?? null;

    let isAmbiguous = d.isAmbiguousAnswer;

    if (inlineAnswer && keyAnswer) {
      // Both exist: check for conflict!
      const isMatch =
        inlineAnswer.length === keyAnswer.length &&
        inlineAnswer.every((val, idx) => val === keyAnswer[idx]);

      if (!isMatch) {
        isAmbiguous = true;
        warnings.push({
          code: 'ANSWER_KEY_CONFLICT',
          message: `Xung đột: Trong câu phát hiện đáp án khác với bảng đáp án riêng.`,
        });
        resolvedAnswer = null; // Do not guess blindly!
      } else {
        resolvedAnswer = inlineAnswer;
      }
    } else if (inlineAnswer) {
      resolvedAnswer = inlineAnswer;
    } else if (keyAnswer) {
      resolvedAnswer = keyAnswer;
      answerFromKey = true;
    }

    if (d.ambiguousReason) {
      warnings.push({
        code: 'AMBIGUOUS_ANSWER',
        message: d.ambiguousReason,
      });
    }

    const questionText = d.questionLines.join(' ').trim();
    const explanationText = d.explanationLines.join('\n').trim() || undefined;

    const parsedQ: ParsedQuestion = {
      id: `parsed_q_${Date.now()}_${i}_${Math.random().toString(36).substring(2, 7)}`,
      questionNumber: d.questionNumber,
      question: questionText,
      options,
      answer: resolvedAnswer,
      explanation: explanationText,
      status: 'valid', // Will be calculated by pure validateQuestion()
      warnings,
      signals: {
        questionDetected: Boolean(questionText),
        optionsCount: options.length,
        answerDetected: resolvedAnswer !== null,
        answerFromSeparateKey: answerFromKey,
        hasExplanation: Boolean(explanationText),
      },
      rawText: d.rawLines.join('\n'),
    };

    if (isAmbiguous) {
      parsedQ.status = 'ambiguous';
    }

    result.push(parsedQ);
  }

  return result;
}
