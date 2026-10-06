import type { DetectedBlock } from './types';

// Regex identifying an explicit Answer Key section header
const ANSWER_KEY_HEADER_REGEX = /^(?:BẢNG\s+ĐÁP\s+ÁN|ĐÁP\s+ÁN(?:\s+ĐỀ|\s+THAM\s+KHẢO)?|ANSWER\s+KEY|KEY\s+ĐỀ\s+THI)[\s.:\-–]*$/i;

// Regex matching dense standalone answer pairs like "1. A", "1A", "1-A", "1: A"
const DENSE_ANSWER_PAIR_REGEX = /^\d+[\s.:\-–)]*\s*[A-Ha-h]$/;

// Regex matching horizontal answer chain: "1A 2B 3C" or "1.A, 2.B, 3.C" or "1:A 2:B"
const HORIZONTAL_ANSWER_CHAIN_REGEX = /(?:\b\d+[\s.:\-–)]*[A-Ha-h][,\s]*){3,}/;

// Regex identifying typical page headers/footers/noise
const NOISE_HEADER_REGEX = /^(?:Trang\s+\d+|Page\s+\d+|Mã\s+đề|Thời\s+gian\s+làm\s+bài|Họ\s+và\s+tên\s+thí\s+sinh|Số\s+báo\s+danh|ĐỀ\s+THI|KỲ\s+THI)[\s.:\-–]/i;

/**
 * Checks if a collection of lines represents an Answer Key block
 */
export function isAnswerKeyBlock(lines: string[]): boolean {
  if (lines.length === 0) return false;

  const firstLine = lines[0].trim();
  if (ANSWER_KEY_HEADER_REGEX.test(firstLine)) {
    return true;
  }

  // Check if multiple lines are dense single-letter answers
  const denseCount = lines.filter((l) => DENSE_ANSWER_PAIR_REGEX.test(l.trim())).length;
  if (lines.length >= 3 && denseCount / lines.length >= 0.7) {
    return true;
  }

  // Check horizontal chains
  const joined = lines.join(' ');
  if (HORIZONTAL_ANSWER_CHAIN_REGEX.test(joined) && !joined.includes('?')) {
    return true;
  }

  return false;
}

/**
 * Detects whether a single line is an Answer Key Header
 */
export function isAnswerKeyHeader(line: string): boolean {
  return ANSWER_KEY_HEADER_REGEX.test(line.trim());
}

/**
 * Splits normalized text into classified blocks:
 * Extracts Answer Key block(s) separately so question parser won't misidentify answer pairs as questions.
 */
export function detectBlocks(normalizedText: string): DetectedBlock[] {
  if (!normalizedText.trim()) return [];

  const rawBlocks = normalizedText.split(/\n\n+/);
  const detectedBlocks: DetectedBlock[] = [];

  for (const block of rawBlocks) {
    const trimmed = block.trim();
    if (!trimmed) continue;

    const lines = trimmed.split('\n').map((l) => l.trim()).filter(Boolean);
    if (lines.length === 0) continue;

    if (isAnswerKeyBlock(lines)) {
      detectedBlocks.push({
        type: 'ANSWER_KEY_BLOCK',
        lines,
        rawText: trimmed,
      });
    } else if (lines.length === 1 && NOISE_HEADER_REGEX.test(lines[0])) {
      detectedBlocks.push({
        type: 'NOISE_BLOCK',
        lines,
        rawText: trimmed,
      });
    } else {
      detectedBlocks.push({
        type: 'QUESTION_BLOCK',
        lines,
        rawText: trimmed,
      });
    }
  }

  return detectedBlocks;
}

