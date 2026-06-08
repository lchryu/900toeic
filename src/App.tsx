import React, { useState, useEffect } from 'react';
import { Sidebar } from './components/Sidebar';
import { Dashboard } from './components/Dashboard';
import { LessonWorkspace } from './components/LessonWorkspace';
import { VocabularyTrainer } from './components/VocabularyTrainer';
import { Mp3PlayerHub } from './components/Mp3PlayerHub';
import { AudioPlayer } from './components/AudioPlayer';
import { LessonData, LessonProgress, PracticeHistoryEntry, AudioControlState } from './types';
import { Menu } from 'lucide-react';
import lessonsData from './data/lessons.json';
import {
  isFirebaseConfigured,
  loadCloudProgress,
  saveCloudProgress,
  signInWithGoogle,
  signOutGoogle,
  subscribeToAuth,
  type AuthUser
} from './services/firebase';

const LOCAL_STORAGE_KEY = 'toeic_practice_progress';
const HISTORY_STORAGE_KEY = 'toeic_practice_history';
const THEME_STORAGE_KEY = 'toeic_practice_theme';
const MAX_HISTORY_ITEMS = 150;

const mergeProgress = (
  localProgress: { [lessonId: string]: LessonProgress },
  cloudProgress: { [lessonId: string]: LessonProgress }
) => {
  const merged = { ...cloudProgress };
  const lessonIds = new Set([...Object.keys(localProgress), ...Object.keys(cloudProgress)]);

  lessonIds.forEach((lessonId) => {
    const localItem = localProgress[lessonId];
    const cloudItem = cloudProgress[lessonId];

    if (!cloudItem && localItem) {
      merged[lessonId] = localItem;
      return;
    }

    if (!localItem || !cloudItem) return;

    const localDate = localItem.completedDate ? new Date(localItem.completedDate).getTime() : 0;
    const cloudDate = cloudItem.completedDate ? new Date(cloudItem.completedDate).getTime() : 0;

    if (localDate > cloudDate) {
      merged[lessonId] = localItem;
    } else if (localDate === cloudDate) {
      const localAnswered = Object.keys(localItem.answers || {}).length;
      const cloudAnswered = Object.keys(cloudItem.answers || {}).length;
      merged[lessonId] =
        localAnswered > cloudAnswered || localItem.timeSpent > cloudItem.timeSpent
          ? localItem
          : cloudItem;
    }
  });

  return merged;
};

