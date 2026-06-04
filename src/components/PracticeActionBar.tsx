import React from 'react';
import { AlertTriangle, Award, Clock, Pencil, RotateCcw } from 'lucide-react';

interface PracticeActionBarProps {
  elapsedTime: number;
  answeredQuestionCount: number;
  totalQuestions: number;
  score: number;
  isGraded: boolean;
  isPracticeActive: boolean;
  isStudyMode: boolean;
  onStartPractice: () => void;
  onGradeTest: () => void;
  onResetTest: () => void;
}

const formatTime = (seconds: number) => {
  const hrs = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;
  return `${hrs > 0 ? hrs + ':' : ''}${mins < 10 && hrs > 0 ? '0' : ''}${mins}:${secs < 10 ? '0' : ''}${secs}`;
};

export const PracticeActionBar: React.FC<PracticeActionBarProps> = ({
  elapsedTime,
  answeredQuestionCount,
  totalQuestions,
  score,
  isGraded,
  isPracticeActive,
  isStudyMode,
  onStartPractice,
  onGradeTest,
  onResetTest
}) => {
  const hasUnansweredQuestions = answeredQuestionCount < totalQuestions;
  const scorePercent = totalQuestions > 0 ? Math.round((score / totalQuestions) * 100) : 0;

  return (
    <div className="control-banner">
      <div style={{ display: 'flex', alignItems: 'center', gap: '24px' }}>
        <div className="timer-box">
          <div className={isGraded ? '' : 'timer-pulse'} />
          <Clock size={16} />
          <span>Time: {formatTime(elapsedTime)}</span>
          {isPracticeActive ? (
            <span className="practice-progress-pill">{answeredQuestionCount}/{totalQuestions}</span>
          ) : null}
        </div>

        {isGraded && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', background: 'rgba(16, 185, 129, 0.1)', padding: '6px 12px', borderRadius: '6px', border: '1px solid hsl(var(--success) / 0.2)' }}>
            <Award size={16} className="text-emerald-500" />
            <span style={{ fontWeight: 600, color: 'hsl(var(--success))' }}>
              Score: {score} / {totalQuestions} ({scorePercent}%)
            </span>
          </div>
        )}
      </div>

      <div style={{ display: 'flex', gap: '12px' }}>
        {isStudyMode && !isGraded ? (
          <button className="primary-btn" style={{ display: 'flex', alignItems: 'center', gap: '8px' }} onClick={onStartPractice}>
            <Pencil size={16} />
            <span>Start Practice</span>
          </button>
        ) : isGraded ? (
          <button className="secondary-btn" style={{ display: 'flex', alignItems: 'center', gap: '8px' }} onClick={onResetTest}>
            <RotateCcw size={16} />
            <span>Reset & Retake</span>
          </button>
        ) : (
          <button
            className="primary-btn"
            style={{
              background: hasUnansweredQuestions ? 'hsl(var(--warning))' : 'hsl(var(--primary))'
            }}
            onClick={onGradeTest}
          >
            {hasUnansweredQuestions ? (
              <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <AlertTriangle size={16} />
                <span className="desktop-grade-label">Grade Test ({answeredQuestionCount}/{totalQuestions} Done)</span>
                <span className="mobile-grade-label">Grade {answeredQuestionCount}/{totalQuestions}</span>
              </span>
            ) : (
              <>
                <span className="desktop-grade-label">Grade & Submit Test</span>
                <span className="mobile-grade-label">Grade</span>
              </>
            )}
          </button>
        )}
      </div>
    </div>
  );
};
