import React from 'react';
import { ListeningGroup, QuestionState } from '../types';
import { QuestionBlock } from './QuestionBlock';
import { Headphones, Lock, Unlock } from 'lucide-react';

interface ListeningWorkspaceProps {
  listeningGroups: ListeningGroup[];
  graphics?: { [qNum: number]: string };
  selectedAnswers: { [qNum: number]: string };
  questionStates: { [qNum: number]: QuestionState };
  isGraded: boolean;
  mode: 'study' | 'practice' | 'review';
  onSelectOption: (qNum: number, label: string) => void;
  onToggleFlag: (qNum: number) => void;
}

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
  onSelectOption,
  onToggleFlag
}) => {
  const showTranscript = isGraded || mode === 'study';

  return (
    <div style={{ padding: '24px', maxWidth: '850px', margin: '0 auto', width: '100%' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '24px' }}>
        <Headphones className="text-sky-400" size={24} />
        <h2 style={{ fontSize: '1.5rem', fontWeight: 700 }}>Part 3: Listening Comprehension</h2>
      </div>

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
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'hsl(var(--success))', marginBottom: '16px', fontWeight: 600, fontSize: '0.9rem' }}>
                  <Unlock size={16} />
                  <span>{mode === 'study' ? 'Study transcript' : 'Audio Transcript unlocked'}</span>
                </div>
                
                {group.transcript.map((line, idx) => (
                  <div key={idx} className="dialogue-item">
                    <span className={`speaker-badge bg-${line.speaker.toLowerCase()}`}>
                      {line.speaker}
                    </span>
                    <div className="dialogue-copy">
                      <p className="dialogue-text">{line.text}</p>
                      {line.translation && (
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