const App: React.FC = () => {
  const lessons = lessonsData as LessonData[];
  
  const [activeView, setActiveView] = useState<'dashboard' | 'lesson' | 'vocabulary' | 'audioplayer'>('dashboard');
  const [currentLessonId, setCurrentLessonId] = useState<string | null>(null);
  
  // Audio Center states for background playback
  const [activeAudioCenterTrackId, setActiveAudioCenterTrackId] = useState<string | null>(null);
  const [audioCenterControl, setAudioCenterControl] = useState<AudioControlState | null>(null);

  const activeAudioCenterTrack = lessons.find((l) => l.id === activeAudioCenterTrackId) || null;

  // Mobile sidebar drawer state
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);
  
  // Progress state
  const [progress, setProgress] = useState<{ [lessonId: string]: LessonProgress }>({});
  const [history, setHistory] = useState<PracticeHistoryEntry[]>([]);
  const [authUser, setAuthUser] = useState<AuthUser | null>(null);
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncMessage, setSyncMessage] = useState<string | null>(null);
  const [theme, setTheme] = useState<'dark' | 'light'>(() => {
    try {
      return localStorage.getItem(THEME_STORAGE_KEY) === 'light' ? 'light' : 'dark';
    } catch {
      return 'dark';
    }
  });

  // Question Navigator config state (managed by active LessonWorkspace)
  const [navConfig, setNavConfig] = useState<{
    questionNumbers: number[];
    answeredQuestions: number[];
    flaggedQuestions: number[];
    isGraded: boolean;
    gradedResults: { [qNum: number]: boolean };
    scrollCallback: ((num: number) => void) | null;
  }>({
    questionNumbers: [],
    answeredQuestions: [],
    flaggedQuestions: [],
    isGraded: false,
    gradedResults: {},
    scrollCallback: null
  });

  // Load progress from localStorage on mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem(LOCAL_STORAGE_KEY);
      if (stored) {
        setProgress(JSON.parse(stored));
      }

      const storedHistory = localStorage.getItem(HISTORY_STORAGE_KEY);
      if (storedHistory) {
        setHistory(JSON.parse(storedHistory));
      }
    } catch (e) {
      console.error('Failed to load local learning state:', e);
    }
  }, []);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    localStorage.setItem(THEME_STORAGE_KEY, theme);
  }, [theme]);

  useEffect(() => {
    return subscribeToAuth(async (user) => {
      setAuthUser(user);
      setSyncMessage(null);

      if (!user) return;

      setIsSyncing(true);
      try {
        const stored = localStorage.getItem(LOCAL_STORAGE_KEY);
        const localProgress = stored ? JSON.parse(stored) : {};
        const cloudProgress = (await loadCloudProgress(user.uid)) || {};
        const mergedProgress = mergeProgress(localProgress, cloudProgress);

        setProgress(mergedProgress);
        localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(mergedProgress));
        await saveCloudProgress(user.uid, mergedProgress);
        setSyncMessage('Synced with Google account');
      } catch (e) {
        console.error('Failed to sync cloud progress:', e);
        setSyncMessage('Could not sync Google progress');
      } finally {
        setIsSyncing(false);
      }
    });
  }, []);

  const handleSignIn = async () => {
    setSyncMessage(null);
    try {
      await signInWithGoogle();
    } catch (e) {
      console.error('Failed to sign in with Google:', e);
      setSyncMessage('Google sign-in failed');
    }
  };

  const handleSignOut = async () => {
    setSyncMessage(null);
    try {
      await signOutGoogle();
    } catch (e) {
      console.error('Failed to sign out:', e);
      setSyncMessage('Could not sign out');
    }
  };

  const handleNavigate = (view: 'dashboard' | 'lesson' | 'vocabulary' | 'audioplayer', lessonId: string | null) => {
    setActiveView(view);
    setCurrentLessonId(lessonId);
    // Reset nav grid if moving away from lesson
    if (view !== 'lesson') {
      setNavConfig({
        questionNumbers: [],
        answeredQuestions: [],
        flaggedQuestions: [],
        isGraded: false,
        gradedResults: {},
        scrollCallback: null
      });
    } else {
      // If moving to a lesson, close the background Audio Center player to avoid double playback
      setActiveAudioCenterTrackId(null);
      setAudioCenterControl(null);
    }
  };

  const handleSaveProgress = (
    lessonId: string,
    answers: { [qNum: number]: string },
    timeSpent: number,
    score: number,
    totalQuestions: number,
    isSubmitted = true,
    metadata: Partial<Omit<LessonProgress, 'lessonId' | 'answers' | 'timeSpent' | 'score' | 'totalQuestions' | 'isSubmitted' | 'completedDate'>> = {}
  ) => {
    const now = new Date().toISOString();
    const previousProgress = progress[lessonId];
    const nextMode = metadata.mode || previousProgress?.mode;
    const nextBestScore = isSubmitted
      ? Math.max(previousProgress?.bestScore || 0, score)
      : previousProgress?.bestScore;
    const nextAttemptCount = isSubmitted
      ? (previousProgress?.attemptCount || 0) + 1
      : previousProgress?.attemptCount;

    const updatedProgress = {
      ...progress,
      [lessonId]: {
        ...previousProgress,
        lessonId,
        answers,
        timeSpent,
        score,
        totalQuestions,
        isSubmitted,
        bestScore: nextBestScore,
        attemptCount: nextAttemptCount,
        completedDate: isSubmitted ? now : previousProgress?.completedDate,
        updatedAt: now,
        lastStudiedAt: nextMode === 'study' ? now : previousProgress?.lastStudiedAt,
        lastPracticedAt: nextMode === 'practice' ? now : previousProgress?.lastPracticedAt,
        ...metadata
      }
    };
    
    setProgress(updatedProgress);
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(updatedProgress));

    if (authUser) {
      saveCloudProgress(authUser.uid, updatedProgress).catch((e) => {
        console.error('Failed to save cloud progress:', e);
        setSyncMessage('Could not save to Google account');
      });
    }
  };

  const handleRecordHistory = (entry: Omit<PracticeHistoryEntry, 'id' | 'timestamp'>) => {
    const now = new Date().toISOString();
    const newEntry: PracticeHistoryEntry = {
      ...entry,
      id: `${entry.lessonId}-${entry.activity}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      timestamp: now
    };

    setHistory((previousHistory) => {
      const lastEntry = previousHistory[0];
      const isDuplicateOpen =
        lastEntry &&
        entry.activity === 'opened' &&
        lastEntry.activity === 'opened' &&
        lastEntry.lessonId === entry.lessonId &&
        lastEntry.mode === entry.mode &&
        Date.now() - new Date(lastEntry.timestamp).getTime() < 30000;

      if (isDuplicateOpen) return previousHistory;

      const nextHistory = [newEntry, ...previousHistory].slice(0, MAX_HISTORY_ITEMS);
      localStorage.setItem(HISTORY_STORAGE_KEY, JSON.stringify(nextHistory));
      return nextHistory;
    });
  };

  const handleQuestionNavConfig = (
    questionNumbers: number[],
    answeredQuestions: number[],
    flaggedQuestions: number[],
    isGraded: boolean,
    gradedResults: { [qNum: number]: boolean },
    scrollCallback: (num: number) => void
  ) => {
    setNavConfig({
      questionNumbers,
      answeredQuestions,
      flaggedQuestions,
      isGraded,
      gradedResults,
      scrollCallback
    });
  };

  const activeLesson = lessons.find((l) => l.id === currentLessonId);

  return (
    <div className="app-container">
      {/* Sidebar with Navigation and Question Navigator Grid */}
      <Sidebar
        lessons={lessons}
        currentLessonId={currentLessonId}
        activeView={activeView}
        progress={progress}
        onNavigate={handleNavigate}
        questionNumbers={navConfig.questionNumbers}
        answeredQuestions={navConfig.answeredQuestions}
        flaggedQuestions={navConfig.flaggedQuestions}
        isGraded={navConfig.isGraded}
        gradedResults={navConfig.gradedResults}
        onQuestionClick={(num) => {
          navConfig.scrollCallback?.(num);
          setIsMobileSidebarOpen(false); // Close sidebar on mobile after navigating
        }}
        isMobileOpen={isMobileSidebarOpen}
        onCloseMobileSidebar={() => setIsMobileSidebarOpen(false)}
        theme={theme}
        onToggleTheme={() => setTheme((current) => current === 'dark' ? 'light' : 'dark')}
      />

      {/* Sidebar Overlay on mobile */}
      {isMobileSidebarOpen && (
        <div className="sidebar-overlay" onClick={() => setIsMobileSidebarOpen(false)} />
      )}

      {/* Mobile Top Bar */}
      <div className="mobile-header">
        <button
          onClick={() => setIsMobileSidebarOpen(true)}
          style={{
            background: 'transparent',
            border: 'none',
            color: 'hsl(var(--text-primary))',
            cursor: 'pointer',
            padding: '8px',
            display: 'flex',
            alignItems: 'center'
          }}
        >
          <Menu size={24} />
        </button>
        <span style={{ fontWeight: 700, fontSize: '1.1rem', color: 'hsl(var(--primary))', fontFamily: 'var(--font-title)' }}>
          TOEIC Practice Hub
        </span>
        <div style={{ width: '40px' }} />
      </div>

      {/* Main Workspace Area */}
      <main className="main-content">
        {activeView === 'dashboard' ? (
          <Dashboard
            lessons={lessons}
            progress={progress}
            history={history}
            authUser={authUser}
            isAuthConfigured={isFirebaseConfigured}
            isSyncing={isSyncing}
            syncMessage={syncMessage}
            onSignIn={handleSignIn}
            onSignOut={handleSignOut}
            onStartLesson={(id) => handleNavigate('lesson', id)}
          />
        ) : activeView === 'vocabulary' ? (
          <VocabularyTrainer lessons={lessons} />
        ) : activeView === 'audioplayer' ? (
          <Mp3PlayerHub
            lessons={lessons}
            activeTrackId={activeAudioCenterTrackId}
            setActiveTrackId={setActiveAudioCenterTrackId}
            audioControl={audioCenterControl}
          />
        ) : activeLesson ? (
          <LessonWorkspace
            key={activeLesson.id}
            lesson={activeLesson}
            progress={progress[activeLesson.id]}
            onSaveProgress={handleSaveProgress}
            onRecordHistory={handleRecordHistory}
            onQuestionNavConfig={handleQuestionNavConfig}
          />
        ) : (
          <div style={{ padding: '32px', textAlign: 'center', color: 'hsl(var(--text-muted))' }}>
            Lesson not found.
          </div>
        )}
      </main>

      {/* Global Audio Center Player for Background Play */}
      {activeAudioCenterTrack && (
        <div className="global-audio-player-wrapper glass-panel">
          {/* Left: Track Info */}
          <div className="global-audio-player-info">
            <div className="global-audio-player-equalizer">
              <div className={`bar bar1 ${audioCenterControl?.isPlaying ? 'playing' : ''}`} />
              <div className={`bar bar2 ${audioCenterControl?.isPlaying ? 'playing' : ''}`} />
              <div className={`bar bar3 ${audioCenterControl?.isPlaying ? 'playing' : ''}`} />
            </div>
            <span className="global-audio-player-title" title={activeAudioCenterTrack.title}>
              {activeAudioCenterTrack.title.replace(/📘|Lesson\s*/g, '').trim()}
            </span>
          </div>

          {/* Center: Audio player controls */}
          <div className="global-audio-player-controls-container">
            <AudioPlayer
              key={activeAudioCenterTrack.id}
              src={activeAudioCenterTrack.audio ? `/${activeAudioCenterTrack.audio}` : undefined}
              youtubeUrl={activeAudioCenterTrack.youtubeUrl}
              onControlStateChange={setAudioCenterControl}
            />
          </div>

          {/* Right: Close button */}
          <button
            onClick={() => {
              setActiveAudioCenterTrackId(null);
              setAudioCenterControl(null);
            }}
            className="global-player-close-btn"
            title="Close Player"
          >
            ✕
          </button>
        </div>
      )}
    </div>
  );
};

export default App;
