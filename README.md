# Quiz Learning Pro — Enterprise Certification Practice Platform

A high-performance, keyboard-driven desktop learning platform built according to **ECC (Everything Claude Code)** engineering discipline and **shadcn/ui** design system.

---

## 🌟 Key Capabilities & Features

### 1. Dual Practice Arenas
- **Study Arena (Chế độ Học tập)**:
  - Immediate feedback with explanation and notes breakdown.
  - Option shuffling that preserves 100% synchronized English and Vietnamese translations.
  - Leitner Spaced Repetition Box tracking (Box 1: New to Box 5: Mastered).
  - Bookmark questions (`[B]`) for quick review later.
- **Exam Arena (Chế độ Thi mô phỏng thực chiến)**:
  - Strict countdown timer (60 minutes default, configurable).
  - Zero immediate answers revealed during the exam.
  - **Question Matrix Grid**: 60-box visual status map (Answered, Unanswered, Flagged `[F]`, Current).
  - Pre-submission audit dialog warning of unanswered items.
  - Detailed Post-Exam Review with Pass/Fail classification (70% passing threshold), score breakdown, and filters for incorrect answers.

### 2. High-Density Desktop UX & Keyboard-First Navigation
Designed for mouse-free power users:
- `1`, `2`, `3`, `4` or `A`, `B`, `C`, `D`: Select option choices
- `Space` / `Enter`: Submit answer (Study) or advance to next question
- `T`: Toggle instant bilingual Vietnamese translation (`[T]`)
- `B`: Toggle bookmark (`[B]`)
- `E`: Toggle explanation and note drawer (`[E]`)
- `F`: Flag question for review in Exam Mode (`[F]`)
- `Ctrl + K`: Open Command Palette for fast navigation between decks and actions
- `Ctrl + Shift + F`: Toggle Zen Focus Mode
- `Esc`: Return to Dashboard / Exit
*(All single-key shortcuts are automatically suppressed when typing in input fields).*

### 3. Persistent SQLite & Full-Text Search (FTS4)
- Source of Truth is local SQLite backed by IndexedDB binary snapshotting.
- Scales from current dataset to 50,000+ questions without React memory bloat.
- Virtual Table `questions_fts` indexes English questions, Vietnamese questions, explanations, and notes for instantaneous sub-millisecond search.
- Filter search results by Deck, Leitner Box, or Bookmarked status.

### 4. 14 Pre-Bundled Test Decks
- Mock Test 01 to Mock Test 06 (60 questions each)
- Đề 1 to Đề 7 (60 questions each)
- Master Question Bank (`_all.json`, 369 deduplicated questions)

---

## 🚀 Quick Start

### Option 1: One-Click Launch (Windows)
Double click `start.bat` in the project root.

### Option 2: Command Line
```bash
npm run dev
```
Open [http://localhost:5173](http://localhost:5173) in your browser.

---

## 🧪 Testing & Verification
Run the automated test suite powered by Vitest:
```bash
npm test
```

Build production bundle:
```bash
npm run build
```

---

## 🏗️ Architecture & Tech Stack
- **Framework**: React 19 + TypeScript + Vite + Tailwind CSS v4
- **Component System**: shadcn/ui + Radix UI + Lucide Icons
- **Database & Search**: SQLite (sql.js WASM + FTS4 Virtual Table)
- **Desktop Shell**: Tauri 2 (`src-tauri`) with Windows WebView2
