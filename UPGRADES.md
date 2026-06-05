# 🚀 TOEIC Practice Hub - Upgrade Log

This document records the updates, performance optimizations, and UX/UI enhancements implemented during our pair programming session on June 5–6, 2026.

---

## 📁 Summary of Upgrades

### 1. 🌐 Internationalization & Documentation
* **README Translation**: Translated the main [README.md](README.md) from Vietnamese to English to align with open-source repository standards and facilitate code contributions.
* **Git Helper Configuration**: Guided and set up Git credential management using GitHub CLI (`gh`) to authorize repository actions cleanly via the web browser.

### 2. 🖥️ Layout & Navigation (Desktop Mode)
* **Toggleable Sidebar**:
  * Added a collapse button (`sidebar-collapse-btn` with a back chevron icon) to the header of the sidebar.
  * Designed a floating glassmorphic toggle tab (`sidebar-toggle-handle` with an expand chevron icon) fixed to the left edge of the screen when the sidebar is minimized.
  * Added hardware-accelerated transitions for smooth width sliding animations.
  * Persisted the collapse preference to `localStorage` under `toeic_sidebar_collapsed` to remember the user's choice.
  * Ensured desktop collapse controls are completely hidden on mobile viewports (`max-width: 768px`) to avoid conflicts with drawer menus.

### 3. ⚡ Performance & Loading (Code-Splitting)
* **Lazy Loading Lessons Data**:
  * Converted the static build-time import of `lessons.json` in `App.tsx` into a dynamic asynchronous `import()` inside `useEffect`.
  * **Result**: Moved the large lesson database out of the main page-load JavaScript bundle. The main script size decreased from **374.89 kB** to **213.92 kB** (a saving of **~160kB** of initial download data!).
* **Glassmorphism Loading Spinner**:
  * Designed an elegant loading screen with a custom CSS `.animate-spin` rotating spinner to display while loading the JSON chunk, preventing any initial page flashes or layout shifts.

### 4. 📱 Mobile UI Accessibility & Comfort
* **Safe-Area Insets Padding**:
  * Configured the floating mobile audio player (`.audio-player-shell`) to respect notch/home bar safe areas using CSS `env(safe-area-inset-bottom)`, aligning it perfectly above bottom FAB buttons.
* **Larger Touch Targets**:
  * Raised the minimum height of mobile lesson tabs (`.mobile-lesson-tab`) from `38px` to **`44px`** to comply with mobile accessibility tap target guidelines.

### 5. 📊 Dashboard Lesson Directory
* **Interactive Lessons Grid**:
  * Replaced the single next lesson recommendation block on the main Dashboard with a comprehensive, grid-based lesson browser directory.
  * Lists each lesson with details (Listening/Reading question counts), a color-coded status indicator (`Not started`, `In Progress`, `Completed`), and a visual progress bar.
  * Added contextual trigger buttons: **Start Lesson**, **Resume Lesson**, or **Review Lesson** (for submitted attempts).
  * Built styled card-hover micro-animations (cards lift up, borders highlight, and shadows deepen when hovered).

### 📖 6. Study Workspace Enhancements
* **Markdown Formatting inside Explanations**:
  * Integrated the `react-markdown` parser inside [QuestionBlock.tsx](src/components/QuestionBlock.tsx) to render bold headers and line breaks properly inside correct-answer explanations, replacing raw asterisk characters.
* **Sequential Audio Timestamp Cascading**:
  * Modified the `handleUpdateAudioSegment` callback in [LessonWorkspace.tsx](src/components/LessonWorkspace.tsx).
  * When editing an audio segment (e.g. Q16-18), saving a new **End Time** automatically cascades that value to become the **Start Time** of the next chronological segment (e.g. Q19-21), doubling content editing speed.
* **Study Timer Smart Auto-Pause**:
  * Bound document `visibilitychange` event listeners to the elapsed-time tracking loops. Both study and practice timers will now **automatically pause** when you switch browser tabs or minimize the window, resuming only when you actively return.
* **Transcript Translation Toggle**:
  * Added a **"Show translations"** checkbox inside the unlocked audio transcript panel in [ListeningWorkspace.tsx](src/components/ListeningWorkspace.tsx). Students can now hide translations to test their translation skills, and toggle them back on when needed.

---

## 🛠️ Verification
All TypeScript changes have been compiled and validated. The final production bundle compiles cleanly:
```bash
vite v5.4.21 building for production...
✓ 1769 modules transformed.
dist/index.html                     0.97 kB │ gzip:   0.51 kB
dist/assets/index-lUw3aTIJ.css     29.91 kB │ gzip:   5.67 kB
dist/assets/lessons-CW8GVUR8.js   162.66 kB │ gzip:  47.23 kB
dist/assets/index-BuQ8N1J-.js     335.29 kB │ gzip: 101.96 kB
dist/assets/firebase-B70M4z0P.js  449.92 kB │ gzip: 106.16 kB
✓ built in 7.78s
```
