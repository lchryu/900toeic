import React from 'react';
import { Question } from '../types';

interface ReadingPassageProps {
  originalPassage: string;
  completedPassage: string;
  questions: Question[];
  selectedAnswers: { [qNum: number]: string };
  isGraded: boolean;
  onBlankClick?: (qNum: number) => void;
}

// Simple helper to parse basic markdown bold and newlines
const parseMarkdownText = (text: string): React.ReactNode => {
  if (!text) return '';
  
  // Split by newlines
  const lines = text.split('\n');
  return lines.map((line, lineIdx) => {
    // Parse bold text **word**
    const parts = line.split(/(\*\*.*?\*\*)/g);
    const content = parts.map((part, partIdx) => {
      if (part.startsWith('**') && part.endsWith('**')) {
        return <strong key={partIdx}>{part.slice(2, -2)}</strong>;
      }
      return part;
    });

    return (
      <React.Fragment key={lineIdx}>
        {content}
        {lineIdx < lines.length - 1 && <br />}
      </React.Fragment>
    );
  });
};

export const ReadingPassage: React.FC<ReadingPassageProps> = ({
  originalPassage,
  completedPassage,
  questions,
  selectedAnswers,
  isGraded,
  onBlankClick
}) => {
  
  const renderInteractivePassage = () => {
    if (isGraded) {
      // Split completed passage by the underline answers: e.g. <u>seriously</u> (131)
      // Matches: **<u>are working</u>** (132) or <u>seriously</u> (131)
      const parts = completedPassage.split(/((?:\*\*|)?<u>.*?<\/u>(?:\*\*|)?\s*\(\d+\))/gi);
      
      return parts.map((part, index) => {
        const match = part.match(/(?:\*\*|)?<u>(.*?)<\/u>(?:\*\*|)?\s*\((\d+)\)/i);
        if (match) {
          const answerText = match[1];
          const qNum = parseInt(match[2]);
          const selected = selectedAnswers[qNum];
          const qData = questions.find(q => q.num === qNum);
          const correctOpt = qData?.options.find(o => o.correct);
          const isCorrect = selected === correctOpt?.label;
          
          return (
            <span
              key={index}
              className={`blank-space ${isCorrect ? 'correct-fill' : 'incorrect-fill'}`}
              onClick={() => onBlankClick?.(qNum)}
              style={{ cursor: 'pointer' }}
              title={isCorrect ? 'Correct!' : `Your answer: ${selected || 'None'}. Correct: ${correctOpt?.label}`}
            >
              {answerText} ({qNum})
            </span>
          );
        }
        return <React.Fragment key={index}>{parseMarkdownText(part)}</React.Fragment>;
      });
    }

    // Split original passage by underlines: e.g. <u>&nbsp;&nbsp;&nbsp;&nbsp;(131)&nbsp;&nbsp;&nbsp;&nbsp;</u>
    const parts = originalPassage.split(/(<u>(?:&nbsp;|\s)*\(\d+\)(?:&nbsp;|\s)*<\/u>)/gi);

    return parts.map((part, index) => {
      const match = part.match(/<u>(?:&nbsp;|\s)*\((\d+)\)(?:&nbsp;|\s)*<\/u>/i);
      if (match) {
        const qNum = parseInt(match[1]);
        const selected = selectedAnswers[qNum];
        const qData = questions.find(q => q.num === qNum);
        const selectedOpt = qData?.options.find(o => o.label === selected);
        
        const displayText = selectedOpt ? `${selectedOpt.text} (${qNum})` : `(${qNum})`;
        
        return (
          <span
            key={index}
            className={`blank-space ${selectedOpt ? 'filled' : ''}`}
            onClick={() => onBlankClick?.(qNum)}
            style={{ cursor: 'pointer' }}
            title={`Click to jump to Question ${qNum}`}
          >
            {displayText}
          </span>
        );
      }
      return <React.Fragment key={index}>{parseMarkdownText(part)}</React.Fragment>;
    });
  };

  return (
    <div className="glass-panel passage-card" style={{ marginBottom: '24px' }}>
      <div style={{ padding: '0 8px' }}>
        {renderInteractivePassage()}
      </div>
    </div>
  );
};
