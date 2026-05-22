import React, { useState, useEffect, useRef } from 'react';
import { LessonData, QuestionState, LessonProgress } from '../types';
import { AudioPlayer } from './AudioPlayer';
import { ListeningWorkspace } from './ListeningWorkspace';
import { ReadingPassage } from './ReadingPassage';
import { QuestionBlock } from './QuestionBlock';
import { Headphones, BookOpen, Clock, Award, RotateCcw, AlertTriangle } from 'lucide-react';

interface LessonWorkspaceProps {
  lesson: LessonData;
  progress: LessonProgress | undefined;
  onSaveProgress: (lessonId: string, answers: { [qNum: number]: string }, timeSpent: number, score: number, totalQuestions: number, isSubmitted?: boolean) => void;
  onQuestionNavConfig: (qNums: number[], answered: number[], flagged: number[], isGraded: boolean, results: { [qNum: number]: boolean }, scrollCallback: (num: number) => void) => void;
}

export const LessonWorkspace: React.FC<LessonWorkspaceProps> = ({
  lesson,
  progress,
  onSaveProgress,
  onQuestionNavConfig
}) => {
  const [activeTab, setActiveTab] = useState<'listening' | 'reading'>('listening');
  const [selectedAnswers, setSelectedAnswers] = useState<{ [qNum: number]: string }>(
    progress?.answers || {}
  );
  const [questionStates, setQuestionStates] = useState<{ [qNum: number]: QuestionState }>({});
  const [isGraded, setIsGraded] = useState<boolean>(
    !!(progress?.isSubmitted ?? (progress && progress.answers && Object.keys(progress.answers).length > 0))
  );
  
  // Timer state
  const [elapsedTime, setElapsedTime] = useState<number>(progress?.timeSpent || 0);
  const timerRef = useRef<any | null>(null);
  const elapsedTimeRef = useRef(elapsedTime);

  useEffect(() => {
    elapsedTimeRef.current = elapsedTime;
  }, [elapsedTime]);

  // Sync state when lesson changes
  useEffect(() => {
    setSelectedAnswers(progress?.answers || {});
    setIsGraded(!!(progress?.isSubmitted ?? (progress && progress.answers && Object.keys(progress.answers).length > 0)));
    setElapsedTime(progress?.timeSpent || 0);
    setQuestionStates({});
  }, [lesson.id]);

  // Start timer if not graded
  useEffect(() => {
    if (!isGraded) {
      timerRef.current = setInterval(() => {
        setElapsedTime((prev) => prev + 1);
      }, 1000);
    } else {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    }

    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    };
  }, [isGraded, lesson.id]);

  // Calculate score and total questions
  const totalQuestions =
    lesson.listening.reduce((sum, g) => sum + g.questions.length, 0) +
    lesson.reading.reduce((sum, g) => sum + g.questions.length, 0);

  const getGradedResults = () => {
    const results: { [qNum: number]: boolean } = {};
    
    // Check listening
    lesson.listening.forEach((g) => {
      g.questions.forEach((q) => {
        const correctOpt = q.options.find((o) => o.correct);
        results[q.num] = selectedAnswers[q.num] === correctOpt?.label;
      });
    });

    // Check reading
    lesson.reading.forEach((g) => {
      g.questions.forEach((q) => {
        const correctOpt = q.options.find((o) => o.correct);
        results[q.num] = selectedAnswers[q.num] === correctOpt?.label;
      });
    });

    return results;
  };

  const gradedResults = getGradedResults();
  const score = Object.values(gradedResults).filter(Boolean).length;

  useEffect(() => {
    if (isGraded) return;

    const saveDraftTimer = window.setTimeout(() => {
      onSaveProgress(lesson.id, selectedAnswers, elapsedTime, 0, totalQuestions, false);
    }, 500);

    return () => window.clearTimeout(saveDraftTimer);
  }, [lesson.id, selectedAnswers, isGraded, totalQuestions]);

  useEffect(() => {
    if (isGraded) return;

    const saveTimeTimer = window.setInterval(() => {
      onSaveProgress(lesson.id, selectedAnswers, elapsedTimeRef.current, 0, totalQuestions, false);
    }, 10000);

    return () => window.clearInterval(saveTimeTimer);
  }, [lesson.id, selectedAnswers, isGraded, totalQuestions]);

  const handleSelectOption = (qNum: number, label: string) => {
    if (isGraded) return;
    setSelectedAnswers((prev) => ({
      ...prev,
      [qNum]: label
    }));
  };

  const handleToggleFlag = (qNum: number) => {
    if (isGraded) return;
    setQuestionStates((prev) => ({
      ...prev,
      [qNum]: {
        selectedOption: selectedAnswers[qNum] || '',
        isFlagged: !prev[qNum]?.isFlagged
      }
    }));
  };

  // Click to scroll to blank card
  const handleScrollToQuestion = (qNum: number) => {
    // Determine which tab the question belongs to
    const isListeningQ = lesson.listening.some((g) => g.questions.some((q) => q.num === qNum));
    const isReadingQ = lesson.reading.some((g) => g.questions.some((q) => q.num === qNum));

    if (isListeningQ && activeTab !== 'listening') {
      setActiveTab('listening');
    } else if (isReadingQ && activeTab !== 'reading') {
      setActiveTab('reading');
    }

    // Scroll to the card after tab switch
    setTimeout(() => {
      const el = document.getElementById(`question-card-${qNum}`);
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        // Flash effect
        el.style.borderColor = 'hsl(var(--primary))';
        setTimeout(() => {
          el.style.borderColor = '';
        }, 1500);
      }
    }, 100);
  };

  // Sync details with the Sidebar's Question Navigator Grid
  useEffect(() => {
    // Gather all question numbers
    const listeningQNums = lesson.listening.flatMap((g) => g.questions.map((q) => q.num));
    const readingQNums = lesson.reading.flatMap((g) => g.questions.map((q) => q.num));
    const allQNums = [...listeningQNums, ...readingQNums].sort((a, b) => a - b);

    const answered = Object.keys(selectedAnswers).map(Number);
    const flagged = Object.keys(questionStates)
      .map(Number)
      .filter((num) => questionStates[num]?.isFlagged);

    onQuestionNavConfig(
      allQNums,
      answered,
      flagged,
      isGraded,
      gradedResults,
      handleScrollToQuestion
    );
  }, [lesson.id, selectedAnswers, questionStates, isGraded, activeTab]);

  const handleGradeTest = () => {
    if (isGraded) return;
    setIsGraded(true);
    
    // Calculate stats
    const results = getGradedResults();
    const finalScore = Object.values(results).filter(Boolean).length;
    
    onSaveProgress(lesson.id, selectedAnswers, elapsedTime, finalScore, totalQuestions, true);
  };

  const handleResetTest = () => {
    if (window.confirm('Are you sure you want to reset your answers and retake this lesson practice?')) {
      setSelectedAnswers({});
      setQuestionStates({});
      setIsGraded(false);
      setElapsedTime(0);
      onSaveProgress(lesson.id, {}, 0, 0, totalQuestions, false);
    }
  };

  const formatTime = (seconds: number) => {
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    return `${hrs > 0 ? hrs + ':' : ''}${mins < 10 && hrs > 0 ? '0' : ''}${mins}:${secs < 10 ? '0' : ''}${secs}`;
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', width: '100%' }}>
      {/* Sticky Audio Player for Listening sections */}
      <AudioPlayer src={`/${lesson.audio}`} />

      {/* Lesson Heading and Tab Swtiching */}
      <div style={{ padding: '24px 24px 0 24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <h1 style={{ fontSize: '1.8rem', fontWeight: 800, fontFamily: 'var(--font-title)' }}>
            {lesson.title}
          </h1>
          <span style={{ fontSize: '0.85rem', color: 'hsl(var(--text-muted))' }}>
            Practicing 15 Listening questions & 16 Reading questions
          </span>
        </div>

        {/* Tab switch bar */}
        <div style={{ display: 'flex', border: '1px solid hsl(var(--panel-border))', borderRadius: '8px', padding: '4px', background: 'hsl(var(--panel-bg) / 0.3)' }}>
          <button
            className="secondary-btn"
            style={{
              padding: '8px 16px',
              border: 'none',
              borderRadius: '6px',
              background: activeTab === 'listening' ? 'hsl(var(--primary))' : 'transparent',
              color: activeTab === 'listening' ? '#000' : 'hsl(var(--text-secondary))',
              display: 'flex',
              alignItems: 'center',
              gap: '8px'
            }}
            onClick={() => setActiveTab('listening')}
          >
            <Headphones size={16} />
            <span>Listening</span>
          </button>
          <button
            className="secondary-btn"
            style={{
              padding: '8px 16px',
              border: 'none',
              borderRadius: '6px',
              background: activeTab === 'reading' ? 'hsl(var(--primary))' : 'transparent',
              color: activeTab === 'reading' ? '#000' : 'hsl(var(--text-secondary))',
              display: 'flex',
              alignItems: 'center',
              gap: '8px'
            }}
            onClick={() => setActiveTab('reading')}
          >
            <BookOpen size={16} />
            <span>Reading</span>
          </button>
        </div>
      </div>

      {/* Main Workspace content */}
      <div style={{ flex: 1, padding: '24px', overflowY: 'auto' }}>
        {activeTab === 'listening' ? (
          <ListeningWorkspace
            lessonId={lesson.id}
            listeningGroups={lesson.listening}
            selectedAnswers={selectedAnswers}
            questionStates={questionStates}
            isGraded={isGraded}
            onSelectOption={handleSelectOption}
            onToggleFlag={handleToggleFlag}
          />
        ) : (
          <div className="reading-grid-layout" style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '32px', maxWidth: '1400px', margin: '0 auto', width: '100%', alignItems: 'start' }}>
            {/* Left side: Reading Passages */}
            <div className="reading-passage-sticky" style={{ position: 'sticky', top: '0', maxHeight: 'calc(100vh - 200px)', overflowY: 'auto', paddingRight: '8px' }}>
              <h2 style={{ fontSize: '1.4rem', fontWeight: 700, marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <BookOpen className="text-sky-400" size={22} />
                Part 6-7: Reading Comprehension
              </h2>
              {lesson.reading.map((group) => (
                <div key={group.id} style={{ marginBottom: '32px' }}>
                  <div style={{ fontSize: '0.9rem', color: 'hsl(var(--text-muted))', marginBottom: '8px', fontWeight: 600 }}>
                    Passage for Questions {group.range}
                  </div>
                  <ReadingPassage
                    originalPassage={group.originalPassage}
                    completedPassage={group.completedPassage}
                    questions={group.questions}
                    selectedAnswers={selectedAnswers}
                    isGraded={isGraded}
                    onBlankClick={handleScrollToQuestion}
                  />

                  {/* Vocabulary & Key takeaways: reveal after grading */}
                  {isGraded && (
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.2fr', gap: '16px', marginTop: '16px' }}>
                      <div className="glass-panel" style={{ padding: '16px', fontSize: '0.85rem' }}>
                        <h4 style={{ color: 'hsl(var(--primary))', marginBottom: '10px', fontWeight: 600 }}>💡 Key Takeaways</h4>
                        <ul style={{ paddingLeft: '16px', color: 'hsl(var(--text-secondary))' }}>
                          {group.takeaways.map((takeaway, idx) => (
                            <li key={idx} style={{ marginBottom: '6px' }}>{takeaway}</li>
                          ))}
                        </ul>
                      </div>

                      <div className="glass-panel" style={{ padding: '16px', fontSize: '0.85rem' }}>
                        <h4 style={{ color: 'hsl(var(--primary))', marginBottom: '10px', fontWeight: 600 }}>📝 Vocabulary & Analysis</h4>
                        <ul style={{ listStyle: 'none', display: 'flex', flexDirection: 'column', gap: '6px', color: 'hsl(var(--text-secondary))' }}>
                          {group.vocabulary.map((vocab, idx) => (
                            <li key={idx} style={{ borderBottom: '1px solid hsl(var(--panel-border) / 0.3)', paddingBottom: '4px' }}>
                              {vocab}
                            </li>
                          ))}
                        </ul>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>

            {/* Right side: Questions list */}
            <div style={{ paddingBottom: '100px' }}>
              <div style={{ fontSize: '0.9rem', color: 'hsl(var(--text-muted))', marginBottom: '16px', fontWeight: 600 }}>
                Answer Sheets
              </div>
              {lesson.reading.map((group) => (
                <div key={group.id} style={{ marginBottom: '24px' }}>
                  {group.questions.map((q) => (
                    <QuestionBlock
                      key={q.num}
                      num={q.num}
                      options={q.options}
                      explanation={q.explanation || 'Refer to the vocabulary notes for translations.'}
                      selectedOption={selectedAnswers[q.num] || ''}
                      isFlagged={!!questionStates[q.num]?.isFlagged}
                      isGraded={isGraded}
                      onSelect={(label) => handleSelectOption(q.num, label)}
                      onToggleFlag={() => handleToggleFlag(q.num)}
                    />
                  ))}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Control Banner */}
      <div className="control-banner">
        <div style={{ display: 'flex', alignItems: 'center', gap: '24px' }}>
          <div className="timer-box">
            <div className={isGraded ? '' : 'timer-pulse'} />
            <Clock size={16} />
            <span>Time: {formatTime(elapsedTime)}</span>
          </div>

          {isGraded && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', background: 'rgba(16, 185, 129, 0.1)', padding: '6px 12px', borderRadius: '6px', border: '1px solid hsl(var(--success) / 0.2)' }}>
              <Award size={16} className="text-emerald-500" />
              <span style={{ fontWeight: 600, color: 'hsl(var(--success))' }}>
                Score: {score} / {totalQuestions} ({Math.round((score / totalQuestions) * 100)}%)
              </span>
            </div>
          )}
        </div>

        <div style={{ display: 'flex', gap: '12px' }}>
          {isGraded ? (
            <button className="secondary-btn" style={{ display: 'flex', alignItems: 'center', gap: '8px' }} onClick={handleResetTest}>
              <RotateCcw size={16} />
              <span>Reset & Retake</span>
            </button>
          ) : (
            <>
              {/* Check if not all questions answered to alert user */}
              <button
                className="primary-btn"
                style={{
                  background: Object.keys(selectedAnswers).length < totalQuestions ? 'hsl(var(--warning))' : 'hsl(var(--primary))'
                }}
                onClick={handleGradeTest}
              >
                {Object.keys(selectedAnswers).length < totalQuestions ? (
                  <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <AlertTriangle size={16} />
                    <span>Grade Test ({Object.keys(selectedAnswers).length}/{totalQuestions} Done)</span>
                  </span>
                ) : (
                  <span>Grade & Submit Test</span>
                )}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
