import React, { useState, useEffect } from 'react';
import { Question, VocabularyItem } from '../types';

interface ReadingPassageProps {
  originalPassage: string;
  completedPassage: string;
  questions: Question[];
  selectedAnswers: { [qNum: number]: string };
  isGraded: boolean;
  mode?: 'study' | 'practice' | 'review';
  onBlankClick?: (qNum: number) => void;
  vocabulary?: string[];
  customVocabItems?: VocabularyItem[];
  onSaveCustomVocab?: (item: VocabularyItem) => void;
  lessonId?: string;
  lessonTitle?: string;
  highlightedWord?: string | null;
  onClearHighlightedWord?: () => void;
}

export const ReadingPassage: React.FC<ReadingPassageProps> = ({
  originalPassage,
  completedPassage,
  questions,
  selectedAnswers,
  isGraded,
  mode = 'practice',
  onBlankClick,
  vocabulary = [],
  customVocabItems = [],
  onSaveCustomVocab,
  lessonId,
  lessonTitle,
  highlightedWord = null,
  onClearHighlightedWord
}) => {
  const [userHighlights, setUserHighlights] = useState<Array<{ text: string; color: string }>>([]);
  const [popover, setPopover] = useState<{
    visible: boolean;
    x: number;
    y: number;
    text: string;
  }>({ visible: false, x: 0, y: 0, text: '' });
  const [saveDefinition, setSaveDefinition] = useState('');

  // Handle double-click/selection popover positioning
  const handleMouseUp = () => {
    const selection = window.getSelection();
    if (!selection) return;
    const text = selection.toString().trim();
    if (text.length > 0 && text.length < 50) { // Limit length to avoid popover on giant paragraphs
      try {
        const range = selection.getRangeAt(0);
        const rect = range.getBoundingClientRect();
        setPopover({
          visible: true,
          x: rect.left + rect.width / 2 + window.scrollX,
          y: rect.top + window.scrollY - 10,
          text: text
        });
      } catch (e) {
        console.error(e);
      }
    }
  };

  // Close popover on click outside
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

  // Look up definition inside vocabulary or custom items
  const foundDefinition = React.useMemo(() => {
    if (!popover.text) return null;
    const cleanWord = popover.text.toLowerCase().trim().replace(/[.,\/#!$%\^&\*;:{}=\-_`~()?]/g, '');

    // 1. Search in custom vocabulary first
    const customMatch = customVocabItems.find((x) => x.term.toLowerCase() === cleanWord);
    if (customMatch) {
      return `Custom definition: ${customMatch.definition}`;
    }

    // 2. Search in lesson vocabulary
    for (const vocab of vocabulary) {
      const parts = vocab.split(':');
      if (parts.length > 0) {
        const termPart = parts[0].toLowerCase();
        const termClean = termPart.replace(/[.,\/#!$%\^&\*;:{}=\-_`~()?]/g, '').trim();
        // check if match
        if (termClean === cleanWord || termClean.includes(cleanWord)) {
          return vocab;
        }
      }
    }

    return null;
  }, [popover.text, vocabulary, customVocabItems]);

  const handleAddHighlight = (color: string) => {
    setUserHighlights((prev) => {
      const filtered = prev.filter((h) => h.text.toLowerCase() !== popover.text.toLowerCase());
      return [...filtered, { text: popover.text, color }];
    });
    setPopover((prev) => ({ ...prev, visible: false }));
    window.getSelection()?.removeAllRanges();
  };

  const handleClearHighlights = () => {
    setUserHighlights([]);
    setPopover((prev) => ({ ...prev, visible: false }));
    window.getSelection()?.removeAllRanges();
  };

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

  // Scroll to word & flash on click from Vocabulary tab
  useEffect(() => {
    if (!highlightedWord) return;

    const timer = setTimeout(() => {
      const elements = document.getElementsByClassName('highlight-flash');
      if (elements.length > 0) {
        elements[0].scrollIntoView({ behavior: 'smooth', block: 'center' });

        const el = elements[0] as HTMLElement;
        el.style.outline = '3px solid hsl(var(--primary))';
        el.style.outlineOffset = '2px';
        el.style.borderRadius = '4px';

        const outlineTimer = setTimeout(() => {
          el.style.outline = '';
        }, 2000);

        return () => clearTimeout(outlineTimer);
      }
      onClearHighlightedWord?.();
    }, 150);

    return () => clearTimeout(timer);
  }, [highlightedWord]);

  // Apply user highlights and vocab link flashing
  const applyHighlights = (text: string): React.ReactNode[] => {
    if (!text) return [text];

    const sortedHighlights = [...userHighlights].sort((a, b) => b.text.length - a.text.length);
    
    // Add temp flash highlight for active vocab lookup
    if (highlightedWord) {
      const exists = sortedHighlights.some((h) => h.text.toLowerCase() === highlightedWord.toLowerCase());
      if (!exists) {
        sortedHighlights.unshift({ text: highlightedWord, color: 'flash' });
      }
    }

    let segments: React.ReactNode[] = [text];

    sortedHighlights.forEach(({ text: searchTxt, color }) => {
      if (!searchTxt) return;
      const nextSegments: React.ReactNode[] = [];

      segments.forEach((seg) => {
        if (typeof seg !== 'string') {
          nextSegments.push(seg);
          return;
        }

        const escaped = searchTxt.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const parts = seg.split(new RegExp(`(${escaped})`, 'gi'));

        parts.forEach((part) => {
          if (part.toLowerCase() === searchTxt.toLowerCase()) {
            const cls = color === 'flash' ? 'highlight-yellow highlight-flash' : `highlight-${color}`;
            nextSegments.push(
              <span key={Math.random()} className={cls}>
                {part}
              </span>
            );
          } else {
            nextSegments.push(part);
          }
        });
      });
      segments = nextSegments;
    });

    return segments;
  };

  // Simple helper to parse basic markdown bold, newlines, and apply highlights
  const parseMarkdownText = (text: string): React.ReactNode => {
    if (!text) return '';

    const lines = text.split('\n');
    return lines.map((line, lineIdx) => {
      const parts = line.split(/(\*\*.*?\*\*)/g);
      const content = parts.map((part, partIdx) => {
        if (part.startsWith('**') && part.endsWith('**')) {
          return <strong key={partIdx}>{applyHighlights(part.slice(2, -2))}</strong>;
        }
        return <React.Fragment key={partIdx}>{applyHighlights(part)}</React.Fragment>;
      });

      return (
        <React.Fragment key={lineIdx}>
          {content}
          {lineIdx < lines.length - 1 && <br />}
        </React.Fragment>
      );
    });
  };

  const renderInteractivePassage = () => {
    if (isGraded || mode === 'study') {
      const parts = completedPassage.split(/((?:\*\*|)?<u>.*?<\/u>(?:\*\*|)?\s*\(\d+\))/gi);

      return parts.map((part, index) => {
        const match = part.match(/(?:\*\*|)?<u>(.*?)<\/u>(?:\*\*|)?\s*\((\d+)\)/i);
        if (match) {
          const answerText = match[1];
          const qNum = parseInt(match[2]);
          const selected = selectedAnswers[qNum];
          const qData = questions.find((q) => q.num === qNum);
          const correctOpt = qData?.options.find((o) => o.correct);
          const isCorrect = mode === 'study' || selected === correctOpt?.label;

          return (
            <span
              key={index}
              className={`blank-space ${mode === 'study' ? 'filled' : isCorrect ? 'correct-fill' : 'incorrect-fill'}`}
              onClick={() => onBlankClick?.(qNum)}
              style={{ cursor: 'pointer' }}
              title={mode === 'study' || isCorrect ? 'Correct answer' : `Your answer: ${selected || 'None'}. Correct: ${correctOpt?.label}`}
            >
              {answerText} ({qNum})
            </span>
          );
        }
        return <React.Fragment key={index}>{parseMarkdownText(part)}</React.Fragment>;
      });
    }

    const parts = originalPassage.split(/(<u>(?:&nbsp;|\s)*\(\d+\)(?:&nbsp;|\s)*<\/u>)/gi);

    return parts.map((part, index) => {
      const match = part.match(/<u>(?:&nbsp;|\s)*\((\d+)\)(?:&nbsp;|\s)*<\/u>/i);
      if (match) {
        const qNum = parseInt(match[1]);
        const selected = selectedAnswers[qNum];
        const qData = questions.find((q) => q.num === qNum);
        const selectedOpt = qData?.options.find((o) => o.label === selected);

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
    <div
      id={`passage-card-${lessonId}`}
      className="glass-panel passage-card"
      style={{ marginBottom: '24px', position: 'relative' }}
      onMouseUp={handleMouseUp}
    >
      <div style={{ padding: '0 8px' }}>
        {renderInteractivePassage()}
      </div>

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
          <div className="popover-actions">
            <div className="popover-colors">
              <button
                className="popover-color-btn yellow"
                onClick={() => handleAddHighlight('yellow')}
                title="Highlight Yellow"
              />
              <button
                className="popover-color-btn green"
                onClick={() => handleAddHighlight('green')}
                title="Highlight Green"
              />
              <button
                className="popover-color-btn cyan"
                onClick={() => handleAddHighlight('cyan')}
                title="Highlight Cyan"
              />
            </div>
            <button
              className="popover-clear-btn"
              onClick={handleClearHighlights}
            >
              Clear All
            </button>
          </div>

          <div className="popover-lookup">
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
