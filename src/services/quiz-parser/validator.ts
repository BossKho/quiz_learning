import type { ParsedQuestion, QuestionStatus, ParseWarning } from './types';

/**
 * Pure validator function that derives the question's validity status and structured warnings.
 * UI will re-run this whenever user modifies a question, ensuring status is always a derived state.
 */
export function validateQuestion(q: ParsedQuestion): { status: QuestionStatus; warnings: ParseWarning[] } {
  // Preserve existing context-specific warnings (like ANSWER_KEY_CONFLICT or DUPLICATE_QUESTION_NUMBER)
  const warnings: ParseWarning[] = [...q.warnings];

  // 1. Missing question text
  if (!q.question || q.question.trim().length === 0) {
    if (!warnings.some((w) => w.code === 'MISSING_QUESTION')) {
      warnings.push({ code: 'MISSING_QUESTION', message: 'Nội dung câu hỏi đang để trống.' });
    }
    return { status: 'missing_question', warnings };
  }

  // 2. Missing or insufficient options
  if (!q.options || q.options.length === 0) {
    if (!warnings.some((w) => w.code === 'MISSING_OPTIONS')) {
      warnings.push({ code: 'MISSING_OPTIONS', message: 'Câu hỏi chưa có các phương án lựa chọn.' });
    }
    return { status: 'invalid_options', warnings };
  }

  if (q.options.length < 2) {
    if (!warnings.some((w) => w.code === 'TOO_FEW_OPTIONS')) {
      warnings.push({
        code: 'TOO_FEW_OPTIONS',
        message: `Câu hỏi cần ít nhất 2 phương án (hiện có ${q.options.length}).`,
      });
    }
    return { status: 'invalid_options', warnings };
  }

  // Check if any option text is completely blank
  const hasEmptyOption = q.options.some((opt) => !opt.trim());
  if (hasEmptyOption) {
    if (!warnings.some((w) => w.code === 'TOO_FEW_OPTIONS')) {
      warnings.push({ code: 'TOO_FEW_OPTIONS', message: 'Có phương án đang để trống nội dung.' });
    }
    return { status: 'invalid_options', warnings };
  }

  // 3. Check existing conflict or ambiguity
  const hasConflict = warnings.some((w) => w.code === 'ANSWER_KEY_CONFLICT');
  const hasAmbiguity = warnings.some((w) => w.code === 'AMBIGUOUS_ANSWER');
  if (hasConflict || hasAmbiguity) {
    return { status: 'ambiguous', warnings };
  }

  // 4. Missing answer
  if (q.answer === null || q.answer.length === 0) {
    if (!warnings.some((w) => w.code === 'MISSING_ANSWER')) {
      warnings.push({ code: 'MISSING_ANSWER', message: 'Chưa xác định đáp án đúng.' });
    }
    return { status: 'missing_answer', warnings };
  }

  // 5. Answer out of range
  const outOfRange = q.answer.some((idx) => idx < 0 || idx >= q.options.length);
  if (outOfRange) {
    if (!warnings.some((w) => w.code === 'ANSWER_OUT_OF_RANGE')) {
      warnings.push({ code: 'ANSWER_OUT_OF_RANGE', message: 'Đáp án được chọn nằm ngoài phạm vi các phương án.' });
    }
    return { status: 'ambiguous', warnings };
  }

  // Filter out resolved warnings if user fixed them
  const cleanedWarnings = warnings.filter((w) => w.code !== 'MISSING_ANSWER' && w.code !== 'MISSING_QUESTION');

  return { status: 'valid', warnings: cleanedWarnings };
}

