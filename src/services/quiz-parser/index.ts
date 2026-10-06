import { normalizeRawText } from './normalizer';
import { detectBlocks } from './blockDetector';
import { parseAnswerKeys, type AnswerKeyMap } from './answerKeyParser';
import { parseQuestionLines, convertDraftsToQuestions } from './questionParser';
import { validateQuestion } from './validator';
import type { ParsedDeckResult, ParsedQuestion } from './types';

export * from './types';
export * from './normalizer';
export * from './blockDetector';
export * from './answerKeyParser';
export * from './questionParser';
export * from './validator';

/**
 * Main Facade: Parses raw exam text into a structured ParsedDeckResult.
 * Guaranteed pipeline:
 * Input -> Normalizer -> Block Detector -> Answer Key & Question Parser -> Validator -> Result
 */
export function parseQuizText(rawText: string, defaultTitle?: string): ParsedDeckResult {
  if (!rawText || !rawText.trim()) {
    return {
      title: defaultTitle || 'Bộ đề mới',
      totalQuestions: 0,
      validCount: 0,
      needReviewCount: 0,
      questions: [],
      unparsedBlocks: [],
    };
  }

  // 1. Conservative Normalization
  const normalized = normalizeRawText(rawText);

  // 2. Block Detection & Classification
  const blocks = detectBlocks(normalized);

  const answerKeyBlocks = blocks.filter((b) => b.type === 'ANSWER_KEY_BLOCK');
  const questionBlocks = blocks.filter((b) => b.type === 'QUESTION_BLOCK');
  const noiseBlocks = blocks.filter((b) => b.type === 'NOISE_BLOCK');

  // 3. Parse Answer Key Blocks (if any)
  const combinedAnswerKeyLines = answerKeyBlocks.flatMap((b) => b.lines);
  const answerKeyMap: AnswerKeyMap = parseAnswerKeys(combinedAnswerKeyLines);

  // 4. Parse Question Blocks
  const combinedQuestionLines = questionBlocks.flatMap((b) => b.lines);
  const { questions: drafts, unparsedLines } = parseQuestionLines(combinedQuestionLines);

  // 5. Convert drafts & map answer keys
  const parsedQuestions = convertDraftsToQuestions(drafts, answerKeyMap);

  // 6. Run pure validator to establish derived statuses
  const validatedQuestions: ParsedQuestion[] = parsedQuestions.map((q) => {
    const { status, warnings } = validateQuestion(q);
    return {
      ...q,
      status,
      warnings,
    };
  });

  // 7. Calculate deck statistics
  const validCount = validatedQuestions.filter((q) => q.status === 'valid').length;
  const needReviewCount = validatedQuestions.length - validCount;

  // 8. Compile unparsed blocks
  const unparsedBlocks: string[] = [
    ...noiseBlocks.map((b) => b.rawText),
    ...unparsedLines,
  ].filter(Boolean);

  // 9. Determine title (if not provided, attempt to find a title from initial noise block)
  let title = defaultTitle || 'Bộ đề mới';
  if ((!defaultTitle || defaultTitle === 'Bộ đề mới') && noiseBlocks.length > 0) {
    const candidate = noiseBlocks[0].lines.find((l) =>
      /^(?:ĐỀ\s+THI|BÀI\s+TẬP|KIỂM\s+TRA|CHỨNG\s+CHỈ|ÔN\s+TẬP)/i.test(l)
    );
    if (candidate) {
      title = candidate.replace(/^ĐỀ\s+THI[\s.:\-–]*/i, '').trim() || title;
    }
  }

  return {
    title,
    totalQuestions: validatedQuestions.length,
    validCount,
    needReviewCount,
    questions: validatedQuestions,
    unparsedBlocks,
  };
}

