## Quiz Learning Pro v2.3.0

### What's Changed

#### Multi-Layer Crash Prevention & Self-Recovery (Defense-in-Depth)
* **Top-Level React Error Boundary**: Intercepts unhandled React rendering exceptions that previously caused permanent blank white screens. Replaces fatal crashes with an elegant dark-mode recovery card offering instant application reload (`F5`), safe return to Dashboard, and one-click diagnostic report copying.
* **Baseline Dark Canvas Styling**: Added baseline background styling (`#090d16`) directly into `index.html` to eliminate blinding white flashes and ensure the native WebView2 window always preserves a sleek dark surface.
* **Global Hotkey Recovery (`F5` & `Ctrl + R`)**: Registered global hotkey handlers to refresh and unfreeze the WebView2 window immediately without needing to terminate or restart the desktop process.
* **Automated Crash Diagnostics & Telemetry**: Integrated global handlers for `window.onerror` and `window.onunhandledrejection` that persist recent error stacks into local storage (`quiz_crash_history`) for rapid troubleshooting.
* **Resilient SQLite JSON Deserialization**: Replaced unhandled `JSON.parse` operations across database mapping methods with `safeJsonParse()`, guaranteeing that corrupted snapshot fields or aborted writes fall back gracefully without crashing session loading.
* **Defensive Flashcard Arena Null Guards**: Hardened `FlashcardArena` with explicit empty-state views and safe optional chaining on question and options arrays.
* **Strict Hook Execution Alignment**: Decoupled secondary window routing to strictly adhere to React's Rules of Hooks, eliminating component render misalignment bugs.

### Installation & Updates
* **Existing Installations**: Click **Update Now** inside the in-app update notification to upgrade automatically.
* **New Installations**: Download and run `QuizLearningPro_Setup.exe` from the release assets below.

### Integrity Check
```
SHA-256 (Setup): 32E2F68991E9DDBA6C6585EB7D09E5E1298B41660583B2F970F9E56E5F55C9D2
SHA-256 (Portable): CBBC034BE4C98146E792D6EA4EA5E3A29A086457841FFEF5AA8B8A33BD129BA4
```
