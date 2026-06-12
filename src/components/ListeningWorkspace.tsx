import React, { useEffect, useState } from 'react';
import { AudioControlState, AudioSegment, ListeningGroup, QuestionState, VocabularyItem } from '../types';
import { QuestionBlock } from './QuestionBlock';
import { ChevronDown, Headphones, Lock, Play, Repeat, RotateCcw, SlidersHorizontal, Unlock } from 'lucide-react';

interface ListeningWorkspaceProps {
  listeningGroups: ListeningGroup[];
  graphics?: { [qNum: number]: string };
  selectedAnswers: { [qNum: number]: string };
  questionStates: { [qNum: number]: QuestionState };
  isGraded: boolean;
  mode: 'study' | 'practice' | 'review';
  audioControl: AudioControlState | null;
  audioSegments: AudioSegment[];
  onSelectOption: (qNum: number, label: string) => void;
  onToggleFlag: (qNum: number) => void;
  onUpdateAudioSegment: (segmentId: string, updates: Partial<Pick<AudioSegment, 'start' | 'end'>>) => void;
  onResetAudioSegment: (segmentId: string) => void;
  customVocabItems?: VocabularyItem[];
  onSaveCustomVocab?: (item: VocabularyItem) => void;
  lessonId?: string;
  lessonTitle?: string;
  onPlaySegment?: (segmentLabel: string, isLoop: boolean) => void;
}

const formatTime = (seconds: number) => {
  const safeSeconds = Math.max(0, Math.round(Number.isFinite(seconds) ? seconds : 0));
  const minutes = Math.floor(safeSeconds / 60);
  const remainingSeconds = safeSeconds % 60;
  return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
};

const parseTimeInput = (value: string) => {
  const trimmed = value.trim();
  if (!trimmed) return 0;

  if (trimmed.includes(':')) {
    const [minutes = '0', seconds = '0'] = trimmed.split(':');
    return (Number(minutes) * 60) + Number(seconds);
  }

  return Number(trimmed);
};

const isValidTimeFormat = (value: string) => {
  const trimmed = value.trim();
  if (!trimmed) return false;
  if (trimmed.includes(':')) {
    const parts = trimmed.split(':');
    if (parts.length !== 2) return false;
    const [mins, secs] = parts;
    const nM = Number(mins);
    const nS = Number(secs);
    return !isNaN(nM) && !isNaN(nS) && nM >= 0 && nS >= 0 && nS < 60;
  }
  const n = Number(trimmed);
  return !isNaN(n) && n >= 0;
};

interface AudioSegmentControlsProps {
  segment?: AudioSegment;
  audioControl: AudioControlState | null;
  onUpdateAudioSegment: (segmentId: string, updates: Partial<Pick<AudioSegment, 'start' | 'end'>>) => void;
  onResetAudioSegment: (segmentId: string) => void;
  onPlaySegment?: (segmentLabel: string, isLoop: boolean) => void;
}

