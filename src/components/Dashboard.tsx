import React from 'react';
import { Award, BookOpen, CheckCircle2, Cloud, CloudOff, Clock, GraduationCap, History, LogIn, LogOut, Pencil, Play, RotateCcw } from 'lucide-react';
import { LessonData, LessonProgress, PracticeHistoryEntry } from '../types';
import type { AuthUser } from '../services/firebase';

interface DashboardProps {
  lessons: LessonData[];
  progress: { [lessonId: string]: LessonProgress };
  history: PracticeHistoryEntry[];
  authUser: AuthUser | null;
  isAuthConfigured: boolean;
  isSyncing: boolean;
  syncMessage: string | null;
  onSignIn: () => void;
  onSignOut: () => void;
  onStartLesson: (lessonId: string) => void;
}

export const Dashboard: React.FC<DashboardProps> = ({
  lessons,
  progress,
  history,
  authUser,
  isAuthConfigured,
  isSyncing,
  syncMessage,
  onSignIn,
  onSignOut,
  onStartLesson
}) => {
  const completedLessons = Object.values(progress).filter(
    (p) => p.isSubmitted ?? (p.answers && Object.keys(p.answers).length > 0)
  );

  const totalLessonsCount = lessons.length;
  const completedCount = completedLessons.length;
  
  // Calculate average score
  let averageScorePct = 0;
  if (completedCount > 0) {
    const totalScorePct = completedLessons.reduce((acc, curr) => {
      return acc + (curr.score / (curr.totalQuestions || 1)) * 100;
    }, 0);
    averageScorePct = Math.round(totalScorePct / completedCount);
  }

  // Calculate total time spent
  const totalTimeSeconds = Object.values(progress).reduce((acc, curr) => acc + (curr.timeSpent || 0), 0);
  const totalStudyTimeSeconds = Object.values(progress).reduce((acc, curr) => acc + (curr.studyTimeSpent || 0), 0);
  const formatTotalTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const hrs = Math.floor(mins / 60);
    if (hrs > 0) {
      return `${hrs}h ${mins % 60}m`;
    }
    return `${mins}m`;
  };

  // Find next lesson to do
  const nextLesson = lessons.find((l) => !(progress[l.id]?.isSubmitted ?? Object.keys(progress[l.id]?.answers || {}).length > 0)) || lessons[0];
  const getLessonQuestionCounts = (lesson: LessonData | undefined) => {
    if (!lesson) return { listening: 0, reading: 0, total: 0 };

    const listening = lesson.listening.reduce((sum, group) => sum + group.questions.length, 0);
    const reading = lesson.reading.reduce((sum, group) => sum + group.questions.length, 0);
    return { listening, reading, total: listening + reading };
  };
  const nextLessonCounts = getLessonQuestionCounts(nextLesson);

  const getUserInitials = (user: AuthUser) => {
    const name = user.displayName || user.email || '';
    const words = name.trim().split(/\s+/);
    return words.length >= 2
      ? `${words[0][0] || ''}${words[words.length - 1][0] || ''}`.toUpperCase()
      : (name[0] || '').toUpperCase();
  };

  const formatDateTime = (timestamp: string) => {
    const date = new Date(timestamp);
    if (Number.isNaN(date.getTime())) return '';
    return date.toLocaleString('vi-VN', {
      dateStyle: 'medium',
      timeStyle: 'short'
    });
  };

  const getHistoryCopy = (entry: PracticeHistoryEntry) => {
    if (entry.activity === 'submitted') return 'Submitted practice';
    if (entry.activity === 'reset') return 'Reset practice';
    if (entry.activity === 'mode_changed') {
      return `${entry.fromMode || 'mode'} -> ${entry.mode}`;
    }
    return entry.mode === 'study' ? 'Opened study mode' : entry.mode === 'review' ? 'Opened review mode' : 'Opened practice mode';
  };

  const getHistoryIcon = (entry: PracticeHistoryEntry) => {
    if (entry.activity === 'submitted') return CheckCircle2;
    if (entry.activity === 'reset') return RotateCcw;
    if (entry.mode === 'study') return GraduationCap;
    if (entry.mode === 'practice') return Pencil;
    return History;
  };

  return (
    <div style={{ padding: '32px', maxWidth: '1200px', margin: '0 auto', width: '100%' }}>
      <header style={{ marginBottom: '40px' }}>
        <h1 style={{ fontSize: '2.5rem', fontWeight: 800, marginBottom: '8px', fontFamily: 'var(--font-title)' }}>
          Learning Dashboard
        </h1>
        <p style={{ color: 'hsl(var(--text-secondary))' }}>
          Track your progress, view test scores, and continue your TOEIC listening and reading practice.
        </p>
      </header>

      <div className="glass-panel google-sync-panel">
        <div className="google-sync-main">
          <div className="google-sync-icon">
            {isAuthConfigured ? <Cloud size={22} /> : <CloudOff size={22} />}
          </div>
          <div>
            <h3>Google progress sync</h3>
            <p>
              {isAuthConfigured
                ? authUser
                  ? `Signed in as ${authUser.email || authUser.displayName || 'Google user'}`
                  : 'Sign in to save lesson progress to your Google account.'
                : 'Add Firebase config in .env to enable Google sign-in and cloud progress.'}
            </p>
            {(isSyncing || syncMessage) && (
              <span className="sync-status">
                {isSyncing ? 'Syncing progress...' : syncMessage}
              </span>
            )}
          </div>
        </div>

        {authUser ? (
          <div className="google-account-actions">
            {authUser.photoURL ? (
              <img
                src={authUser.photoURL}
                alt={authUser.displayName || authUser.email || 'Google account'}
                className="google-avatar"
              />
            ) : (
              <div className="google-avatar google-avatar-fallback" aria-label="User initials">
                {getUserInitials(authUser)}
              </div>
            )}
            <button className="secondary-btn" onClick={onSignOut}>
              <LogOut size={16} />
              <span>Sign out</span>
            </button>
          </div>
        ) : (
          <button className="primary-btn google-login-btn" onClick={onSignIn} disabled={!isAuthConfigured}>
            <LogIn size={16} />
            <span>Login with Google</span>
          </button>
        )}
      </div>

      {/* Stats Grid */}
      <div className="dashboard-grid" style={{ padding: 0, marginBottom: '40px' }}>
        <div className="glass-panel stat-card">
          <BookOpen className="stat-icon text-sky-400" />
          <span className="stat-title">Lessons Completed</span>
          <span className="stat-val">{completedCount} / {totalLessonsCount}</span>
          <p style={{ fontSize: '0.85rem', color: 'hsl(var(--text-muted))' }}>
            {totalLessonsCount} practice sets available
          </p>
        </div>

        <div className="glass-panel stat-card">
          <Award className="stat-icon text-emerald-400" />
          <span className="stat-title">Average Accuracy</span>
          <span className="stat-val">{averageScorePct}%</span>
          <p style={{ fontSize: '0.85rem', color: 'hsl(var(--text-muted))' }}>
            Across all completed tests
          </p>
        </div>

        <div className="glass-panel stat-card">
          <Clock className="stat-icon text-amber-400" />
          <span className="stat-title">Practice Time</span>
          <span className="stat-val">{formatTotalTime(totalTimeSeconds)}</span>
          <p style={{ fontSize: '0.85rem', color: 'hsl(var(--text-muted))' }}>
            Total active practice time
          </p>
        </div>

        <div className="glass-panel stat-card">
          <GraduationCap className="stat-icon text-emerald-400" />
          <span className="stat-title">Study Time</span>
          <span className="stat-val">{formatTotalTime(totalStudyTimeSeconds)}</span>
          <p style={{ fontSize: '0.85rem', color: 'hsl(var(--text-muted))' }}>
            Time spent in study mode
          </p>
        </div>
      </div>

      {/* Main Panel */}
      <div className="dashboard-main-layout" style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '32px' }}>
        {/* Next Lesson / Continue */}
        <div className="glass-panel" style={{ padding: '32px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
          <div>
            <span style={{ fontSize: '0.8rem', color: 'hsl(var(--primary))', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Recommend for you
            </span>
            <h3 style={{ fontSize: '1.8rem', fontWeight: 700, marginTop: '8px', marginBottom: '12px' }}>
              {nextLesson?.title || 'TOEIC Practice'}
            </h3>
            <p style={{ color: 'hsl(var(--text-secondary))', lineHeight: 1.6, marginBottom: '24px' }}>
              Practice {nextLessonCounts.total} questions: {nextLessonCounts.listening} listening and {nextLessonCounts.reading} reading. Work under time constraints and get instant feedback.
            </p>
          </div>
          {nextLesson && (
            <button
              className="primary-btn"
              style={{ alignSelf: 'flex-start', display: 'flex', alignItems: 'center', gap: '8px', padding: '12px 24px' }}
              onClick={() => onStartLesson(nextLesson.id)}
            >
              <Play size={18} fill="currentColor" />
              Start Lesson
            </button>
          )}
        </div>

        {/* Recent Activity */}
        <div className="glass-panel" style={{ padding: '24px' }}>
          <h3 style={{ fontSize: '1.2rem', marginBottom: '16px', borderBottom: '1px solid hsl(var(--panel-border))', paddingBottom: '12px' }}>
            History
          </h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {history.length === 0 ? (
              <p style={{ color: 'hsl(var(--text-muted))', fontSize: '0.9rem', textAlign: 'center', padding: '20px 0' }}>
                No history yet. Open study or practice mode to start tracking.
              </p>
            ) : (
              history.slice(0, 8).map((entry) => {
                const Icon = getHistoryIcon(entry);
                const scorePct = entry.score !== undefined
                  ? Math.round((entry.score / (entry.totalQuestions || 1)) * 100)
                  : null;

                return (
                  <div
                    key={entry.id}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '12px',
                      padding: '12px',
                      borderRadius: '8px',
                      background: 'hsl(var(--panel-bg) / 0.45)',
                      border: '1px solid hsl(var(--panel-border))'
                    }}
                  >
                    <div className="history-icon">
                      <Icon size={16} />
                    </div>
                    <div style={{ minWidth: 0, flex: 1 }}>
                      <h4 style={{ fontSize: '0.9rem', fontWeight: 600 }}>
                        {entry.lessonTitle.replace(/ðŸ“˜|Lesson\s*/g, '').trim() || `Lesson ${entry.lessonId}`}
                      </h4>
                      <span style={{ fontSize: '0.75rem', color: 'hsl(var(--text-muted))' }}>
                        {getHistoryCopy(entry)} · {formatDateTime(entry.timestamp)}
                      </span>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      {entry.activity === 'submitted' && entry.score !== undefined ? (
                        <>
                          <span style={{ fontSize: '1.05rem', fontWeight: 700, color: 'hsl(var(--primary))' }}>
                            {entry.score}/{entry.totalQuestions}
                          </span>
                          <div style={{ fontSize: '0.72rem', color: 'hsl(var(--text-muted))' }}>{scorePct}%</div>
                        </>
                      ) : (
                        <span style={{ fontSize: '0.8rem', color: 'hsl(var(--text-muted))' }}>
                          {entry.answeredCount}/{entry.totalQuestions}
                        </span>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>      </div>
    </div>
  );
};


