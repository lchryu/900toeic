import React, { useState, useEffect } from 'react';
import { Sidebar } from './components/Sidebar';
import { Dashboard } from './components/Dashboard';
import { LessonWorkspace } from './components/LessonWorkspace';
import { LessonData, LessonProgress } from './types';
import { Menu } from 'lucide-react';
import lessonsData from './data/lessons.json';

const LOCAL_STORAGE_KEY = 'toeic_practice_progress';

const App: React.FC = () => {
  const lessons = lessonsData as LessonData[];
  
  const [activeView, setActiveView] = useState<'dashboard' | 'lesson'>('dashboard');
  const [currentLessonId, setCurrentLessonId] = useState<string | null>(null);
  
  // Mobile sidebar drawer state
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);
  
  // Progress state
  const [progress, setProgress] = useState<{ [lessonId: string]: LessonProgress }>({});

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
    } catch (e) {
      console.error('Failed to load progress from localStorage:', e);
    }
  }, []);

  const handleNavigate = (view: 'dashboard' | 'lesson', lessonId: string | null) => {
    setActiveView(view);
    setCurrentLessonId(lessonId);
    // Reset nav grid if moving away from lesson
    if (view === 'dashboard') {
      setNavConfig({
        questionNumbers: [],
        answeredQuestions: [],
        flaggedQuestions: [],
        isGraded: false,
        gradedResults: {},
        scrollCallback: null
      });
    }
  };

  const handleSaveProgress = (
    lessonId: string,
    answers: { [qNum: number]: string },
    timeSpent: number,
    score: number,
    totalQuestions: number
  ) => {
    const updatedProgress = {
      ...progress,
      [lessonId]: {
        lessonId,
        answers,
        timeSpent,
        score,
        totalQuestions,
        completedDate: new Date().toISOString()
      }
    };
    
    setProgress(updatedProgress);
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(updatedProgress));
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
            color: 'white',
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
            onStartLesson={(id) => handleNavigate('lesson', id)}
          />
        ) : activeLesson ? (
          <LessonWorkspace
            key={activeLesson.id}
            lesson={activeLesson}
            progress={progress[activeLesson.id]}
            onSaveProgress={handleSaveProgress}
            onQuestionNavConfig={handleQuestionNavConfig}
          />
        ) : (
          <div style={{ padding: '32px', textAlign: 'center', color: 'hsl(var(--text-muted))' }}>
            Lesson not found.
          </div>
        )}
      </main>
    </div>
  );
};

export default App;
