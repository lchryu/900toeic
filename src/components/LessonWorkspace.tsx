import React, { useState, useEffect, useRef } from 'react';
import { LessonData, QuestionState, LessonProgress } from '../types';
import { AudioPlayer } from './AudioPlayer';
import { ListeningWorkspace } from './ListeningWorkspace';
import { ReadingPassage } from './ReadingPassage';
import { QuestionBlock } from './QuestionBlock';
import { Headphones, BookOpen, Clock, Award, RotateCcw, AlertTriangle, GraduationCap, Pencil, Eye } from 'lucide-react';

type LessonTab = 'listening' | 'reading';
type LessonMode = 'study' | 'practice' | 'review';

interface LessonWorkspaceProps {
  lesson: LessonData;
  progress: LessonProgress | undefined;
  onSaveProgress: (
    lessonId: string,
    answers: { [qNum: number]: string },
    timeSpent: number,
    score: number,
    totalQuestions: number,
    isSubmitted?: boolean,
    metadata?: Partial<Pick<LessonProgress, 'flaggedQuestions' | 'lastTab' | 'mode'>>
  ) => void;
  onQuestionNavConfig: (qNums: number[], answered: number[], flagged: number[], isGraded: boolean, results: { [qNum: number]: boolean }, scrollCallback: (num: number) => void) => void;
}

