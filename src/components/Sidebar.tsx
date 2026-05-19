import React from 'react';
import { BookOpen, BarChart2, CheckCircle2, Bookmark } from 'lucide-react';
import { LessonData, LessonProgress } from '../types';

interface SidebarProps {
  lessons: LessonData[];
  currentLessonId: string | null;
  activeView: 'dashboard' | 'lesson';
  progress: { [lessonId: string]: LessonProgress };
  onNavigate: (view: 'dashboard' | 'lesson', lessonId: string | null) => void;
  // Question Navigator props
  questionNumbers: number[];
  answeredQuestions: number[];
  flaggedQuestions: number[];
  isGraded: boolean;
  gradedResults: { [qNum: number]: boolean };
  onQuestionClick?: (qNum: number) => void;
  isMobileOpen?: boolean;
  onCloseMobileSidebar?: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  lessons,
  currentLessonId,
  activeView,
  progress,
  onNavigate,
  questionNumbers,
  answeredQuestions,
  flaggedQuestions,
  isGraded,
  gradedResults,
  onQuestionClick,
  isMobileOpen,
  onCloseMobileSidebar
}) => {
  const handleNavClick = (view: 'dashboard' | 'lesson', lessonId: string | null) => {
    onNavigate(view, lessonId);
    onCloseMobileSidebar?.();
  };

  return (
    <aside className={`sidebar-panel glass-panel ${isMobileOpen ? 'mobile-open' : ''}`}>
      <div className="sidebar-header">
        <BookOpen className="text-sky-400" size={24} />
        <div>
          <h2 style={{ fontSize: '1.1rem', fontWeight: 700 }}>TOEIC Practice</h2>
          <span style={{ fontSize: '0.75rem', color: 'hsl(var(--text-muted))' }}>v1.0.0</span>
        </div>
      </div>

      <nav className="sidebar-nav">
        <div
          className={`nav-item ${activeView === 'dashboard' ? 'active' : ''}`}
          onClick={() => handleNavClick('dashboard', null)}
        >
          <BarChart2 size={18} />
          <span>Dashboard</span>
        </div>

        <div style={{ marginTop: '16px', paddingLeft: '8px', marginBottom: '8px' }}>
          <span style={{ fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'hsl(var(--text-muted))', fontWeight: 600 }}>
            Lessons
          </span>
        </div>

        {lessons.map((lesson) => {
          const lessonProg = progress[lesson.id];
          const isCompleted = lessonProg && lessonProg.answers && Object.keys(lessonProg.answers).length > 0;
          const score = lessonProg ? lessonProg.score : 0;
          const totalQ = lessonProg ? lessonProg.totalQuestions : 0;

          return (
            <div
              key={lesson.id}
              className={`nav-item ${activeView === 'lesson' && currentLessonId === lesson.id ? 'active' : ''}`}
              onClick={() => handleNavClick('lesson', lesson.id)}
            >
              <BookOpen size={16} />
              <span style={{ flex: 1 }}>{lesson.title.replace(/📘|Lesson\s*/g, '').trim()}</span>
              {isCompleted && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <span style={{ fontSize: '0.75rem', padding: '2px 6px', borderRadius: '4px', background: 'rgba(16, 185, 129, 0.1)', color: 'hsl(var(--success))' }}>
                    {score}/{totalQ}
                  </span>
                  <CheckCircle2 size={14} className="text-emerald-500" />
                </div>
              )}
            </div>
          );
        })}
      </nav>

      {/* Render Question Navigator Grid if inside a lesson */}
      {activeView === 'lesson' && currentLessonId && questionNumbers.length > 0 && (
        <div className="navigator-container">
          <h4 style={{ fontSize: '0.85rem', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'hsl(var(--text-muted))', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <Bookmark size={14} />
            Question Navigator
          </h4>
          <div className="navigator-grid">
            {questionNumbers.map((num) => {
              const isAnswered = answeredQuestions.includes(num);
              const isFlagged = flaggedQuestions.includes(num);
              const isCorrect = gradedResults[num];

              let navClass = '';
              if (isGraded) {
                navClass = isCorrect ? 'correct-nav' : 'incorrect-nav';
              } else if (isFlagged) {
                navClass = 'flagged';
              } else if (isAnswered) {
                navClass = 'answered';
              }

              return (
                <button
                  key={num}
                  className={`nav-q-btn ${navClass}`}
                  onClick={() => onQuestionClick?.(num)}
                  title={`Go to Question ${num}`}
                >
                  {num}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </aside>
  );
};
