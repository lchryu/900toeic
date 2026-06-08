import React, { useEffect, useState } from 'react';
import { AudioControlState, AudioSegment, ListeningGroup, QuestionState } from '../types';
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

interface AudioSegmentControlsProps {
  segment?: AudioSegment;
  audioControl: AudioControlState | null;
  onUpdateAudioSegment: (segmentId: string, updates: Partial<Pick<AudioSegment, 'start' | 'end'>>) => void;
  onResetAudioSegment: (segmentId: string) => void;
}

const AudioSegmentControls: React.FC<AudioSegmentControlsProps> = ({
  segment,
  audioControl,
  onUpdateAudioSegment,
  onResetAudioSegment
}) => {
  const [isEditing, setIsEditing] = useState(false);
  const [startValue, setStartValue] = useState('0:00');
  const [endValue, setEndValue] = useState('0:00');

  useEffect(() => {
    if (!segment) return;
    setStartValue(formatTime(segment.start));
    setEndValue(formatTime(segment.end));
  }, [segment]);

  if (!segment) {
    return (
      <div className="audio-segment-row audio-segment-empty">
        Audio segment loading
      </div>
    );
  }

  const isActive = audioControl?.activeSegmentId === segment.id;
  const isLooping = isActive && audioControl?.isLoopingSegment;
  const canControlAudio = !!audioControl?.isReady;

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

  // Keyboard shortcut refs to prevent keydown listener re-registrations
  const startRef = React.useRef(startValue);
  const endRef = React.useRef(endValue);
  const segmentRef = React.useRef(segment);
  const audioRef = React.useRef(audioControl);
  const activeRef = React.useRef(isActive);
  const loopRef = React.useRef(isLooping);

  useEffect(() => {
    startRef.current = startValue;
    endRef.current = endValue;
    segmentRef.current = segment;
    audioRef.current = audioControl;
    activeRef.current = isActive;
    loopRef.current = isLooping;
  });

  useEffect(() => {
    if (!isEditing) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      const isInput = document.activeElement?.tagName === 'INPUT' || document.activeElement?.tagName === 'TEXTAREA';

      if (e.key === 'Enter') {
        e.preventDefault();
        const nextStart = parseTimeInput(startRef.current);
        const nextEnd = parseTimeInput(endRef.current);
        if (Number.isFinite(nextStart) && Number.isFinite(nextEnd)) {
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
          if (audioRef.current?.isReady) {
            if (loopRef.current) {
              audioRef.current.stopSegment();
            } else {
              audioRef.current.playSegment(segmentRef.current, true);
            }
          }
        } else if (e.key === ' ') {
          e.preventDefault();
          if (audioRef.current?.isReady) {
            if (activeRef.current && audioRef.current.isPlaying) {
              audioRef.current.stopSegment();
            } else {
              audioRef.current.playSegment(segmentRef.current, false);
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
  }, [isEditing]);

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
            onClick={() => audioControl?.playSegment(segment)}
            title={`Play ${segment.label}`}
          >
            <Play size={14} />
            <span>Play</span>
          </button>
          <button
            className={`audio-segment-btn ${isLooping ? 'active' : ''}`}
            type="button"
            disabled={!canControlAudio}
            onClick={() => isLooping ? audioControl?.stopSegment() : audioControl?.playSegment(segment, true)}
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
            />
          </label>
          <label>
            <span>End</span>
            <input
              className="audio-segment-input"
              value={endValue}
              onChange={(event) => setEndValue(event.target.value)}
              inputMode="numeric"
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
          
          <div className="audio-segment-shortcuts-legend" style={{ width: '100%', display: 'flex', flexWrap: 'wrap', gap: '8px', fontSize: '0.72rem', color: 'hsl(var(--text-muted))', marginTop: '12px', paddingTop: '8px', borderTop: '1px dashed hsl(var(--panel-border) / 0.5)' }}>
            <span>⌨️ Shortcuts:</span>
            <span><strong>[</strong> Set start</span>
            <span><strong>]</strong> Set end</span>
            <span><strong>Space</strong> Play/Pause</span>
            <span><strong>L</strong> Loop</span>
            <span><strong>Arrows</strong> Seek 2s (Shift: 5s)</span>
            <span><strong>Enter</strong> Save</span>
            <span><strong>Esc</strong> Cancel</span>
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
}

const AudioSegmentManagerRow: React.FC<AudioSegmentManagerRowProps> = ({
  segment,
  audioControl,
  onUpdateAudioSegment,
  onResetAudioSegment
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
          />
        </label>
        <label>
          <span>End</span>
          <input
            className="audio-segment-input"
            value={endValue}
            onChange={(event) => setEndValue(event.target.value)}
            inputMode="numeric"
          />
        </label>
      </div>
      <div className="audio-segment-manager-actions">
        <button
          className="audio-segment-btn icon-only"
          type="button"
          disabled={!canControlAudio}
          onClick={() => audioControl?.playSegment(segment)}
          title={`Play ${segment.label}`}
        >
          <Play size={14} />
        </button>
        <button
          className={`audio-segment-btn icon-only ${isLooping ? 'active' : ''}`}
          type="button"
          disabled={!canControlAudio}
          onClick={() => isLooping ? audioControl?.stopSegment() : audioControl?.playSegment(segment, true)}
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
}

const AudioSegmentManager: React.FC<AudioSegmentManagerProps> = ({
  segments,
  audioControl,
  onUpdateAudioSegment,
  onResetAudioSegment
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
  onResetAudioSegment
}) => {
  const showTranscript = isGraded || mode === 'study';
  const [showTranslations, setShowTranslations] = useState(true);

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
          />

          {/* Transcript Panel: Locked during test, revealed after grading */}
          <div
            className="glass-panel"
            style={{
              padding: '24px',
              marginBottom: '24px',
              background: showTranscript ? 'hsl(var(--panel-bg) / 0.5)' : 'hsl(var(--panel-bg) / 0.25)',
              borderStyle: showTranscript ? 'solid' : 'dashed'
            }}
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
    </div>
  );
};