export const LessonWorkspace: React.FC<LessonWorkspaceProps> = ({
  lesson,
  progress,
  onSaveProgress,
  onQuestionNavConfig
}) => {
  const [activeTab, setActiveTab] = useState<LessonTab>(progress?.lastTab || 'listening');
  const [mode, setMode] = useState<LessonMode>(
    progress?.mode || (progress?.isSubmitted ? 'review' : 'practice')
  );
  const [selectedAnswers, setSelectedAnswers] = useState<{ [qNum: number]: string }>(
    progress?.answers || {}
  );
  const [questionStates, setQuestionStates] = useState<{ [qNum: number]: QuestionState }>(() => {
    const flags = progress?.flaggedQuestions || [];
    return Object.fromEntries(flags.map((num) => [num, { selectedOption: progress?.answers?.[num] || '', isFlagged: true }]));
  });
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
    setActiveTab(progress?.lastTab || 'listening');
    setMode(progress?.mode || (progress?.isSubmitted ? 'review' : 'practice'));
    setIsGraded(!!(progress?.isSubmitted ?? (progress && progress.answers && Object.keys(progress.answers).length > 0)));
    setElapsedTime(progress?.timeSpent || 0);
    const flags = progress?.flaggedQuestions || [];
    setQuestionStates(Object.fromEntries(flags.map((num) => [num, { selectedOption: progress?.answers?.[num] || '', isFlagged: true }])));
  }, [lesson.id]);

  // Start timer if not graded
  useEffect(() => {
    if (!isGraded && mode === 'practice') {
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
  }, [isGraded, mode, lesson.id]);

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
    if (isGraded || mode !== 'practice') return;

    const saveDraftTimer = window.setTimeout(() => {
      persistProgressSnapshot(selectedAnswers, elapsedTime);
    }, 500);

    return () => window.clearTimeout(saveDraftTimer);
  }, [lesson.id, selectedAnswers, elapsedTime, isGraded, mode, totalQuestions]);

  useEffect(() => {
    if (isGraded || mode !== 'practice') return;

    const saveTimeTimer = window.setInterval(() => {
      persistProgressSnapshot(selectedAnswers, elapsedTimeRef.current);
    }, 10000);

    return () => window.clearInterval(saveTimeTimer);
  }, [lesson.id, selectedAnswers, isGraded, mode, totalQuestions]);

  const correctAnswers = [...lesson.listening, ...lesson.reading].reduce<{ [qNum: number]: string }>((acc, group) => {
    group.questions.forEach((q) => {
      const correctOpt = q.options.find((o) => o.correct);
      if (correctOpt) acc[q.num] = correctOpt.label;
    });
    return acc;
  }, {});

  const displayAnswers = mode === 'study' ? { ...selectedAnswers, ...correctAnswers } : selectedAnswers;
  const isPracticeActive = mode === 'practice' && !isGraded;

  const getFlaggedQuestions = (states = questionStates) =>
    Object.keys(states)
      .map(Number)
      .filter((num) => states[num]?.isFlagged);

  const persistProgressSnapshot = (
    nextAnswers = selectedAnswers,
    nextTime = elapsedTimeRef.current,
    nextMode = mode,
    nextTab = activeTab,
    nextFlags = getFlaggedQuestions()
  ) => {
    onSaveProgress(lesson.id, nextAnswers, nextTime, isGraded ? score : 0, totalQuestions, isGraded, {
      flaggedQuestions: nextFlags,
      lastTab: nextTab,
      mode: nextMode
    });
  };

  const handleSelectOption = (qNum: number, label: string) => {
    if (!isPracticeActive) return;
    setSelectedAnswers((prev) => {
      const nextAnswers = {
        ...prev,
        [qNum]: label
      };
      setQuestionStates((states) => ({
        ...states,
        [qNum]: {
          ...states[qNum],
          selectedOption: label,
          isFlagged: !!states[qNum]?.isFlagged
        }
      }));
      return nextAnswers;
    });
  };

  const handleToggleFlag = (qNum: number) => {
    if (!isPracticeActive) return;
    setQuestionStates((prev) => {
      const nextStates = {
        ...prev,
        [qNum]: {
          selectedOption: selectedAnswers[qNum] || '',
          isFlagged: !prev[qNum]?.isFlagged
        }
      };
      persistProgressSnapshot(selectedAnswers, elapsedTimeRef.current, mode, activeTab, getFlaggedQuestions(nextStates));
      return nextStates;
    });
  };

  const handleModeChange = (nextMode: LessonMode) => {
    if (nextMode === 'review' && !isGraded) return;
    setMode(nextMode);
    persistProgressSnapshot(selectedAnswers, elapsedTimeRef.current, nextMode, activeTab);
  };

  const handleTabChange = (nextTab: LessonTab) => {
    setActiveTab(nextTab);
    persistProgressSnapshot(selectedAnswers, elapsedTimeRef.current, mode, nextTab);
  };

  // Click to scroll to blank card
  const handleScrollToQuestion = (qNum: number) => {
    // Determine which tab the question belongs to
    const isListeningQ = lesson.listening.some((g) => g.questions.some((q) => q.num === qNum));
    const isReadingQ = lesson.reading.some((g) => g.questions.some((q) => q.num === qNum));

    if (isListeningQ && activeTab !== 'listening') {
      handleTabChange('listening');
    } else if (isReadingQ && activeTab !== 'reading') {
      handleTabChange('reading');
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
    const flagged = getFlaggedQuestions();

    onQuestionNavConfig(
      allQNums,
      answered,
      flagged,
      isGraded,
      gradedResults,
      handleScrollToQuestion
    );
  }, [lesson.id, selectedAnswers, questionStates, isGraded, activeTab, mode]);

  const handleGradeTest = () => {
    if (isGraded) return;
    setIsGraded(true);
    setMode('review');
    
    // Calculate stats
    const results = getGradedResults();
    const finalScore = Object.values(results).filter(Boolean).length;
    
    onSaveProgress(lesson.id, selectedAnswers, elapsedTime, finalScore, totalQuestions, true, {
      flaggedQuestions: getFlaggedQuestions(),
      lastTab: activeTab,
      mode: 'review'
    });
  };

  const handleResetTest = () => {
    if (window.confirm('Are you sure you want to reset your answers and retake this lesson practice?')) {
      setSelectedAnswers({});
      setQuestionStates({});
      setIsGraded(false);
      setMode('practice');
      setElapsedTime(0);
      onSaveProgress(lesson.id, {}, 0, 0, totalQuestions, false, {
        flaggedQuestions: [],
        lastTab: activeTab,
        mode: 'practice'
      });
    }
  };

  const formatTime = (seconds: number) => {
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    return `${hrs > 0 ? hrs + ':' : ''}${mins < 10 && hrs > 0 ? '0' : ''}${mins}:${secs < 10 ? '0' : ''}${secs}`;
  };

  const listeningQuestionCount = lesson.listening.reduce((sum, g) => sum + g.questions.length, 0);
  const readingQuestionCount = lesson.reading.reduce((sum, g) => sum + g.questions.length, 0);
  const modeOptions: Array<{ id: LessonMode; label: string; icon: React.ElementType; disabled?: boolean }> = [
    { id: 'study', label: 'Study', icon: GraduationCap },
    { id: 'practice', label: 'Practice', icon: Pencil, disabled: isGraded },
    { id: 'review', label: 'Review', icon: Eye, disabled: !isGraded }
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', width: '100%' }}>
      {/* Sticky Audio Player for Listening sections */}
      <AudioPlayer src={lesson.audio ? `/${lesson.audio}` : undefined} youtubeUrl={lesson.youtubeUrl} />

      {/* Lesson Heading and Tab Swtiching */}
      <div style={{ padding: '24px 24px 0 24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <h1 style={{ fontSize: '1.8rem', fontWeight: 800, fontFamily: 'var(--font-title)' }}>
            {lesson.title}
          </h1>
          <span style={{ fontSize: '0.85rem', color: 'hsl(var(--text-muted))' }}>
            {mode === 'study' ? 'Studying' : mode === 'review' ? 'Reviewing' : 'Practicing'} {listeningQuestionCount} Listening questions & {readingQuestionCount} Reading questions
          </span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
          <div className="segmented-control">
            {modeOptions.map(({ id, label, icon: Icon, disabled }) => (
              <button
                key={id}
                className={`segmented-btn ${mode === id ? 'active' : ''}`}
                onClick={() => handleModeChange(id)}
                disabled={disabled}
                title={disabled && id === 'review' ? 'Submit the practice first to review results' : `${label} mode`}
              >
                <Icon size={16} />
                <span>{label}</span>
              </button>
            ))}
          </div>

          {/* Tab switch bar */}
          <div className="segmented-control">
            <button
              className={`segmented-btn ${activeTab === 'listening' ? 'active' : ''}`}
              onClick={() => handleTabChange('listening')}
            >
              <Headphones size={16} />
              <span>Listening</span>
            </button>
            <button
              className={`segmented-btn ${activeTab === 'reading' ? 'active' : ''}`}
              onClick={() => handleTabChange('reading')}
            >
              <BookOpen size={16} />
              <span>Reading</span>
            </button>
          </div>
        </div>
      </div>

      {/* Main Workspace content */}
      <div style={{ flex: 1, padding: '24px', overflowY: 'auto' }}>
        {activeTab === 'listening' ? (
          <ListeningWorkspace
            listeningGroups={lesson.listening}
            graphics={lesson.graphics}
            selectedAnswers={displayAnswers}
            questionStates={questionStates}
            isGraded={isGraded}
            mode={mode}
            onSelectOption={handleSelectOption}
            onToggleFlag={handleToggleFlag}
          />
        ) : (
          <>
          <div className="reading-grid-layout reading-desktop-layout" style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '32px', maxWidth: '1400px', margin: '0 auto', width: '100%', alignItems: 'start' }}>
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
                    selectedAnswers={displayAnswers}
                    isGraded={isGraded}
                    mode={mode}
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
                      selectedOption={displayAnswers[q.num] || ''}
                      isFlagged={!!questionStates[q.num]?.isFlagged}
                      isGraded={isGraded || mode === 'study'}
                      onSelect={(label) => handleSelectOption(q.num, label)}
                      onToggleFlag={() => handleToggleFlag(q.num)}
                    />
                  ))}
                </div>
              ))}
            </div>
          </div>
          <div className="reading-mobile-layout">
            <h2 style={{ fontSize: '1.4rem', fontWeight: 700, marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <BookOpen className="text-sky-400" size={22} />
              Part 6-7: Reading Comprehension
            </h2>

            {lesson.reading.map((group) => (
              <section key={group.id} className="reading-mobile-group">
                <div className="reading-mobile-passage">
                  <div style={{ fontSize: '0.9rem', color: 'hsl(var(--text-muted))', marginBottom: '8px', fontWeight: 600 }}>
                    Passage for Questions {group.range}
                  </div>
                  <ReadingPassage
                    originalPassage={group.originalPassage}
                    completedPassage={group.completedPassage}
                    questions={group.questions}
                    selectedAnswers={displayAnswers}
                    isGraded={isGraded}
                    mode={mode}
                    onBlankClick={handleScrollToQuestion}
                  />
                </div>

                <div className="reading-mobile-questions">
                  <div style={{ fontSize: '0.9rem', color: 'hsl(var(--text-muted))', marginBottom: '12px', fontWeight: 600 }}>
                    Answer Sheet {group.range}
                  </div>
                  {group.questions.map((q) => (
                    <QuestionBlock
                      key={q.num}
                      num={q.num}
                      options={q.options}
                      explanation={q.explanation || 'Refer to the vocabulary notes for translations.'}
                      selectedOption={displayAnswers[q.num] || ''}
                      isFlagged={!!questionStates[q.num]?.isFlagged}
                      isGraded={isGraded || mode === 'study'}
                      onSelect={(label) => handleSelectOption(q.num, label)}
                      onToggleFlag={() => handleToggleFlag(q.num)}
                    />
                  ))}
                </div>

                {isGraded && (
                  <div className="reading-mobile-notes">
                    <div className="glass-panel" style={{ padding: '16px', fontSize: '0.85rem' }}>
                      <h4 style={{ color: 'hsl(var(--primary))', marginBottom: '10px', fontWeight: 600 }}>Key Takeaways</h4>
                      <ul style={{ paddingLeft: '16px', color: 'hsl(var(--text-secondary))' }}>
                        {group.takeaways.map((takeaway, idx) => (
                          <li key={idx} style={{ marginBottom: '6px' }}>{takeaway}</li>
                        ))}
                      </ul>
                    </div>

                    <div className="glass-panel" style={{ padding: '16px', fontSize: '0.85rem' }}>
                      <h4 style={{ color: 'hsl(var(--primary))', marginBottom: '10px', fontWeight: 600 }}>Vocabulary & Analysis</h4>
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
              </section>
            ))}
          </div>
          </>
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
          {mode === 'study' && !isGraded ? (
            <button className="primary-btn" style={{ display: 'flex', alignItems: 'center', gap: '8px' }} onClick={() => handleModeChange('practice')}>
              <Pencil size={16} />
              <span>Start Practice</span>
            </button>
          ) : isGraded ? (
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
