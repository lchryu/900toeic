# Implementation Plan - Project Enhancements

We will implement three major features:
1. **Vocabulary Trainer Sync** with Firebase Firestore.
2. **Custom Audio Segments** inside the Audio Center (`Mp3PlayerHub`).
3. **Keyboard Shortcuts** in the Listening Segment Editor for speed and accuracy.

---

## Proposed Changes

### Firebase Service

#### [MODIFY] [firebase.ts](file:///d:/Upload_drive/Self%20Learning/TOEIC/th%C3%A1ng%201/Notes/B12/src/services/firebase.ts)
- Add `loadCloudVocabulary(uid: string)` to load the list of mastered vocabulary IDs.
- Add `saveCloudVocabulary(uid: string, masteredIds: string[])` to save the list of mastered vocabulary IDs.

### App Shell

#### [MODIFY] [App.tsx](file:///d:/Upload_drive/Self%20Learning/TOEIC/th%C3%A1ng%201/Notes/B12/src/App.tsx)
- Lift the `masteredVocabIds` state up to `App.tsx` from `VocabularyTrainer`.
- Synchronize vocabulary progress (merge local & cloud IDs using unique Sets) inside the `subscribeToAuth` callback.
- Add `handleSaveVocabulary(ids: string[])` callback and pass it alongside `masteredVocabIds` state to `VocabularyTrainer`.

### Vocabulary Trainer

#### [MODIFY] [VocabularyTrainer.tsx](file:///d:/Upload_drive/Self%20Learning/TOEIC/th%C3%A1ng%201/Notes/B12/src/components/VocabularyTrainer.tsx)
- Update `VocabularyTrainerProps` to accept `masteredIds` and `onSaveMasteredIds`.
- Remove local state and effects for loading/saving `masteredIds`, using props instead.
- Integrate the callback in vocabulary flashcard marking, resetting, and toggling.

### Audio Center (Mp3PlayerHub)

#### [MODIFY] [Mp3PlayerHub.tsx](file:///d:/Upload_drive/Self%20Learning/TOEIC/th%C3%A1ng%201/Notes/B12/src/components/Mp3PlayerHub.tsx)
- In the `trackSegments` useMemo, check `localStorage` for custom audio segment time marks for the active track before falling back to presets or group slice defaults.

### Segment Editor UX

#### [MODIFY] [ListeningWorkspace.tsx](file:///d:/Upload_drive/Self%20Learning/TOEIC/th%C3%A1ng%201/Notes/B12/src/components/ListeningWorkspace.tsx)
- Add keyboard hotkey support in `AudioSegmentControls` when `isEditing` is true:
  - `[`: Set current playback time as start.
  - `]`: Set current playback time as end.
  - `Space`: Play/pause segment.
  - `L` (or `l`): Toggle looping segment.
  - `ArrowLeft` / `ArrowRight` (with `Shift` modifier): Seek back/forward by 2s (or 5s with Shift).
  - `Enter`: Save.
  - `Escape`: Cancel/Close editor.
- Display a small shortcuts legend below the inputs in the editor panel for premium visual feedback.

---

## Verification Plan

### Automated Checks
- Run `npm run build` to confirm compilation.

### Manual Verification
- **Vocabulary Trainer**: Mark card as mastered, sign out, sign back in, verify progress is preserved.
- **Audio Center**: Customize a segment in Lesson 12 listening workspace, navigate to Audio Center, verify that Lesson 12 loop segments show the custom times.
- **Shortcuts**: Open inline editor for a segment, play audio, press `[` and `]` at different points, check that input values update. Press `Enter` to save, press `Escape` to cancel.
