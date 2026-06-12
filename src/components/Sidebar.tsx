import React from 'react';
import { BookOpen, BarChart2, CheckCircle2, Bookmark, Moon, Sun, Radio, ChevronLeft, Cloud, CloudOff, RefreshCw } from 'lucide-react';
import { LessonManifest, LessonProgress } from '../types';

interface SidebarProps {
  lessons: LessonManifest[];
  currentLessonId: string | null;
  activeView: 'dashboard' | 'lesson' | 'vocabulary' | 'audioplayer';
  progress: { [lessonId: string]: LessonProgress };
  onNavigate: (view: 'dashboard' | 'lesson' | 'vocabulary' | 'audioplayer', lessonId: string | null) => void;
  // Question Navigator props
  questionNumbers: number[];
  answeredQuestions: number[];
  flaggedQuestions: number[];
  isGraded: boolean;
  gradedResults: { [qNum: number]: boolean };
  onQuestionClick?: (qNum: number) => void;
  isMobileOpen?: boolean;
  onCloseMobileSidebar?: () => void;
  theme: 'dark' | 'light';
  onToggleTheme: () => void;
  isCollapsed?: boolean;
  onToggleCollapse?: () => void;
  onVersionClick?: () => void;
  isSyncing?: boolean;
  isAuthenticated?: boolean;
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
  onCloseMobileSidebar,
  theme,
  onToggleTheme,
  isCollapsed = false,
  onToggleCollapse,
  onVersionClick,
  isSyncing = false,
  isAuthenticated = false
}) => {
  const [filterMode, setFilterMode] = React.useState<'all' | 'unanswered' | 'flagged'>('all');

  React.useEffect(() => {
    setFilterMode('all');
  }, [currentLessonId]);

  const filteredQuestionNumbers = React.useMemo(() => {
    if (filterMode === 'all') return questionNumbers;
    if (filterMode === 'unanswered') {
      return questionNumbers.filter((num) => !answeredQuestions.includes(num));
    }
    if (filterMode === 'flagged') {
      return questionNumbers.filter((num) => flaggedQuestions.includes(num));
    }
    return questionNumbers;
  }, [filterMode, questionNumbers, answeredQuestions, flaggedQuestions]);

  const handleNavClick = (view: 'dashboard' | 'lesson' | 'vocabulary' | 'audioplayer', lessonId: string | null) => {
    onNavigate(view, lessonId);
    onCloseMobileSidebar?.();
  };

  const appVersion = typeof __APP_VERSION__ !== 'undefined' ? __APP_VERSION__ : '1.0.0';
  const buildTimestamp = typeof __APP_BUILD_TIMESTAMP__ !== 'undefined' ? __APP_BUILD_TIMESTAMP__ : '';
  const commitHash = typeof __APP_COMMIT_HASH__ !== 'undefined' ? __APP_COMMIT_HASH__ : '';
  const branchName = typeof __APP_BRANCH__ !== 'undefined' ? __APP_BRANCH__ : '';
  const buildTarget = typeof __APP_BUILD_TARGET__ !== 'undefined' ? __APP_BUILD_TARGET__ : '';
  const buildDate = buildTimestamp ? new Date(buildTimestamp) : null;
  const buildDateText = buildDate && !Number.isNaN(buildDate.getTime())
    ? buildDate.toLocaleString('vi-VN', {
      dateStyle: 'medium',
      timeStyle: 'short'
    })
    : '';
  const buildDetails = [
    commitHash ? `Build ${commitHash}` : '',
    branchName && branchName !== 'HEAD' ? branchName : '',
    buildTarget
  ].filter(Boolean).join(' - ');

  return (
    <aside className={`sidebar-panel glass-panel ${isMobileOpen ? 'mobile-open' : ''} ${isCollapsed ? 'collapsed' : ''}`}>
      <div 
        className="sidebar-header" 
        onClick={onVersionClick} 
        style={{ cursor: onVersionClick ? 'pointer' : 'default' }}
        title={onVersionClick ? 'Xem chi tiết phiên bản' : undefined}
      >
        <BookOpen className="text-sky-400 animate-pulse" size={24} style={{ flexShrink: 0 }} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <h2 style={{ fontSize: '1.1rem', fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>TOEIC Practice</h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
            <span style={{ fontSize: '0.75rem', color: 'hsl(var(--text-muted))' }}>v{appVersion}</span>
            {buildDateText ? (
              <span style={{ fontSize: '0.7rem', color: 'hsl(var(--text-muted))', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                Updated {buildDateText}
              </span>
            ) : null}
            {buildDetails ? (
              <span style={{ fontSize: '0.7rem', color: 'hsl(var(--text-muted))', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={buildDetails}>
                {buildDetails}
              </span>
            ) : null}
            
            {/* Cloud Sync Status Badge */}
            <div style={{ marginTop: '4px' }}>
              {isSyncing ? (
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '0.68rem', fontWeight: 600, color: 'hsl(var(--primary))' }} title="Syncing with cloud">
                  <RefreshCw size={10} className="animate-spin" />
                  <span>Syncing...</span>
                </span>
              ) : isAuthenticated ? (
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '0.68rem', fontWeight: 600, color: 'hsl(var(--success))' }} title="All data saved to cloud">
                  <Cloud size={10} />
                  <span>Saved to cloud</span>
                </span>
              ) : (
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '0.68rem', fontWeight: 600, color: 'hsl(var(--text-muted))' }} title="Data saved locally only. Log in to sync.">
                  <CloudOff size={10} />
                  <span>Local storage</span>
                </span>
              )}
            </div>
          </div>
        </div>
        <div style={{ display: 'flex', gap: '6px', alignItems: 'center', flexShrink: 0 }}>
          <button
            className="theme-toggle-btn"
            onClick={onToggleTheme}
            title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
            aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
          >
            {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
          </button>
          <button
            className="sidebar-collapse-btn"
            onClick={onToggleCollapse}
            title="Collapse Sidebar"
            aria-label="Collapse Sidebar"
          >
            <ChevronLeft size={18} />
          </button>
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

        <div
          className={`nav-item ${activeView === 'vocabulary' ? 'active' : ''}`}
          onClick={() => handleNavClick('vocabulary', null)}
        >
          <Bookmark size={18} />
          <span>Vocabulary Trainer</span>
        </div>

        <div
          className={`nav-item ${activeView === 'audioplayer' ? 'active' : ''}`}
          onClick={() => handleNavClick('audioplayer', null)}
        >
          <Radio size={18} />
          <span>Audio Center</span>
        </div>

        <div style={{ marginTop: '16px', paddingLeft: '8px', marginBottom: '8px' }}>
          <span style={{ fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'hsl(var(--text-muted))', fontWeight: 600 }}>
            Lessons
          </span>
        </div>

        {lessons.map((lesson) => {
          const lessonProg = progress[lesson.id];
          const isCompleted = lessonProg && (lessonProg.isSubmitted ?? Object.keys(lessonProg.answers || {}).length > 0);
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
          <h4 style={{ fontSize: '0.85rem', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'hsl(var(--text-muted))', display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '8px' }}>
            <Bookmark size={14} />
            Question Navigator
          </h4>

          {/* Navigator filters row */}
          {!isCollapsed && (
            <div className="navigator-filters">
              <button
                className={`nav-filter-btn ${filterMode === 'all' ? 'active' : ''}`}
                onClick={() => setFilterMode('all')}
                title={`All questions (${questionNumbers.length})`}
              >
                All ({questionNumbers.length})
              </button>
              <button
                className={`nav-filter-btn ${filterMode === 'unanswered' ? 'active' : ''}`}
                onClick={() => setFilterMode('unanswered')}
                title={`Unanswered questions (${questionNumbers.length - answeredQuestions.length})`}
              >
                Unanswered ({questionNumbers.length - answeredQuestions.length})
              </button>
              <button
                className={`nav-filter-btn ${filterMode === 'flagged' ? 'active' : ''}`}
                onClick={() => setFilterMode('flagged')}
                title={`Flagged questions (${flaggedQuestions.length})`}
              >
                Flagged ({flaggedQuestions.length})
              </button>
            </div>
          )}

          <div className="navigator-grid">
            {filteredQuestionNumbers.map((num) => {
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
            {filteredQuestionNumbers.length === 0 && (
              <div style={{ gridColumn: '1 / -1', textAlign: 'center', fontSize: '0.75rem', color: 'hsl(var(--text-muted))', padding: '12px 0' }}>
                No questions found.
              </div>
            )}
          </div>
        </div>
      )}
    </aside>
  );
};
