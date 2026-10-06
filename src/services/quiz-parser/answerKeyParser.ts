import { letterToIndex } from './types';

export interface AnswerKeyMap {
  [questionNumber: number]: number[];
}

/**
 * Parses all Answer Key blocks into a normalized lookup map: questionNumber -> answerIndices
 * Handles:
 * - "1. A" or "1.A" or "1 - A"
 * - "1A 2B 3C" or "1.A, 2.B, 3.C"
 * - Multi-answer keys: "1. A, C"
 */
export function parseAnswerKeys(textOrLines: string | string[]): AnswerKeyMap {
  const result: AnswerKeyMap = {};
  const lines = Array.isArray(textOrLines) ? textOrLines : textOrLines.split('\n');

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line) continue;

    // Ignore pure headers like "BẢNG ĐÁP ÁN"
    if (/^(?:BẢNG\s+ĐÁP\s+ÁN|ĐÁP\s+ÁN|ANSWER\s+KEY|KEY)[\s.:\-–]*$/i.test(line)) {
      continue;
    }

    // Pattern 1: Multi-token horizontal string: "1A 2B 3C" or "1.A, 2.B, 3.C" or "1 - A"
    // Matches: (number) followed by delimiter (letter(s))
    const tokenRegex = /(\d+)[\s.:\-–)]*([A-Ha-h](?:[,\s]+[A-Ha-h])*)/g;
    let match: RegExpExecArray | null;

    let foundTokens = false;
    while ((match = tokenRegex.exec(line)) !== null) {
      foundTokens = true;
      const qNum = parseInt(match[1], 10);
      const lettersStr = match[2];

      const letters = lettersStr
        .split(/[,\s]+/)
        .map((l) => l.trim().toUpperCase())
        .filter(Boolean);

      const indices = letters
        .map((l) => letterToIndex(l))
        .filter((idx) => idx !== -1);

      if (indices.length > 0 && !isNaN(qNum)) {
        result[qNum] = indices;
      }
    }

    // Pattern 2: Single line standard: "Câu 1: A" or "1: A"
    if (!foundTokens) {
      const singleMatch = line.match(/(?:Câu\s+)?(\d+)[\s.:\-–)]+([A-Ha-h])/i);
      if (singleMatch) {
        const qNum = parseInt(singleMatch[1], 10);
        const idx = letterToIndex(singleMatch[2]);
        if (!isNaN(qNum) && idx !== -1) {
          result[qNum] = [idx];
        }
      }
    }
  }

  return result;
}

