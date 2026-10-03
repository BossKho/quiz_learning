# Quiz Learning Pro — Enterprise Certification & Learning Platform

A high-performance, keyboard-driven desktop learning platform built according to **ECC (Everything Claude Code)** engineering discipline and modern design system.

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
  - **Question Matrix Grid**: Visual status map (Answered, Unanswered, Flagged `[F]`, Current).
  - Pre-submission audit dialog warning of unanswered items.
  - Detailed Post-Exam Review with Pass/Fail classification, score breakdown, and filters for incorrect answers.

### 2. High-Density Desktop UX & Keyboard-First Navigation
Designed for mouse-free power users:
- `1`, `2`, `3`, `4` or `A`, `B`, `C`, `D`: Select option choices
- `Space` / `Enter`: Submit answer (Study) or advance to next question
- `T`: Toggle instant bilingual Vietnamese translation (`[T]`)
- `B`: Toggle bookmark (`[B]`)
- `E`: Toggle explanation and note drawer (`[E]`)
- `F`: Flag question for review in Exam Mode (`[F]`)
- `Ctrl + K`: Open Command Palette for fast navigation between decks and actions
- `Esc`: Return to Dashboard / Exit

### 3. Busy Mode (Chế độ Người bận rộn)
- A non-intrusive desktop popup appearing above the taskbar at custom intervals (e.g. every 1, 3, 5, 10 minutes).
- Answer single questions directly on screen, with bilingual translation toggle (`[T]`), 10-second auto-close countdown, and instant Leitner Box progression.
- Strictly isolated multi-window architecture with background timer synchronization.

### 4. User System & Cloud Sync (Local-First)
- **Account & Authentication**: Email & Password sign in, sign up, and password recovery.
- **Gamification Engine**: XP points, 99 Levels, dynamic badges showcase, and streak flames 🔥.
- **Activity Heatmap**: GitHub-style matrix visualizing daily learning consistency across 52 weeks.
- **Local-First Architecture**: 0ms offline response backed by local SQLite. Changes automatically sync to the Cloud when online.

---

## 🚀 Getting Started

### 1. Setup Environment
Copy the example environment file:
```bash
cp .env.example .env
```
Fill in your Cloud configuration parameters in `.env`.

### 2. Install Dependencies
```bash
npm install
```

### 3. Development Mode
```bash
# Web browser dev server
npm run dev

# Or launch desktop application
npm run tauri dev
```

---

## 🧪 Testing & Quality Assurance
Run the automated test suite powered by Vitest (16 unit tests):
```bash
npm test
```

Build production bundle:
```bash
npm run build
```

Compile standalone desktop release (`QuizLearningPro.exe`):
```bash
cd src-tauri
cargo build --release
```

---

## 🏗️ Architecture & Tech Stack
- **Framework**: React 19 + TypeScript + Vite + Tailwind CSS
- **Component System**: Radix UI + Lucide Icons
- **Database & Search**: SQLite (sql.js WASM + FTS4 Virtual Table)
- **Desktop Shell**: Tauri 2 (`src-tauri`) with Windows WebView2
- **Cloud Backend**: Google Firebase Auth & Cloud Firestore (Local-First Offline Persistence)

