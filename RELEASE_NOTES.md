## Quiz Learning Pro v3.0.0

### What's Changed

#### 1. Interactive Study Pet Companion System
* **Desktop Pixel Companions**: Integrated 16 retro 8-bit companion pets (Akita Dog, Fox, Duck, Totoro, Capybara, Panda, Crab, Chicken, Horse, Clippy, Deno, and more) powered by the vscode-pets sprite animation engine.
* **Themed Habitats**: Implemented 6 distinct habitat environments (Forest, Beach, Castle, Winter, Autumn, and Transparent Minimalist).
* **Multi-Scale View & Mini Dock**: Added 3 viewport scaling modes (Small 285px non-intrusive mode, Medium 390px, Large 500px full view) along with a compact Mini Dock pill (`─`) to keep question text unobstructed during intensive sessions.
* **Responsive Viewport Protection**: Built-in auto-docking and viewport safety safeguards that gracefully dock or hide the habitat on displays under 1400px width or 580px height.
* **Interactive Play**: Full interactive physics support including tennis ball throwing (`🎾`), weather atmospheric effects (`✨`), and multi-pet position reset.
* **Bubble Ceiling Clamping**: Integrated a live DOM MutationObserver to dynamically clamp speech bubbles, guaranteeing dialogue is never truncated by the viewport top edge.

#### 2. Custom Submerged Ambient Wallpaper Engine
* **Local Image Integration**: Built-in file selector enabling users to import custom background images (PNG, JPG, WebP, and animated Lo-fi GIFs).
* **Quota-Free IndexedDB Storage**: Uses dedicated IndexedDB (`QuizAppWallpaperDB`) for multi-megabyte image storage, bypassing traditional browser localStorage 5MB quota restrictions and preserving wallpapers seamlessly across restarts.
* **Live Customization Controls**: Real-time sliders for Opacity (5% to 55%) and Backdrop Blur (0px to 16px) with instant presets.
* **Ambient Frosted Glass Layering**: Positioned non-intrusively at `z-0` beneath application cards with acrylic glassmorphism styling, ensuring questions and examination controls remain crisp, responsive, and click-through friendly.
* **Header Quick-Action**: One-click configuration button (`🖼️`) integrated directly into the top header next to the theme switcher.

#### 3. Core Engine & Stability Improvements
* **100% Test Coverage Across Modules**: 59 automated unit tests passing across all critical services and state engines.
* **Zero-Warning Production Bundling**: Optimized Vite pipeline and TypeScript definitions for instantaneous launch performance.

---

### Installation & Updates
* **Existing Installations**: Click **Update Now** in the in-app update banner to upgrade seamlessly.
* **New Installations**: Download and run `QuizLearningPro_Setup.exe` from the release assets below.

---

### Integrity Check
```
SHA-256 (Setup):    DE17F175EDC70898B7ED96F2C2EA642403D99E629E38917C7F68285F10B8838B
SHA-256 (Portable): D7867381B6555B308BCE29C482F9BB53CBF651B03C5E6DE2B118B0622AD2EFF6
```
