# Implementation Plan - Lesson UI/UX & Navigation Upgrades

We will implement a set of premium UI/UX enhancements focused on improving test-taking efficiency in lessons and app navigation:

1. **Question Navigator Filters** in the Sidebar: `All`, `Unanswered`, and `Flagged` filter buttons.
2. **Reading Passage Highlighter**: Double-click or text selection triggers a tooltip to highlight text in Yellow, Green, or Cyan.
3. **Double-click Word Lookup & Save to Vocabulary Trainer**: Double-clicking an English word in Reading Passages or Listening Transcripts reveals its definition (if present in the lesson glossary) or links to Google Translate, with a button to save it as a custom vocabulary item.
4. **Global Navigation Hotkeys**: Keyboard shortcuts (`Alt + 1` for Dashboard, `Alt + 2` for Vocabulary Trainer, `Alt + 3` for Audio Center, `Alt + L` for focusing/collapsing sidebar).

---

## Proposed Changes

### App Shell

#### [MODIFY] [App.tsx](file:///d:/Upload_drive/Self%20Learning/TOEIC/th%C3%A1ng%201/Notes/B12/src/App.tsx)
- Add state for `customVocabItems` (array of custom words saved by the user).
- Sync `customVocabItems` with `localStorage` (key: `toeic_custom_vocabulary`) and sync to Firebase Firestore.
- Add a global `keydown` event listener to handle navigation hotkeys:
  - `Alt + 1` -> Navigate to Dashboard.
  - `Alt + 2` -> Navigate to Vocabulary Trainer.
  - `Alt + 3` -> Navigate to Audio Center.
  - `Alt + L` -> Toggle sidebar collapse.
- Pass `customVocabItems` and `onSaveCustomVocab` down to `VocabularyTrainer` and `LessonWorkspace`.

### Sidebar Navigation

#### [MODIFY] [Sidebar.tsx](file:///d:/Upload_drive/Self%20Learning/TOEIC/th%C3%A1ng%201/Notes/B12/src/components/Sidebar.tsx)
- Add state for `filterMode` (`'all' | 'unanswered' | 'flagged'`).
- Display a row of 3 filter tabs directly above the **Question Navigator** grid.
- Filter the question numbers list rendered in the grid based on the active tab selection:
  - `All`: Render all questions.
  - `Unanswered`: Render only questions not present in `answeredQuestions`.
  - `Flagged`: Render only questions present in `flaggedQuestions`.

### Lesson Workspace

#### [MODIFY] [LessonWorkspace.tsx](file:///d:/Upload_drive/Self%20Learning/TOEIC/th%C3%A1ng%201/Notes/B12/src/components/LessonWorkspace.tsx)
- Accept `customVocabItems` and `onSaveCustomVocab` props.
- Pass them down to `ListeningWorkspace` and `ReadingPassage` components.

#### [MODIFY] [ReadingPassage.tsx](file:///d:/Upload_drive/Self%20Learning/TOEIC/th%C3%A1ng%201/Notes/B12/src/components/ReadingPassage.tsx)
- Add state for tooltip coordinates and selected word.
- Monitor text selections and double-clicks inside the passage box.
- Render a floating menu overlay on text selection:
  - Color bubbles to highlight selected text (Yellow, Green, Cyan).
  - Option to clear highlights.
  - Word lookup panel: search the lesson glossary for matching terms, offer a "Google Translate" link, and a text input with a "Save to Trainer" button.
- Integrate DOM manipulation to insert highlight span wrappers.

#### [MODIFY] [ListeningWorkspace.tsx](file:///d:/Upload_drive/Self%20Learning/TOEIC/th%C3%A1ng%201/Notes/B12/src/components/ListeningWorkspace.tsx)
- Accept `customVocabItems` and `onSaveCustomVocab` props.
- Implement similar double-click text selection and tooltip lookup for dialogue transcript lines.

### Vocabulary Trainer

#### [MODIFY] [VocabularyTrainer.tsx](file:///d:/Upload_drive/Self%20Learning/TOEIC/th%C3%A1ng%201/Notes/B12/src/components/VocabularyTrainer.tsx)
- Accept `customVocabItems` prop.
- Merge `customVocabItems` into the flashcard deck and library table dynamically, matching the active search and lesson filters.

### Styles System

#### [MODIFY] [index.css](file:///d:/Upload_drive/Self%20Learning/TOEIC/th%C3%A1ng%201/Notes/B12/src/index.css)
- Add CSS classes for:
  - Highlight selectors: `.highlight-yellow`, `.highlight-green`, `.highlight-cyan`.
  - Floating tooltip overlay container, buttons, translation input, and badge selectors.
  - Sidebar navigator filter tabs.

---

## Verification Plan

### Automated Checks
- Run `npm run build` to confirm compilation.

### Manual Verification
- **Global Hotkeys**: Press `Alt + 2`, check if Vocabulary Trainer view opens. Press `Alt + L`, verify sidebar collapses/expands.
- **Navigator Filters**: Mark some questions as flagged or answered. Select the `Unanswered` and `Flagged` tabs in the Sidebar navigator, check if the grid updates to show only relevant question numbers.
- **Reading Highlighter**: Highlight a sentence in a Part 7 reading passage, click the yellow color bubble, verify that the text turns yellow.
- **Word Lookup**: Double-click a word in a passage or listening transcript. Verify the popover opens showing its translation (if in glossary) or providing a Google Translate link and a "Save to Trainer" button.
