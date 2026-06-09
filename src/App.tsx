import React, { useState, useEffect } from 'react';
import { Sidebar } from './components/Sidebar';
import { Dashboard } from './components/Dashboard';
import { LessonWorkspace } from './components/LessonWorkspace';
import { VocabularyTrainer } from './components/VocabularyTrainer';
import { Mp3PlayerHub } from './components/Mp3PlayerHub';
import { AudioPlayer } from './components/AudioPlayer';
import { ErrorBoundary } from './components/ErrorBoundary';
import { LessonData, LessonManifest, LessonProgress, PracticeHistoryEntry, AudioControlState, AudioSegment, VocabularyItem } from './types';
import { Menu, ChevronRight, BookOpen } from 'lucide-react';
import {
  isFirebaseConfigured,
  loadCloudProgress,
  saveCloudProgress,
  loadCloudAudioSegments,
  saveCloudAudioSegments,
  loadCloudVocabulary,
  saveCloudVocabulary,
  loadCloudCustomVocabulary,
  saveCloudCustomVocabulary,
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

const mergeAudioSegments = (
  local: { [lessonId: string]: AudioSegment[] },
  cloud: { [lessonId: string]: AudioSegment[] }
) => {
  const merged = { ...cloud };

  for (const lessonId in local) {
    const localSegs = local[lessonId];
    const cloudSegs = cloud[lessonId];

    if (!cloudSegs) {
      merged[lessonId] = localSegs;
    } else {
      const localUpdated = localSegs.some((s) => s.updatedAt);
      const cloudUpdated = cloudSegs.some((s) => s.updatedAt);

      if (localUpdated && !cloudUpdated) {
        merged[lessonId] = localSegs;
      } else if (!localUpdated && cloudUpdated) {
        merged[lessonId] = cloudSegs;
      } else if (localUpdated && cloudUpdated) {
        const getNewestTimestamp = (segs: AudioSegment[]) => {
          let maxTime = 0;
          segs.forEach((s) => {
            if (s.updatedAt) {
              const t = new Date(s.updatedAt).getTime();
              if (t > maxTime) maxTime = t;
            }
          });
          return maxTime;
        };

        if (getNewestTimestamp(localSegs) > getNewestTimestamp(cloudSegs)) {
          merged[lessonId] = localSegs;
        } else {
          merged[lessonId] = cloudSegs;
        }
      } else {
        merged[lessonId] = cloudSegs;
      }
    }
  }

  return merged;
};

const mergeCustomVocabulary = (
  local: VocabularyItem[],
  cloud: VocabularyItem[]
) => {
  const map = new Map<string, VocabularyItem>();
  local.forEach((item) => map.set(item.id || item.term.toLowerCase(), item));
  cloud.forEach((item) => map.set(item.id || item.term.toLowerCase(), item));
  return Array.from(map.values());
};

const App: React.FC = () => {
  const [lessons, setLessons] = useState<LessonManifest[]>([]);
  const [isLoadingLessons, setIsLoadingLessons] = useState(true);
  const [activeLessonData, setActiveLessonData] = useState<LessonData | null>(null);
  const [isLoadingActiveLesson, setIsLoadingActiveLesson] = useState(false);
  const [vocabItems, setVocabItems] = useState<VocabularyItem[]>([]);
  const [isLoadingVocab, setIsLoadingVocab] = useState(false);

  const [activeView, setActiveView] = useState<'dashboard' | 'lesson' | 'vocabulary' | 'audioplayer'>('dashboard');
  const [currentLessonId, setCurrentLessonId] = useState<string | null>(null);

  // Load lessons dynamically to optimize main bundle size
  useEffect(() => {
    import('./data/lessons_manifest.json').then((module) => {
      setLessons(module.default as LessonManifest[]);
      setIsLoadingLessons(false);
    });
  }, []);

  // Audio Center states for background playback
  const [activeAudioCenterTrackId, setActiveAudioCenterTrackId] = useState<string | null>(null);
  const [audioCenterControl, setAudioCenterControl] = useState<AudioControlState | null>(null);

  const activeAudioCenterTrack = lessons.find((l) => l.id === activeAudioCenterTrackId) || null;

  // Mobile sidebar drawer state
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);

  // Desktop sidebar collapse state
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(() => {
    try {
      return localStorage.getItem('toeic_sidebar_collapsed') === 'true';
    } catch {
      return false;
    }
  });

  const handleToggleSidebar = () => {
    setIsSidebarCollapsed((prev) => {
      const next = !prev;
      try {
        localStorage.setItem('toeic_sidebar_collapsed', String(next));
      } catch (e) {
        console.error('Failed to save sidebar state:', e);
      }
      return next;
    });
  };

  // Progress state
  const [progress, setProgress] = useState<{ [lessonId: string]: LessonProgress }>({});
  const [history, setHistory] = useState<PracticeHistoryEntry[]>([]);
  const [authUser, setAuthUser] = useState<AuthUser | null>(null);
  const [masteredVocabIds, setMasteredVocabIds] = useState<string[]>([]);
  const [customVocabItems, setCustomVocabItems] = useState<VocabularyItem[]>([]);
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncMessage, setSyncMessage] = useState<string | null>(null);

  const [showUpdateToast, setShowUpdateToast] = useState(false);
  const [showVersionModal, setShowVersionModal] = useState(false);

  const appVersion = typeof __APP_VERSION__ !== 'undefined' ? __APP_VERSION__ : '1.0.0';
  const commitHash = typeof __APP_COMMIT_HASH__ !== 'undefined' ? __APP_COMMIT_HASH__ : '';
  const commitMessage = typeof __APP_COMMIT_MESSAGE__ !== 'undefined' ? __APP_COMMIT_MESSAGE__ : '';
  const branchName = typeof __APP_BRANCH__ !== 'undefined' ? __APP_BRANCH__ : '';
  const buildTimestamp = typeof __APP_BUILD_TIMESTAMP__ !== 'undefined' ? __APP_BUILD_TIMESTAMP__ : '';
  const buildTarget = typeof __APP_BUILD_TARGET__ !== 'undefined' ? __APP_BUILD_TARGET__ : '';

  const buildDate = buildTimestamp ? new Date(buildTimestamp) : null;
  const buildDateText = buildDate && !Number.isNaN(buildDate.getTime())
    ? buildDate.toLocaleString('vi-VN', {
      dateStyle: 'medium',
      timeStyle: 'short'
    })
    : '';

  useEffect(() => {
    if (commitHash && commitMessage) {
      try {
        const lastSeen = localStorage.getItem('toeic_last_seen_commit');
        if (lastSeen !== commitHash) {
          setShowUpdateToast(true);
        }
      } catch (e) {
        console.error(e);
      }
    }
  }, []);
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

      const storedVocab = localStorage.getItem('toeic_vocabulary_mastered');
      if (storedVocab) {
        setMasteredVocabIds(JSON.parse(storedVocab));
      }

      const storedCustomVocab = localStorage.getItem('toeic_custom_vocabulary');
      if (storedCustomVocab) {
        setCustomVocabItems(JSON.parse(storedCustomVocab));
      }
    } catch (e) {
      console.error('Failed to load local learning state:', e);
    }
  }, []);

  // Global keydown handler for keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Must be Alt key + specified key
      if (e.altKey && !e.ctrlKey && !e.metaKey) {
        const key = e.key.toLowerCase();
        if (key === '1') {
          e.preventDefault();
          handleNavigate('dashboard', null);
        } else if (key === '2') {
          e.preventDefault();
          handleNavigate('vocabulary', null);
        } else if (key === '3') {
          e.preventDefault();
          handleNavigate('audioplayer', null);
        } else if (key === 'l') {
          e.preventDefault();
          handleToggleSidebar();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [lessons]);

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
        // 1. Sync progress
        const stored = localStorage.getItem(LOCAL_STORAGE_KEY);
        const localProgress = stored ? JSON.parse(stored) : {};
        const cloudProgress = (await loadCloudProgress(user.uid)) || {};
        const mergedProgress = mergeProgress(localProgress, cloudProgress);

        setProgress(mergedProgress);
        localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(mergedProgress));
        await saveCloudProgress(user.uid, mergedProgress);

        // 2. Sync audio segments
        const storedSegments = localStorage.getItem('toeic_audio_segments');
        const localSegments = storedSegments ? JSON.parse(storedSegments) : {};
        const cloudSegments = (await loadCloudAudioSegments(user.uid)) || {};
        const mergedSegments = mergeAudioSegments(localSegments, cloudSegments);

        localStorage.setItem('toeic_audio_segments', JSON.stringify(mergedSegments));
        await saveCloudAudioSegments(user.uid, mergedSegments);

        // 3. Sync vocabulary
        const storedVocab = localStorage.getItem('toeic_vocabulary_mastered');
        const localVocab = storedVocab ? JSON.parse(storedVocab) : [];
        const cloudVocab = (await loadCloudVocabulary(user.uid)) || [];
        const mergedVocab = Array.from(new Set([...localVocab, ...cloudVocab]));

        setMasteredVocabIds(mergedVocab);
        localStorage.setItem('toeic_vocabulary_mastered', JSON.stringify(mergedVocab));
        await saveCloudVocabulary(user.uid, mergedVocab);

        // 4. Sync custom vocabulary
        const storedCustomVocab = localStorage.getItem('toeic_custom_vocabulary');
        const localCustomVocab = storedCustomVocab ? JSON.parse(storedCustomVocab) : [];
        const cloudCustomVocab = (await loadCloudCustomVocabulary(user.uid)) || [];
        const mergedCustomVocab = mergeCustomVocabulary(localCustomVocab, cloudCustomVocab);

        setCustomVocabItems(mergedCustomVocab);
        localStorage.setItem('toeic_custom_vocabulary', JSON.stringify(mergedCustomVocab));
        await saveCloudCustomVocabulary(user.uid, mergedCustomVocab);

        setSyncMessage('Synced with Google account');
      } catch (e) {
        console.error('Failed to sync cloud data:', e);
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

    if (view === 'lesson' && lessonId) {
      // If moving to a lesson, close the background Audio Center player to avoid double playback
      setActiveAudioCenterTrackId(null);
      setAudioCenterControl(null);

      if (activeLessonData?.id !== lessonId) {
        setIsLoadingActiveLesson(true);
        setActiveLessonData(null);
        import(`./data/lessons/${lessonId}.json`)
          .then((module) => {
            setActiveLessonData(module.default as LessonData);
            setIsLoadingActiveLesson(false);
          })
          .catch((err) => {
            console.error(`Failed to load lesson data for ${lessonId}:`, err);
            setIsLoadingActiveLesson(false);
          });
      }
    } else if (view === 'vocabulary') {
      if (vocabItems.length === 0) {
        setIsLoadingVocab(true);
        import('./data/vocabulary.json')
          .then((module) => {
            setVocabItems(module.default as VocabularyItem[]);
            setIsLoadingVocab(false);
          })
          .catch((err) => {
            console.error('Failed to load vocabulary list:', err);
            setIsLoadingVocab(false);
          });
      }
    }

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
      setActiveLessonData(null);
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

  const handleSaveAudioSegments = (lessonId: string, segments: AudioSegment[]) => {
    if (!authUser) return;
    try {
      const stored = localStorage.getItem('toeic_audio_segments');
      const allSegments = stored ? JSON.parse(stored) : {};
      allSegments[lessonId] = segments;

      saveCloudAudioSegments(authUser.uid, allSegments).catch((e) => {
        console.error('Failed to save cloud audio segments:', e);
      });
    } catch (e) {
      console.error('Failed to read local audio segments:', e);
    }
  };

  const handleSaveVocabulary = (ids: string[]) => {
    setMasteredVocabIds(ids);
    localStorage.setItem('toeic_vocabulary_mastered', JSON.stringify(ids));
    if (authUser) {
      saveCloudVocabulary(authUser.uid, ids).catch((e) => {
        console.error('Failed to save cloud vocabulary:', e);
      });
    }
  };

  const handleSaveCustomVocab = (item: VocabularyItem) => {
    setCustomVocabItems((prev) => {
      const exists = prev.some((x) => x.term.toLowerCase() === item.term.toLowerCase());
      const next = exists
        ? prev.map((x) => (x.term.toLowerCase() === item.term.toLowerCase() ? item : x))
        : [...prev, item];
      localStorage.setItem('toeic_custom_vocabulary', JSON.stringify(next));
      if (authUser) {
        saveCloudCustomVocabulary(authUser.uid, next).catch((e) => {
          console.error('Failed to save cloud custom vocabulary:', e);
        });
      }
      return next;
    });
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

  if (isLoadingLessons) {
    return (
      <div className="app-loading-screen" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', width: '100vw', background: 'var(--bg-app)', color: 'hsl(var(--primary))', fontFamily: 'var(--font-title)', fontSize: '1.5rem', fontWeight: 700 }}>
        <div style={{ textAlign: 'center' }}>
          <div className="animate-spin" style={{ width: '40px', height: '40px', border: '4px solid hsl(var(--primary) / 0.1)', borderTopColor: 'hsl(var(--primary))', borderRadius: '50%', margin: '0 auto 16px' }} />
          Loading Practice Hub...
        </div>
      </div>
    );
  }

  return (
    <div className={`app-container ${isSidebarCollapsed ? 'sidebar-collapsed' : ''}`}>
      {/* Desktop Sidebar Toggle Trigger (Floating handle when collapsed) */}
      {isSidebarCollapsed && (
        <button
          className="sidebar-toggle-handle"
          onClick={handleToggleSidebar}
          title="Expand Sidebar"
          aria-label="Expand Sidebar"
        >
          <ChevronRight size={18} />
        </button>
      )}

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
        isCollapsed={isSidebarCollapsed}
        onToggleCollapse={handleToggleSidebar}
        onVersionClick={() => setShowVersionModal(true)}
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
          isLoadingVocab ? (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '300px', width: '100%', color: 'hsl(var(--primary))' }}>
              <div style={{ textAlign: 'center' }}>
                <div className="animate-spin" style={{ width: '30px', height: '30px', border: '3px solid hsl(var(--primary) / 0.1)', borderTopColor: 'hsl(var(--primary))', borderRadius: '50%', margin: '0 auto 12px' }} />
                Loading Vocabulary Trainer...
              </div>
            </div>
          ) : (
            <VocabularyTrainer
              lessons={lessons}
              vocabItems={vocabItems}
              masteredIds={masteredVocabIds}
              onSaveMasteredIds={handleSaveVocabulary}
              customVocabItems={customVocabItems}
            />
          )
        ) : activeView === 'audioplayer' ? (
          <Mp3PlayerHub
            lessons={lessons as any}
            activeTrackId={activeAudioCenterTrackId}
            setActiveTrackId={setActiveAudioCenterTrackId}
            audioControl={audioCenterControl}
          />
        ) : activeLesson ? (
          isLoadingActiveLesson ? (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '300px', width: '100%', color: 'hsl(var(--primary))' }}>
              <div style={{ textAlign: 'center' }}>
                <div className="animate-spin" style={{ width: '45px', height: '45px', border: '4px solid hsl(var(--primary) / 0.1)', borderTopColor: 'hsl(var(--primary))', borderRadius: '50%', margin: '0 auto 16px' }} />
                Loading Lesson details...
              </div>
            </div>
          ) : activeLessonData ? (
            <ErrorBoundary key={activeLessonData.id}>
              <LessonWorkspace
                key={activeLessonData.id}
                lesson={activeLessonData}
                progress={progress[activeLessonData.id]}
                onSaveProgress={handleSaveProgress}
                onRecordHistory={handleRecordHistory}
                onQuestionNavConfig={handleQuestionNavConfig}
                onSaveAudioSegments={handleSaveAudioSegments}
                customVocabItems={customVocabItems}
                onSaveCustomVocab={handleSaveCustomVocab}
              />
            </ErrorBoundary>
          ) : (
            <div style={{ padding: '32px', textAlign: 'center', color: 'hsl(var(--text-muted))' }}>
              Không thể tải nội dung bài học. Vui lòng tải lại trang.
            </div>
          )
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

      {/* Toast Notification for Latest Commit */}
      {showUpdateToast && commitMessage && (
        <div className="update-toast glass-panel animate-fade-in-up">
          <div className="update-toast-icon">🚀</div>
          <div className="update-toast-content">
            <h4>Hệ thống đã cập nhật</h4>
            <p className="update-toast-msg">{commitMessage}</p>
            <div className="update-toast-meta">
              <span className="update-toast-hash">#{commitHash.slice(0, 7)}</span>
              {buildDateText && <span className="update-toast-date">{buildDateText}</span>}
            </div>
          </div>
          <button
            onClick={() => {
              setShowUpdateToast(false);
              try {
                localStorage.setItem('toeic_last_seen_commit', commitHash);
              } catch (e) {
                console.error(e);
              }
            }}
            className="update-toast-close"
            title="Đóng thông báo"
          >
            ✕
          </button>
        </div>
      )}

      {/* Version Details Modal */}
      {showVersionModal && (
        <div className="version-modal-overlay" onClick={() => setShowVersionModal(false)}>
          <div className="version-modal glass-panel animate-scale-up" onClick={(e) => e.stopPropagation()}>
            <div className="version-modal-header">
              <h3>Thông tin phiên bản</h3>
              <button className="version-modal-close" onClick={() => setShowVersionModal(false)}>✕</button>
            </div>
            <div className="version-modal-body">
              <div className="version-modal-app-logo">
                <BookOpen className="text-sky-400 animate-pulse" size={48} />
                <h2 style={{ fontFamily: 'var(--font-title)', marginTop: '8px' }}>TOEIC Practice Hub</h2>
                <span>v{appVersion}</span>
              </div>

              <div className="version-modal-info-list">
                <div className="version-modal-info-item">
                  <strong>Thông tin cập nhật mới nhất:</strong>
                  <p className="version-commit-message">{commitMessage}</p>
                </div>

                <div className="version-modal-info-grid">
                  <div className="version-modal-subitem">
                    <strong>Mã Commit:</strong>
                    <code>#{commitHash.slice(0, 7)}</code>
                  </div>
                  <div className="version-modal-subitem">
                    <strong>Nhánh Git:</strong>
                    <code>{branchName || 'main'}</code>
                  </div>
                  <div className="version-modal-subitem">
                    <strong>Thời gian cập nhật:</strong>
                    <span>{buildDateText || 'Hôm nay'}</span>
                  </div>
                  <div className="version-modal-subitem">
                    <strong>Môi trường:</strong>
                    <span>{buildTarget === 'vercel' ? 'Vercel Cloud' : 'Local Host'}</span>
                  </div>
                </div>
              </div>

              <div className="version-modal-footer">
                <a href="https://github.com/lchryu/900toeic" target="_blank" rel="noreferrer" className="primary-btn version-github-btn">
                  Xem trên GitHub
                </a>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default App;
