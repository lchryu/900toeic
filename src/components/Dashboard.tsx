import React from 'react';
import { BookOpen, CheckCircle2, Cloud, CloudOff, Clock, GraduationCap, History, LogIn, LogOut, Pencil, Play, RotateCcw, Upload, Download } from 'lucide-react';
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

// Premium circular SVG progress ring
const CircularProgress: React.FC<{ percent: number; size?: number; strokeWidth?: number; color?: string }> = ({
  percent,
  size = 56,
  strokeWidth = 5,
  color = 'hsl(var(--primary))'
}) => {
  const radius = (size - strokeWidth) / 2;
  const circumference = radius * 2 * Math.PI;
  const offset = circumference - (Math.min(100, Math.max(0, percent)) / 100) * circumference;
  return (
    <svg width={size} height={size} style={{ transform: 'rotate(-90deg)', flexShrink: 0 }}>
      <circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        fill="transparent"
        stroke="hsl(var(--panel-border) / 0.5)"
        strokeWidth={strokeWidth}
      />
      <circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        fill="transparent"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeDasharray={circumference}
        strokeDashoffset={offset}
        strokeLinecap="round"
        style={{ transition: 'stroke-dashoffset 0.6s cubic-bezier(0.4, 0, 0.2, 1)' }}
      />
    </svg>
  );
};

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
  const completionPercent = totalLessonsCount > 0 ? Math.round((completedCount / totalLessonsCount) * 100) : 0;
  
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

  // Detailed listening vs reading breakdown
  const getAccuracyBreakdown = () => {
    let listeningTotal = 0;
    let listeningCorrect = 0;
    let readingTotal = 0;
    let readingCorrect = 0;

    Object.entries(progress).forEach(([lessonId, p]) => {
      if (!p.isSubmitted && (!p.answers || Object.keys(p.answers).length === 0)) return;
      const lesson = lessons.find((l) => l.id === lessonId);
      if (!lesson) return;

      // Listening
      lesson.listening.forEach((g) => {
        g.questions.forEach((q) => {
          listeningTotal++;
          const userAns = p.answers[q.num];
          const correctOpt = q.options.find((o) => o.correct)?.label;
          if (userAns && userAns === correctOpt) {
            listeningCorrect++;
          }
        });
      });

      // Reading
      lesson.reading.forEach((g) => {
        g.questions.forEach((q) => {
          readingTotal++;
          const userAns = p.answers[q.num];
          const correctOpt = q.options.find((o) => o.correct)?.label;
          if (userAns && userAns === correctOpt) {
            readingCorrect++;
          }
        });
      });
    });

    const listeningPct = listeningTotal > 0 ? Math.round((listeningCorrect / listeningTotal) * 100) : 0;
    const readingPct = readingTotal > 0 ? Math.round((readingCorrect / readingTotal) * 100) : 0;

    return {
      listeningTotal,
      listeningCorrect,
      listeningPct,
      readingTotal,
      readingCorrect,
      readingPct
    };
  };

  const breakdown = getAccuracyBreakdown();

  // Export progress
  const handleExportBackup = () => {
    try {
      const backup = {
        progress: localStorage.getItem('toeic_practice_progress') ? JSON.parse(localStorage.getItem('toeic_practice_progress')!) : {},
        history: localStorage.getItem('toeic_practice_history') ? JSON.parse(localStorage.getItem('toeic_practice_history')!) : [],
        vocab: localStorage.getItem('toeic_vocabulary_mastered') ? JSON.parse(localStorage.getItem('toeic_vocabulary_mastered')!) : []
      };
      const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(backup, null, 2));
      const downloadAnchor = document.createElement('a');
      downloadAnchor.setAttribute('href', dataStr);
      downloadAnchor.setAttribute('download', `toeic_practice_backup_${new Date().toISOString().split('T')[0]}.json`);
      document.body.appendChild(downloadAnchor);
      downloadAnchor.click();
      downloadAnchor.remove();
    } catch (e) {
      alert('Failed to export backup: ' + e);
    }
  };

  // Import progress
  const handleImportBackup = (e: React.ChangeEvent<HTMLInputElement>) => {
    const fileReader = new FileReader();
    const files = e.target.files;
    if (!files || files.length === 0) return;
    
    fileReader.onload = (event) => {
      try {
        const data = JSON.parse(event.target?.result as string);
        if (data.progress || data.history || data.vocab) {
          if (data.progress) localStorage.setItem('toeic_practice_progress', JSON.stringify(data.progress));
          if (data.history) localStorage.setItem('toeic_practice_history', JSON.stringify(data.history));
          if (data.vocab) localStorage.setItem('toeic_vocabulary_mastered', JSON.stringify(data.vocab));
          alert('Backup restored successfully! The page will reload.');
          window.location.reload();
        } else {
          alert('Invalid backup file structure.');
        }
      } catch (err) {
        alert('Failed to parse backup file: ' + err);
      }
    };
    fileReader.readAsText(files[0]);
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
      <header style={{ marginBottom: '40px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '20px' }}>
        <div>
          <h1 style={{ fontSize: '2.5rem', fontWeight: 800, marginBottom: '8px', fontFamily: 'var(--font-title)' }}>
            Learning Dashboard
          </h1>
          <p style={{ color: 'hsl(var(--text-secondary))' }}>
            Track your progress, view test scores, and continue your TOEIC listening and reading practice.
          </p>
        </div>

        {/* Local Backup Restores */}
        <div style={{ display: 'flex', gap: '8px' }}>
          <button className="secondary-btn" onClick={handleExportBackup} style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 12px', fontSize: '0.85rem' }}>
            <Download size={14} />
            <span>Export Backup</span>
          </button>
          <label className="secondary-btn" style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 12px', fontSize: '0.85rem', cursor: 'pointer' }}>
            <Upload size={14} />
            <span>Import Backup</span>
            <input type="file" accept=".json" onChange={handleImportBackup} style={{ display: 'none' }} />
          </label>
        </div>
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
      <div className="dashboard-grid" style={{ padding: 0, marginBottom: '24px' }}>
        <div className="glass-panel stat-card" style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
          <CircularProgress percent={completionPercent} color="hsl(var(--primary))" />
          <div>
            <span className="stat-title">Lessons Completed</span>
            <span className="stat-val">{completedCount} / {totalLessonsCount}</span>
            <p style={{ fontSize: '0.85rem', color: 'hsl(var(--text-muted))', marginTop: '2px' }}>
              {totalLessonsCount} practice sets available
            </p>
          </div>
        </div>

        <div className="glass-panel stat-card" style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
          <CircularProgress percent={averageScorePct} color="hsl(var(--success))" />
          <div>
            <span className="stat-title">Average Accuracy</span>
            <span className="stat-val">{averageScorePct}%</span>
            <p style={{ fontSize: '0.85rem', color: 'hsl(var(--text-muted))', marginTop: '2px' }}>
              Across all completed tests
            </p>
          </div>
        </div>

        <div className="glass-panel stat-card" style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', width: '56px', height: '56px', borderRadius: '50%', background: 'hsl(var(--panel-border) / 0.3)' }}>
            <Clock className="text-amber-400" size={24} />
          </div>
          <div>
            <span className="stat-title">Practice Time</span>
            <span className="stat-val">{formatTotalTime(totalTimeSeconds)}</span>
            <p style={{ fontSize: '0.85rem', color: 'hsl(var(--text-muted))', marginTop: '2px' }}>
              Total active practice time
            </p>
          </div>
        </div>

        <div className="glass-panel stat-card" style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', width: '56px', height: '56px', borderRadius: '50%', background: 'hsl(var(--panel-border) / 0.3)' }}>
            <GraduationCap className="text-emerald-400" size={26} />
          </div>
          <div>
            <span className="stat-title">Study Time</span>
            <span className="stat-val">{formatTotalTime(totalStudyTimeSeconds)}</span>
            <p style={{ fontSize: '0.85rem', color: 'hsl(var(--text-muted))', marginTop: '2px' }}>
              Time spent in study mode
            </p>
          </div>
        </div>
      </div>

      {/* Listening vs Reading Breakdown Panel */}
      {completedCount > 0 && (
        <div className="glass-panel" style={{ padding: '24px', marginBottom: '24px' }}>
          <h3 style={{ fontSize: '1.2rem', fontWeight: 700, marginBottom: '16px' }}>Performance Breakdown</h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '24px' }}>
            {/* Listening stats */}
            <div style={{ padding: '16px', borderRadius: '8px', border: '1px solid hsl(var(--panel-border) / 0.5)', background: 'hsl(var(--panel-bg) / 0.2)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                <strong style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span>🎧 Listening accuracy</span>
                </strong>
                <span style={{ fontSize: '1.2rem', fontWeight: 800, color: 'hsl(var(--primary))' }}>{breakdown.listeningPct}%</span>
              </div>
              <div style={{ height: '8px', width: '100%', background: 'hsl(var(--panel-border) / 0.3)', borderRadius: '4px', overflow: 'hidden', marginBottom: '8px' }}>
                <div style={{ height: '100%', width: `${breakdown.listeningPct}%`, background: 'hsl(var(--primary))', borderRadius: '4px' }} />
              </div>
              <span style={{ fontSize: '0.85rem', color: 'hsl(var(--text-muted))' }}>
                Correct: {breakdown.listeningCorrect} / {breakdown.listeningTotal} answers
              </span>
            </div>

            {/* Reading stats */}
            <div style={{ padding: '16px', borderRadius: '8px', border: '1px solid hsl(var(--panel-border) / 0.5)', background: 'hsl(var(--panel-bg) / 0.2)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                <strong style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span>📖 Reading accuracy</span>
                </strong>
                <span style={{ fontSize: '1.2rem', fontWeight: 800, color: 'hsl(var(--success))' }}>{breakdown.readingPct}%</span>
              </div>
              <div style={{ height: '8px', width: '100%', background: 'hsl(var(--panel-border) / 0.3)', borderRadius: '4px', overflow: 'hidden', marginBottom: '8px' }}>
                <div style={{ height: '100%', width: `${breakdown.readingPct}%`, background: 'hsl(var(--success))', borderRadius: '4px' }} />
              </div>
              <span style={{ fontSize: '0.85rem', color: 'hsl(var(--text-muted))' }}>
                Correct: {breakdown.readingCorrect} / {breakdown.readingTotal} answers
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Main Panel */}
      <div className="dashboard-main-layout" style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '32px' }}>
        
        {/* Left Side: Recommend for You & Lessons List */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>
          {/* Featured Recommendation */}
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

          {/* Lessons Grid list */}
          <div className="glass-panel" style={{ padding: '24px' }}>
            <h3 style={{ fontSize: '1.2rem', fontWeight: 700, marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <BookOpen size={20} className="text-sky-400" />
              Lesson Directory
            </h3>
            
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: '16px' }}>
              {lessons.map((lesson) => {
                const counts = getLessonQuestionCounts(lesson);
                const lessonProg = progress[lesson.id];
                const isCompleted = lessonProg && (lessonProg.isSubmitted ?? Object.keys(lessonProg.answers || {}).length > 0);
                const score = lessonProg ? lessonProg.score : 0;
                const totalQ = lessonProg ? lessonProg.totalQuestions : counts.total;
                const answeredCount = lessonProg ? Object.keys(lessonProg.answers || {}).length : 0;
                
                let statusText = 'Not started';
                let statusColor = 'hsl(var(--text-muted))';
                let progressPercent = 0;
                
                if (isCompleted) {
                  statusText = `Completed · ${score}/${totalQ}`;
                  statusColor = 'hsl(var(--success))';
                  progressPercent = 100;
                } else if (answeredCount > 0) {
                  statusText = `In Progress · ${answeredCount}/${counts.total}`;
                  statusColor = 'hsl(var(--warning))';
                  progressPercent = Math.round((answeredCount / counts.total) * 100);
                }

                return (
                  <div
                    key={lesson.id}
                    className="lesson-grid-card"
                    style={{
                      padding: '16px',
                      borderRadius: '12px',
                      background: 'hsl(var(--panel-bg) / 0.35)',
                      border: '1px solid hsl(var(--panel-border))',
                      display: 'flex',
                      flexDirection: 'column',
                      justifyContent: 'space-between',
                      cursor: 'pointer'
                    }}
                    onClick={() => onStartLesson(lesson.id)}
                  >
                    <div>
                      <h4 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: '4px', color: 'hsl(var(--text-primary))' }}>
                        {lesson.title.replace(/📘|Lesson\s*/g, '').trim()}
                      </h4>
                      <span style={{ fontSize: '0.75rem', color: 'hsl(var(--text-muted))' }}>
                        {counts.listening} Listening · {counts.reading} Reading
                      </span>
                      
                      {/* Progress bar */}
                      <div style={{ margin: '14px 0 10px 0' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.72rem', marginBottom: '4px' }}>
                          <span style={{ color: statusColor, fontWeight: 600 }}>{statusText}</span>
                          <span style={{ color: 'hsl(var(--text-muted))' }}>{progressPercent}%</span>
                        </div>
                        <div style={{ width: '100%', height: '6px', background: 'hsl(var(--panel-border) / 0.5)', borderRadius: '3px', overflow: 'hidden' }}>
                          <div style={{ width: `${progressPercent}%`, height: '100%', background: isCompleted ? 'hsl(var(--success))' : 'hsl(var(--primary))', borderRadius: '3px' }} />
                        </div>
                      </div>
                    </div>

                    <button
                      className={isCompleted ? 'secondary-btn' : 'primary-btn'}
                      style={{
                        width: '100%',
                        padding: '8px 16px',
                        fontSize: '0.8rem',
                        marginTop: '12px',
                        justifyContent: 'center',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px'
                      }}
                      onClick={(e) => {
                        e.stopPropagation(); // Avoid triggering parent div onClick
                        onStartLesson(lesson.id);
                      }}
                    >
                      <Play size={12} fill="currentColor" />
                      {isCompleted ? 'Review Lesson' : answeredCount > 0 ? 'Resume Lesson' : 'Start Lesson'}
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
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


