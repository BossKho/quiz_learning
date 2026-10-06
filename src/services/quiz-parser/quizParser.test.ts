import { describe, it, expect } from 'vitest';
import { parseQuizText, validateQuestion, normalizeRawText, parseAnswerKeys } from './index';
import type { ParsedQuestion } from './types';

describe('Quiz Parser Engine (Parser Spec v1.1)', () => {
  // -------------------------------------------------------------
  // 1. BEHAVIOR CATEGORY: QUESTION DETECTION
  // -------------------------------------------------------------
  describe('Question Detection', () => {
    it('TC-Q01: parses standard Vietnamese prefixes (Câu 1:, Bài 2.)', () => {
      const input = `
Câu 1: Thủ đô của Việt Nam là thành phố nào?
A. Hà Nội
B. TP. Hồ Chí Minh
C. Đà Nẵng
D. Huế
Đáp án: A

Bài 2. Đâu là đơn vị tiền tệ của Nhật Bản?
A. Won
B. Yên
C. Đô la
D. Baht
Đáp án: B
`;
      const result = parseQuizText(input);
      expect(result.totalQuestions).toBe(2);
      expect(result.validCount).toBe(2);
      expect(result.questions[0].questionNumber).toBe(1);
      expect(result.questions[0].question).toContain('Thủ đô của Việt Nam');
      expect(result.questions[0].options).toHaveLength(4);
      expect(result.questions[0].answer).toEqual([0]);

      expect(result.questions[1].questionNumber).toBe(2);
      expect(result.questions[1].question).toContain('đơn vị tiền tệ của Nhật Bản');
      expect(result.questions[1].answer).toEqual([1]);
    });

    it('TC-Q02: parses pure numeric numbering (1. ..., 2) ...)', () => {
      const input = `
1. Nước sôi ở nhiệt độ bao nhiêu độ C ở áp suất tiêu chuẩn?
A. 90
B. 100
C. 110
D. 120
Đáp án: B

2) Đâu là đại dương lớn nhất thế giới?
A) Đại Tây Dương
B) Ấn Độ Dương
C) Thái Bình Dương
D) Bắc Băng Dương
Đáp án: C
`;
      const result = parseQuizText(input);
      expect(result.totalQuestions).toBe(2);
      expect(result.questions[0].answer).toEqual([1]);
      expect(result.questions[1].answer).toEqual([2]);
    });

    it('TC-X03: does not falsely break questions when numbers/years appear inside question body', () => {
      const input = `
Câu 1: Năm 1945, sự kiện lịch sử trọng đại nào đã diễn ra tại quảng trường Ba Đình?
A. Tuyên ngôn Độc lập
B. Chiến thắng Điện Biên Phủ
C. Giải phóng miền Nam
D. Thống nhất đất nước
Đáp án: A
`;
      const result = parseQuizText(input);
      expect(result.totalQuestions).toBe(1);
      expect(result.questions[0].questionNumber).toBe(1);
      expect(result.questions[0].question).toContain('Năm 1945, sự kiện lịch sử trọng đại');
      expect(result.questions[0].answer).toEqual([0]);
    });

    it('TC-X05: flags duplicate question numbers with DUPLICATE_QUESTION_NUMBER warning', () => {
      const input = `
Câu 1: Câu hỏi thứ nhất
A. Đáp án 1
B. Đáp án 2
Đáp án: A

Câu 1: Câu hỏi bị trùng số
A. Phương án 1
B. Phương án 2
Đáp án: B
`;
      const result = parseQuizText(input);
      expect(result.totalQuestions).toBe(2);
      const dup = result.questions[1];
      expect(dup.warnings.some((w) => w.code === 'DUPLICATE_QUESTION_NUMBER')).toBe(true);
    });
  });

  // -------------------------------------------------------------
  // 2. BEHAVIOR CATEGORY: OPTION DETECTION & MULTILINE
  // -------------------------------------------------------------
  describe('Option Detection', () => {
    it('TC-O01: parses varied option label styles: A., A), (A), [A], a.', () => {
      const input = `
Câu 1: Thử nghiệm nhãn phương án
(A) Phương án A
[B] Phương án B
C) Phương án C
d. Phương án D
Đáp án: A
`;
      const result = parseQuizText(input);
      expect(result.totalQuestions).toBe(1);
      expect(result.questions[0].options).toHaveLength(4);
      expect(result.questions[0].options[0]).toBe('Phương án A');
      expect(result.questions[0].options[1]).toBe('Phương án B');
      expect(result.questions[0].options[2]).toBe('Phương án C');
      expect(result.questions[0].options[3]).toBe('Phương án D');
    });

    it('TC-B01: supports True / False (2 options)', () => {
      const input = `
Câu 1: Mặt trời mọc ở hướng Đông.
A. Đúng
B. Sai
Đáp án: A
`;
      const result = parseQuizText(input);
      expect(result.totalQuestions).toBe(1);
      expect(result.questions[0].options).toEqual(['Đúng', 'Sai']);
      expect(result.questions[0].status).toBe('valid');
      expect(result.questions[0].answer).toEqual([0]);
    });

    it('TC-X04: safe buffer continuation safely preserves multiline options from PDF wrap', () => {
      const input = `
Câu 1: Đoạn văn nào sau đây đúng?
A. Đây là một phương án rất dài
   và tiếp tục sang dòng thứ hai mà không bị cắt nhầm
B. Phương án ngắn
C. Một phương án khác cũng có
dòng tiếp nối
D. Phương án kết thúc
Đáp án: A
`;
      const result = parseQuizText(input);
      expect(result.totalQuestions).toBe(1);
      expect(result.questions[0].options).toHaveLength(4);
      expect(result.questions[0].options[0]).toBe(
        'Đây là một phương án rất dài và tiếp tục sang dòng thứ hai mà không bị cắt nhầm'
      );
      expect(result.questions[0].options[2]).toBe('Một phương án khác cũng có dòng tiếp nối');
    });

    it('TC-O03: supports more than 4 options (A through E)', () => {
      const input = `
Câu 1: Chọn một trong 5 phương án sau:
A. Tùy chọn 1
B. Tùy chọn 2
C. Tùy chọn 3
D. Tùy chọn 4
E. Tùy chọn 5
Đáp án: E
`;
      const result = parseQuizText(input);
      expect(result.totalQuestions).toBe(1);
      expect(result.questions[0].options).toHaveLength(5);
      expect(result.questions[0].answer).toEqual([4]); // E -> 4
    });
  });

  // -------------------------------------------------------------
  // 3. BEHAVIOR CATEGORY: ANSWER DETECTION & CONFLICT HANDLING
  // -------------------------------------------------------------
  describe('Answer Detection & Key Resolution', () => {
    it('TC-A01: detects asterisk marked answer (*A. or A.*)', () => {
      const input = `
Câu 1: Ai là tác giả của Truyện Kiều?
*A. Nguyễn Du
B. Nguyễn Trãi
C. Hồ Xuân Hương
D. Đoàn Thị Điểm
`;
      const result = parseQuizText(input);
      expect(result.totalQuestions).toBe(1);
      expect(result.questions[0].answer).toEqual([0]);
      expect(result.questions[0].status).toBe('valid');
    });

    it('TC-B02: detects multiple answers (Đáp án: A, C)', () => {
      const input = `
Câu 1: Những thành phố nào sau đây trực thuộc Trung ương?
A. Hà Nội
B. Nha Trang
C. Hải Phòng
D. Vũng Tàu
Đáp án đúng: A, C
`;
      const result = parseQuizText(input);
      expect(result.totalQuestions).toBe(1);
      expect(result.questions[0].answer).toEqual([0, 2]);
      expect(result.questions[0].status).toBe('valid');
    });

    it('TC-A04: resolves answers from a separate Answer Key block at bottom', () => {
      const input = `
Câu 1: Câu hỏi thứ nhất
A. Lựa chọn 1
B. Lựa chọn 2
C. Lựa chọn 3
D. Lựa chọn 4

Câu 2: Câu hỏi thứ hai
A. Lựa chọn 1
B. Lựa chọn 2
C. Lựa chọn 3
D. Lựa chọn 4

ĐÁP ÁN:
1. B
2. D
`;
      const result = parseQuizText(input);
      expect(result.totalQuestions).toBe(2);
      expect(result.questions[0].answer).toEqual([1]); // 1. B
      expect(result.questions[0].signals.answerFromSeparateKey).toBe(true);
      expect(result.questions[1].answer).toEqual([3]); // 2. D
      expect(result.questions[1].signals.answerFromSeparateKey).toBe(true);
      expect(result.validCount).toBe(2);
    });

    it('TC-X01: flags conflict as ambiguous when inline answer conflicts with Answer Key', () => {
      const input = `
Câu 1: Thủ đô Việt Nam là gì?
*A. Hà Nội
B. Đà Nẵng
C. TP.HCM
D. Huế

BẢNG ĐÁP ÁN:
1. C
`;
      const result = parseQuizText(input);
      expect(result.totalQuestions).toBe(1);
      const q = result.questions[0];
      expect(q.status).toBe('ambiguous');
      expect(q.answer).toBeNull(); // Never silently guess!
      expect(q.warnings.some((w) => w.code === 'ANSWER_KEY_CONFLICT')).toBe(true);
    });

    it('TC-X02: standalone Answer Key block is not parsed as questions', () => {
      const input = `
1. A
2. B
3. C
4. D
5. A
`;
      const keyMap = parseAnswerKeys(input);
      expect(keyMap[1]).toEqual([0]);
      expect(keyMap[2]).toEqual([1]);
      expect(keyMap[3]).toEqual([2]);
      expect(keyMap[4]).toEqual([3]);
      expect(keyMap[5]).toEqual([0]);

      // When passed to full parser, it shouldn't produce empty questions with 0 options
      const result = parseQuizText(input);
      expect(result.totalQuestions).toBe(0);
    });
  });

  // -------------------------------------------------------------
  // 4. BEHAVIOR CATEGORY: AMBIGUITY & ERROR HANDLING
  // -------------------------------------------------------------
  describe('Ambiguity and Error Handling', () => {
    it('TC-E01: flags question without answer as missing_answer', () => {
      const input = `
Câu 1: Câu hỏi này không có đáp án đi kèm
A. Lựa chọn 1
B. Lựa chọn 2
C. Lựa chọn 3
D. Lựa chọn 4
`;
      const result = parseQuizText(input);
      expect(result.totalQuestions).toBe(1);
      expect(result.questions[0].status).toBe('missing_answer');
      expect(result.questions[0].answer).toBeNull();
      expect(result.questions[0].warnings.some((w) => w.code === 'MISSING_ANSWER')).toBe(true);
    });

    it('TC-E02: flags ambiguous answer (Đáp án: A hoặc B) as ambiguous', () => {
      const input = `
Câu 1: Câu hỏi có đáp án phân vân
A. Lựa chọn 1
B. Lựa chọn 2
C. Lựa chọn 3
D. Lựa chọn 4
Đáp án: A hoặc B
`;
      const result = parseQuizText(input);
      expect(result.totalQuestions).toBe(1);
      expect(result.questions[0].status).toBe('ambiguous');
      expect(result.questions[0].warnings.some((w) => w.code === 'AMBIGUOUS_ANSWER')).toBe(true);
    });

    it('TC-B03: filters page noise into unparsedBlocks', () => {
      const input = `
Trang 1/5 - Mã đề: 102

Câu 1: Câu hỏi đầu tiên
A. 1
B. 2
Đáp án: A

Họ và tên thí sinh: Nguyễn Văn A
`;
      const result = parseQuizText(input);
      expect(result.totalQuestions).toBe(1);
      expect(result.validCount).toBe(1);
      expect(result.unparsedBlocks.length).toBeGreaterThan(0);
    });
  });

  // -------------------------------------------------------------
  // 5. BEHAVIOR CATEGORY: VALIDATOR AS DERIVED STATE
  // -------------------------------------------------------------
  describe('Pure Validator & UI Interactivity', () => {
    it('re-derives valid status when user selects an answer for missing_answer question', () => {
      const q: ParsedQuestion = {
        id: 'test_1',
        question: 'Thủ đô của Việt Nam là gì?',
        options: ['Hà Nội', 'TP.HCM'],
        answer: null, // missing initially
        status: 'missing_answer',
        warnings: [{ code: 'MISSING_ANSWER', message: 'Chưa xác định đáp án đúng.' }],
        signals: {
          questionDetected: true,
          optionsCount: 2,
          answerDetected: false,
          answerFromSeparateKey: false,
          hasExplanation: false,
        },
        rawText: '...',
      };

      // Initially invalid
      const initial = validateQuestion(q);
      expect(initial.status).toBe('missing_answer');

      // User simulates selecting option 0 (A)
      const updatedQuestion: ParsedQuestion = {
        ...q,
        answer: [0],
      };

      const revalidated = validateQuestion(updatedQuestion);
      expect(revalidated.status).toBe('valid');
      expect(revalidated.warnings).toHaveLength(0);
    });
  });

  // -------------------------------------------------------------
  // 6. BEHAVIOR CATEGORY: NORMALIZER
  // -------------------------------------------------------------
  describe('Conservative Normalizer', () => {
    it('handles CRLF, Unicode curly quotes, em-dashes, and trims', () => {
      const dirty = '\r\n   Câu 1: “Sóng” là bài thơ của ai?   \r\n A. Xuân Quỳnh – tác giả \r\n\r\n\r\n';
      const clean = normalizeRawText(dirty);
      expect(clean).toContain('"Sóng"');
      expect(clean).toContain('- tác giả');
      expect(clean).not.toContain('\r');
      expect(clean).not.toContain('\n\n\n');
    });
  });
});