const AudioSegmentControls: React.FC<AudioSegmentControlsProps> = ({
  segment,
  audioControl,
  onUpdateAudioSegment,
  onResetAudioSegment,
  onPlaySegment
}) => {
  const [isEditing, setIsEditing] = useState(false);
  const [startValue, setStartValue] = useState('0:00');
  const [endValue, setEndValue] = useState('0:00');

  useEffect(() => {
    if (!segment) return;
    setStartValue(formatTime(segment.start));
    setEndValue(formatTime(segment.end));
  }, [segment]);

  const isActive = segment ? audioControl?.activeSegmentId === segment.id : false;
  const isLooping = isActive && audioControl?.isLoopingSegment;
  const canControlAudio = !!audioControl?.isReady;

  const startRef = React.useRef(startValue);
  const endRef = React.useRef(endValue);
  const segmentRef = React.useRef(segment);
  const audioRef = React.useRef(audioControl);
  const activeRef = React.useRef(isActive);
  const loopRef = React.useRef(isLooping);
  const onPlaySegmentRef = React.useRef(onPlaySegment);

  useEffect(() => {
    startRef.current = startValue;
    endRef.current = endValue;
    segmentRef.current = segment;
    audioRef.current = audioControl;
    activeRef.current = isActive;
    loopRef.current = isLooping;
    onPlaySegmentRef.current = onPlaySegment;
  });

  useEffect(() => {
    if (!isEditing || !segment) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      const isInput = document.activeElement?.tagName === 'INPUT' || document.activeElement?.tagName === 'TEXTAREA';

      if (e.key === 'Enter') {
        e.preventDefault();
        const nextStart = parseTimeInput(startRef.current);
        const nextEnd = parseTimeInput(endRef.current);
        if (Number.isFinite(nextStart) && Number.isFinite(nextEnd) && segmentRef.current) {
          onUpdateAudioSegment(segmentRef.current.id, { start: nextStart, end: nextEnd });
          setIsEditing(false);
        }
      } else if (e.key === 'Escape') {
        e.preventDefault();
        setIsEditing(false);
      } else if (!isInput) {
        if (e.key === '[') {
          e.preventDefault();
          setStartValue(formatTime(audioRef.current?.currentTime || 0));
        } else if (e.key === ']') {
          e.preventDefault();
          setEndValue(formatTime(audioRef.current?.currentTime || 0));
        } else if (e.key.toLowerCase() === 'l') {
          e.preventDefault();
          if (audioRef.current?.isReady && segmentRef.current) {
            if (loopRef.current) {
              audioRef.current.stopSegment();
            } else {
              audioRef.current.playSegment(segmentRef.current, true);
              onPlaySegmentRef.current?.(segmentRef.current.label, true);
            }
          }
        } else if (e.key === ' ') {
          e.preventDefault();
          if (audioRef.current?.isReady && segmentRef.current) {
            if (activeRef.current && audioRef.current.isPlaying) {
              audioRef.current.stopSegment();
            } else {
              audioRef.current.playSegment(segmentRef.current, false);
              onPlaySegmentRef.current?.(segmentRef.current.label, false);
            }
          }
        } else if (e.key === 'ArrowLeft') {
          e.preventDefault();
          if (audioRef.current) {
            const seekAmt = e.shiftKey ? 5 : 2;
            audioRef.current.seekTo(Math.max(0, audioRef.current.currentTime - seekAmt));
          }
        } else if (e.key === 'ArrowRight') {
          e.preventDefault();
          if (audioRef.current) {
            const seekAmt = e.shiftKey ? 5 : 2;
            audioRef.current.seekTo(Math.min(audioRef.current.duration, audioRef.current.currentTime + seekAmt));
          }
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isEditing, segment]);

  if (!segment) {
    return (
      <div className="audio-segment-row audio-segment-empty">
        Audio segment loading
      </div>
    );
  }

  const handleSave = () => {
    const nextStart = parseTimeInput(startValue);
    const nextEnd = parseTimeInput(endValue);

    if (!Number.isFinite(nextStart) || !Number.isFinite(nextEnd)) return;
    onUpdateAudioSegment(segment.id, { start: nextStart, end: nextEnd });
    setIsEditing(false);
  };

  const setCurrentAsStart = () => {
    setStartValue(formatTime(audioControl?.currentTime || 0));
  };

  const setCurrentAsEnd = () => {
    setEndValue(formatTime(audioControl?.currentTime || 0));
  };

  const isStartValid = isValidTimeFormat(startValue);
  const isEndValid = isValidTimeFormat(endValue);
  const areTimesChronological = isStartValid && isEndValid && parseTimeInput(startValue) < parseTimeInput(endValue);

  return (
    <div className={`audio-segment-row ${isActive ? 'is-active' : ''}`}>
      <div className="audio-segment-main">
        <div className="audio-segment-label">
          <span>{segment.label}</span>
          <small>
            {formatTime(segment.start)} - {formatTime(segment.end)}
            {segment.isCustom ? ' custom' : segment.isPreset ? ' preset' : ''}
          </small>
        </div>
        <div className="audio-segment-actions">
          <button
            className="audio-segment-btn"
            type="button"
            disabled={!canControlAudio}
            onClick={() => {
              audioControl?.playSegment(segment);
              onPlaySegment?.(segment.label, false);
            }}
            title={`Play ${segment.label}`}
          >
            <Play size={14} />
            <span>Play</span>
          </button>
          <button
            className={`audio-segment-btn ${isLooping ? 'active' : ''}`}
            type="button"
            disabled={!canControlAudio}
            onClick={() => {
              if (isLooping) {
                audioControl?.stopSegment();
              } else {
                audioControl?.playSegment(segment, true);
                onPlaySegment?.(segment.label, true);
              }
            }}
            title={`Loop ${segment.label}`}
          >
            <Repeat size={14} />
            <span>Loop</span>
          </button>
          <button
            className={`audio-segment-btn ${isEditing ? 'active' : ''}`}
            type="button"
            onClick={() => setIsEditing((value) => !value)}
            title="Edit segment time"
          >
            <SlidersHorizontal size={15} />
          </button>
        </div>
      </div>

      {isEditing && (
        <div className="audio-segment-editor">
          <label>
            <span>Start</span>
            <input
              className="audio-segment-input"
              value={startValue}
              onChange={(event) => setStartValue(event.target.value)}
              inputMode="numeric"
              style={(!isStartValid || !areTimesChronological) ? { borderColor: 'hsl(var(--danger))', boxShadow: '0 0 0 1px hsl(var(--danger) / 0.2)' } : undefined}
            />
          </label>
          <label>
            <span>End</span>
            <input
              className="audio-segment-input"
              value={endValue}
              onChange={(event) => setEndValue(event.target.value)}
              inputMode="numeric"
              style={(!isEndValid || !areTimesChronological) ? { borderColor: 'hsl(var(--danger))', boxShadow: '0 0 0 1px hsl(var(--danger) / 0.2)' } : undefined}
            />
          </label>
          <button className="audio-segment-btn subtle" type="button" onClick={setCurrentAsStart}>
            Set start
          </button>
          <button className="audio-segment-btn subtle" type="button" onClick={setCurrentAsEnd}>
            Set end
          </button>
          <button className="audio-segment-btn" type="button" onClick={handleSave}>
            Save
          </button>
          <button
            className="audio-segment-btn icon-only subtle"
            type="button"
            onClick={() => onResetAudioSegment(segment.id)}
            title="Reset segment"
          >
            <RotateCcw size={14} />
          </button>
          
          <div className="audio-segment-shortcuts-legend">
            <div className="audio-segment-shortcuts-title">Keyboard Shortcuts (Editor Active):</div>
            <div className="audio-segment-shortcuts-grid">
              <div className="audio-segment-shortcuts-item">
                <kbd className="shortcut-kbd">[</kbd> <kbd className="shortcut-kbd">]</kbd>
                <span>Set Start/End</span>
              </div>
              <div className="audio-segment-shortcuts-item">
                <kbd className="shortcut-kbd">Space</kbd>
                <span>Play/Pause</span>
              </div>
              <div className="audio-segment-shortcuts-item">
                <kbd className="shortcut-kbd">L</kbd>
                <span>Toggle Loop</span>
              </div>
              <div className="audio-segment-shortcuts-item">
                <kbd className="shortcut-kbd">←</kbd> <kbd className="shortcut-kbd">→</kbd>
                <span>Seek 2s (<kbd className="shortcut-kbd">Shift</kbd>: 5s)</span>
              </div>
              <div className="audio-segment-shortcuts-item">
                <kbd className="shortcut-kbd">Enter</kbd>
                <span>Save</span>
              </div>
              <div className="audio-segment-shortcuts-item">
                <kbd className="shortcut-kbd">Esc</kbd>
                <span>Cancel</span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

interface AudioSegmentManagerRowProps {
  segment: AudioSegment;
  audioControl: AudioControlState | null;
  onUpdateAudioSegment: (segmentId: string, updates: Partial<Pick<AudioSegment, 'start' | 'end'>>) => void;
  onResetAudioSegment: (segmentId: string) => void;
  onPlaySegment?: (segmentLabel: string, isLoop: boolean) => void;
}

const AudioSegmentManagerRow: React.FC<AudioSegmentManagerRowProps> = ({
  segment,
  audioControl,
  onUpdateAudioSegment,
  onResetAudioSegment,
  onPlaySegment
}) => {
  const [startValue, setStartValue] = useState(formatTime(segment.start));
  const [endValue, setEndValue] = useState(formatTime(segment.end));

  useEffect(() => {
    setStartValue(formatTime(segment.start));
    setEndValue(formatTime(segment.end));
  }, [segment]);

  const isActive = audioControl?.activeSegmentId === segment.id;
  const isLooping = isActive && audioControl?.isLoopingSegment;
  const canControlAudio = !!audioControl?.isReady;

  const handleSave = () => {
    const nextStart = parseTimeInput(startValue);
    const nextEnd = parseTimeInput(endValue);

    if (!Number.isFinite(nextStart) || !Number.isFinite(nextEnd)) return;
    onUpdateAudioSegment(segment.id, { start: nextStart, end: nextEnd });
  };

  const isStartValid = isValidTimeFormat(startValue);
  const isEndValid = isValidTimeFormat(endValue);
  const areTimesChronological = isStartValid && isEndValid && parseTimeInput(startValue) < parseTimeInput(endValue);

  return (
    <div className={`audio-segment-manager-row ${isActive ? 'is-active' : ''}`}>
      <div className="audio-segment-manager-label">
        <strong>{segment.label}</strong>
        <span>
          {segment.isCustom ? 'custom' : segment.isPreset ? 'preset' : 'auto'}
        </span>
      </div>
      <div className="audio-segment-manager-fields">
        <label>
          <span>Start</span>
          <input
            className="audio-segment-input"
            value={startValue}
            onChange={(event) => setStartValue(event.target.value)}
            inputMode="numeric"
            style={(!isStartValid || !areTimesChronological) ? { borderColor: 'hsl(var(--danger))', boxShadow: '0 0 0 1px hsl(var(--danger) / 0.2)' } : undefined}
          />
        </label>
        <label>
          <span>End</span>
          <input
            className="audio-segment-input"
            value={endValue}
            onChange={(event) => setEndValue(event.target.value)}
            inputMode="numeric"
            style={(!isEndValid || !areTimesChronological) ? { borderColor: 'hsl(var(--danger))', boxShadow: '0 0 0 1px hsl(var(--danger) / 0.2)' } : undefined}
          />
        </label>
      </div>
      <div className="audio-segment-manager-actions">
        <button
          className="audio-segment-btn icon-only"
          type="button"
          disabled={!canControlAudio}
          onClick={() => {
            audioControl?.playSegment(segment);
            onPlaySegment?.(segment.label, false);
          }}
          title={`Play ${segment.label}`}
        >
          <Play size={14} />
        </button>
        <button
          className={`audio-segment-btn icon-only ${isLooping ? 'active' : ''}`}
          type="button"
          disabled={!canControlAudio}
          onClick={() => {
            if (isLooping) {
              audioControl?.stopSegment();
            } else {
              audioControl?.playSegment(segment, true);
              onPlaySegment?.(segment.label, true);
            }
          }}
          title={`Loop ${segment.label}`}
        >
          <Repeat size={14} />
        </button>
        <button className="audio-segment-btn subtle" type="button" onClick={() => setStartValue(formatTime(audioControl?.currentTime || 0))}>
          Start
        </button>
        <button className="audio-segment-btn subtle" type="button" onClick={() => setEndValue(formatTime(audioControl?.currentTime || 0))}>
          End
        </button>
        <button className="audio-segment-btn" type="button" onClick={handleSave}>
          Save
        </button>
        <button
          className="audio-segment-btn icon-only subtle"
          type="button"
          onClick={() => onResetAudioSegment(segment.id)}
          title={`Reset ${segment.label}`}
        >
          <RotateCcw size={14} />
        </button>
      </div>
    </div>
  );
};

interface AudioSegmentManagerProps {
  segments: AudioSegment[];
  audioControl: AudioControlState | null;
  onUpdateAudioSegment: (segmentId: string, updates: Partial<Pick<AudioSegment, 'start' | 'end'>>) => void;
  onResetAudioSegment: (segmentId: string) => void;
  onPlaySegment?: (segmentLabel: string, isLoop: boolean) => void;
}

const AudioSegmentManager: React.FC<AudioSegmentManagerProps> = ({
  segments,
  audioControl,
  onUpdateAudioSegment,
  onResetAudioSegment,
  onPlaySegment
}) => {
  const [isOpen, setIsOpen] = useState(false);

  if (!segments.length) {
    return null;
  }

  return (
    <div className={`audio-segment-manager ${isOpen ? 'is-open' : ''}`}>
      <button
        className="audio-segment-manager-toggle"
        type="button"
        onClick={() => setIsOpen((value) => !value)}
        aria-expanded={isOpen}
      >
        <SlidersHorizontal size={16} />
        <span>Segments</span>
        <small>{segments.length}</small>
        <ChevronDown size={16} />
      </button>

      {isOpen && (
        <div className="audio-segment-manager-panel">
          <div className="audio-segment-manager-summary">
            <span>Current {formatTime(audioControl?.currentTime || 0)}</span>
            <span>{audioControl?.isReady ? 'Audio ready' : 'Audio loading'}</span>
          </div>
          <div className="audio-segment-manager-list">
            {segments.map((segment) => (
              <AudioSegmentManagerRow
                key={segment.id}
                segment={segment}
                audioControl={audioControl}
                onUpdateAudioSegment={onUpdateAudioSegment}
                onResetAudioSegment={onResetAudioSegment}
                onPlaySegment={onPlaySegment}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

const GraphicImage: React.FC<{ src: string; qNum: number }> = ({ src, qNum }) => {
  return (
    <div style={{ margin: '20px 0', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
      <img
        src={`/${src}`}
        alt={`Graphic for Question ${qNum}`}
        style={{
          maxWidth: '100%',
          maxHeight: '300px',
          borderRadius: '12px',
          border: '1px solid hsl(var(--panel-border))',
          boxShadow: '0 4px 20px rgba(0, 0, 0, 0.2)'
        }}
      />
      <span style={{ fontSize: '0.8rem', color: 'hsl(var(--text-muted))', marginTop: '8px', fontStyle: 'italic' }}>
        Graphic for Question {qNum}
      </span>
    </div>
  );
};

export const ListeningWorkspace: React.FC<ListeningWorkspaceProps> = ({
  listeningGroups,
  graphics = {},
  selectedAnswers,
  questionStates,
  isGraded,
  mode,
  audioControl,
  audioSegments,
  onSelectOption,
  onToggleFlag,
  onUpdateAudioSegment,
  onResetAudioSegment,
  customVocabItems = [],
  onSaveCustomVocab,
  lessonId,
  lessonTitle,
  onPlaySegment
}) => {
  const showTranscript = isGraded || mode === 'study';
  const [showTranslations, setShowTranslations] = useState(true);

  // Popover state for double-click word lookup
  const [popover, setPopover] = useState<{
    visible: boolean;
    x: number;
    y: number;
    text: string;
  }>({ visible: false, x: 0, y: 0, text: '' });
  const [saveDefinition, setSaveDefinition] = useState('');

  const handleMouseUp = (e: React.MouseEvent<HTMLDivElement>) => {
    const selection = window.getSelection();
    if (!selection) return;
    const text = selection.toString().trim();
    if (text.length > 0 && text.length < 50) {
      try {
        const range = selection.getRangeAt(0);
        const rect = range.getBoundingClientRect();
        const parentRect = e.currentTarget.getBoundingClientRect();
        setPopover({
          visible: true,
          x: rect.left + rect.width / 2 - parentRect.left,
          y: rect.top - parentRect.top - 10,
          text: text
        });
      } catch (err) {
        console.error(err);
      }
    }
  };

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      const popoverEl = document.getElementById('selection-popover');
      if (popoverEl && !popoverEl.contains(e.target as Node)) {
        setPopover((prev) => ({ ...prev, visible: false }));
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const foundDefinition = React.useMemo(() => {
    if (!popover.text) return null;
    const cleanWord = popover.text.toLowerCase().trim().replace(/[.,\/#!$%\^&\*;:{}=\-_`~()?]/g, '');
    const match = customVocabItems.find((x) => x.term.toLowerCase() === cleanWord);
    return match ? `Custom definition: ${match.definition}` : null;
  }, [popover.text, customVocabItems]);

  const handleSaveToTrainer = () => {
    if (!popover.text || !saveDefinition.trim()) return;

    const newItem: VocabularyItem = {
      id: `custom-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      term: popover.text.trim(),
      definition: saveDefinition.trim(),
      lessonId: lessonId || '',
      lessonTitle: lessonTitle || ''
    };

    onSaveCustomVocab?.(newItem);
    setSaveDefinition('');
    setPopover((prev) => ({ ...prev, visible: false }));
    window.getSelection()?.removeAllRanges();
  };

  return (
    <div className="listening-workspace-root" style={{ padding: '24px', maxWidth: '850px', margin: '0 auto', width: '100%' }}>
      <div className="listening-section-title" style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '24px' }}>
        <Headphones className="text-sky-400" size={24} />
        <h2 style={{ fontSize: '1.5rem', fontWeight: 700 }}>Part 3: Listening Comprehension</h2>
      </div>

      <AudioSegmentManager
        segments={audioSegments}
        audioControl={audioControl}
        onUpdateAudioSegment={onUpdateAudioSegment}
        onResetAudioSegment={onResetAudioSegment}
        onPlaySegment={onPlaySegment}
      />

      {listeningGroups.map((group) => (
        <div
          key={group.id}
          style={{
            marginBottom: '48px',
            borderBottom: '1px solid hsl(var(--panel-border))',
            paddingBottom: '32px'
          }}
        >
          {/* Group Header */}
          <div
            className="listening-group-header"
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: '20px',
              background: 'hsl(var(--panel-bg) / 0.2)',
              padding: '12px 16px',
              borderRadius: '8px',
              border: '1px solid hsl(var(--panel-border))'
            }}
          >
            <h3 style={{ fontSize: '1.1rem', fontWeight: 600 }}>
              Questions {group.range}
            </h3>
            <span style={{ fontSize: '0.8rem', color: 'hsl(var(--text-muted))' }}>
              Select options as you listen
            </span>
          </div>

          <AudioSegmentControls
            segment={audioSegments.find((segment) => segment.groupId === group.id)}
            audioControl={audioControl}
            onUpdateAudioSegment={onUpdateAudioSegment}
            onResetAudioSegment={onResetAudioSegment}
            onPlaySegment={onPlaySegment}
          />

          {/* Transcript Panel: Locked during test, revealed after grading */}
          <div
            className="glass-panel"
            style={{
              padding: '24px',
              marginBottom: '24px',
              background: showTranscript ? 'hsl(var(--panel-bg) / 0.5)' : 'hsl(var(--panel-bg) / 0.25)',
              borderStyle: showTranscript ? 'solid' : 'dashed',
              position: 'relative'
            }}
            onMouseUp={handleMouseUp}
          >
            {showTranscript ? (
              <div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px', flexWrap: 'wrap', gap: '10px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'hsl(var(--success))', fontWeight: 600, fontSize: '0.9rem' }}>
                    <Unlock size={16} />
                    <span>{mode === 'study' ? 'Study transcript' : 'Audio Transcript unlocked'}</span>
                  </div>
                  
                  <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.8rem', color: 'hsl(var(--text-secondary))', cursor: 'pointer', userSelect: 'none' }}>
                    <input
                      type="checkbox"
                      checked={showTranslations}
                      onChange={(e) => setShowTranslations(e.target.checked)}
                      style={{ cursor: 'pointer' }}
                    />
                    <span>Show translations</span>
                  </label>
                </div>
                
                {group.transcript.map((line, idx) => (
                  <div key={idx} className="dialogue-item">
                    <span className={`speaker-badge bg-${line.speaker.toLowerCase()}`}>
                      {line.speaker}
                    </span>
                    <div className="dialogue-copy">
                      <p className="dialogue-text">{line.text}</p>
                      {line.translation && showTranslations && (
                        <p className="dialogue-translation">{line.translation}</p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '20px 0', color: 'hsl(var(--text-muted))' }}>
                <Lock size={24} style={{ marginBottom: '12px' }} />
                <h4 style={{ fontSize: '0.95rem', fontWeight: 600, color: 'hsl(var(--text-secondary))', marginBottom: '4px' }}>
                  Transcript Locked
                </h4>
                <p style={{ fontSize: '0.8rem', textAlign: 'center' }}>
                  The transcript will be revealed once you grade your practice test.
                </p>
              </div>
            )}
          </div>

          {/* Questions */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {group.questions.map((q) => (
              <div key={q.num}>
                {graphics[q.num] && <GraphicImage src={graphics[q.num]} qNum={q.num} />}
                
                <QuestionBlock
                  num={q.num}
                  text={q.text}
                  options={q.options}
                  explanation={q.explanation}
                  selectedOption={selectedAnswers[q.num] || ''}
                  isFlagged={!!questionStates[q.num]?.isFlagged}
                  isGraded={isGraded || mode === 'study'}
                  onSelect={(label) => onSelectOption(q.num, label)}
                  onToggleFlag={() => onToggleFlag(q.num)}
                />
              </div>
            ))}
          </div>
        </div>
      ))}

      {/* Popover Menu */}
      {popover.visible && (
        <div
          id="selection-popover"
          className="selection-popover"
          style={{
            top: `${popover.y}px`,
            left: `${popover.x}px`,
            transform: 'translate(-50%, -100%)'
          }}
        >
          <div className="popover-lookup" style={{ border: 'none', padding: '4px' }}>
            <span className="popover-term">"{popover.text}"</span>
            {foundDefinition ? (
              <div className="popover-definition">{foundDefinition}</div>
            ) : (
              <span style={{ fontSize: '0.75rem', color: 'hsl(var(--text-muted))' }}>
                Not in glossary
              </span>
            )}

            <a
              href={`https://translate.google.com/?sl=en&tl=vi&text=${encodeURIComponent(popover.text)}&op=translate`}
              target="_blank"
              rel="noreferrer"
              className="popover-translate-link"
            >
              Google Translate ↗
            </a>

            <div className="popover-save-form" onKeyDown={(e) => e.stopPropagation()}>
              <input
                type="text"
                className="popover-save-input"
                placeholder="Definition / Nghĩa..."
                value={saveDefinition}
                onChange={(e) => setSaveDefinition(e.target.value)}
              />
              <button
                className="popover-save-btn"
                onClick={handleSaveToTrainer}
              >
                Save
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
