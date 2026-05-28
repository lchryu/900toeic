import React from 'react';
import { Bookmark, CheckCircle, AlertCircle, HelpCircle } from 'lucide-react';
import { Option } from '../types';

interface QuestionBlockProps {
  num: number;
  text?: string;
  options: Option[];
  explanation?: string;
  selectedOption: string;
  isFlagged: boolean;
  isGraded: boolean;
  onSelect: (label: string) => void;
  onToggleFlag: () => void;
}

export const QuestionBlock: React.FC<QuestionBlockProps> = ({
  num,
  text,
  options,
  explanation,
  selectedOption,
  isFlagged,
  isGraded,
  onSelect,
  onToggleFlag
}) => {
  const handleOptionClick = (label: string) => {
    if (isGraded) return; // Disable changes after grading
    onSelect(label);
  };

  return (
    <div
      id={`question-card-${num}`}
      className="glass-panel"
      style={{
        padding: '24px',
        marginBottom: '24px',
        borderLeft: isGraded
          ? selectedOption === options.find(o => o.correct)?.label
            ? '4px solid hsl(var(--success))'
            : '4px solid hsl(var(--error))'
          : isFlagged
          ? '4px solid hsl(var(--warning))'
          : '1px solid var(--border-subtle)',
        scrollMarginTop: '100px'
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px' }}>
        <h4 style={{ fontSize: '1.05rem', fontWeight: 600, display: 'flex', alignItems: 'flex-start', gap: '8px' }}>
          <span style={{ color: 'hsl(var(--primary))', fontFamily: 'var(--font-title)', fontWeight: 700 }}>
            {num}.
          </span>
          <span>{text || 'Fill in the blank space in the passage above:'}</span>
        </h4>
        
        <button
          onClick={onToggleFlag}
          style={{
            background: 'transparent',
            border: 'none',
            cursor: isGraded ? 'default' : 'pointer',
            color: isFlagged ? 'hsl(var(--warning))' : 'hsl(var(--text-muted))',
            display: 'flex',
            alignItems: 'center',
            padding: '4px',
            borderRadius: '4px',
            transition: 'all 0.2s ease'
          }}
          disabled={isGraded}
          title={isFlagged ? 'Unflag for review' : 'Flag for review'}
        >
          <Bookmark size={18} fill={isFlagged ? 'currentColor' : 'none'} />
        </button>
      </div>

      <ul className="option-list">
        {options.map((opt) => {
          const isSelected = selectedOption === opt.label;
          const isCorrect = opt.correct;
          
          let optClass = 'option-item';
          if (isGraded) {
            if (isCorrect) {
              optClass += ' correct';
            } else if (isSelected) {
              optClass += ' incorrect';
            }
          } else if (isSelected) {
            optClass += ' selected';
          }

          return (
            <li
              key={opt.label}
              className={optClass}
              onClick={() => handleOptionClick(opt.label)}
            >
              <span className="option-label">{opt.label}</span>
              <span style={{ flex: 1 }}>{opt.text}</span>
              
              {isGraded && isCorrect && (
                <CheckCircle size={16} style={{ color: 'hsl(var(--success))', marginLeft: '8px' }} />
              )}
              {isGraded && isSelected && !isCorrect && (
                <AlertCircle size={16} style={{ color: 'hsl(var(--error))', marginLeft: '8px' }} />
              )}
            </li>
          );
        })}
      </ul>

      {/* Render explanation post-grading */}
      {isGraded && explanation && (
        <div className="explanation-panel">
          <div className="explanation-title">
            <HelpCircle size={16} />
            <span>Explanation & Translation</span>
          </div>
          <p>{explanation}</p>
        </div>
      )}
    </div>
  );
};
