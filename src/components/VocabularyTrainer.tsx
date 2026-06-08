import React, { useState, useEffect } from 'react';
import { BookOpen, Search, RotateCcw, Check, HelpCircle, CheckCircle, ChevronLeft, ChevronRight, Bookmark } from 'lucide-react';
import { LessonData } from '../types';

interface VocabularyTrainerProps {
  lessons: LessonData[];
}

interface VocabularyItem {
  id: string;
  term: string;
  definition: string;
  lessonId: string;
  lessonTitle: string;
}

const LOCAL_STORAGE_VOCAB_KEY = 'toeic_vocabulary_mastered';

export const VocabularyTrainer: React.FC<VocabularyTrainerProps> = ({ lessons }) => {
  const [activeTab, setActiveTab] = useState<'flashcards' | 'library'>('flashcards');
  const [selectedLessonId, setSelectedLessonId] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  
  // Flashcard states
  const [deck, setDeck] = useState<VocabularyItem[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);
  const [masteredIds, setMasteredIds] = useState<string[]>(() => {
    try {
      const stored = localStorage.getItem(LOCAL_STORAGE_VOCAB_KEY);
      return stored ? JSON.parse(stored) : [];
    } catch {
      return [];
    }
  });

  // Extract vocabulary from lessons
  const allVocabItems = React.useMemo(() => {
    const items: VocabularyItem[] = [];
    lessons.forEach((lesson) => {
      lesson.reading.forEach((group) => {
        if (!group.vocabulary) return;
        group.vocabulary.forEach((line, lineIdx) => {
          // Parse lines like "**Quality-control team:** Đội ngũ kiểm soát chất lượng."
          // or "**Prior to:** = *Before* (Trước khi)."
          const boldColonMatch = line.match(/^\*\*(.*?)\*\*:\s*(.*)$/);
          let term = '';
          let definition = '';
          
          if (boldColonMatch) {
            term = boldColonMatch[1].trim();
            definition = boldColonMatch[2].trim();
          } else {
            const colonIndex = line.indexOf(':');
            if (colonIndex !== -1) {
              term = line.substring(0, colonIndex).replace(/\*\*|\*/g, '').trim();
              definition = line.substring(colonIndex + 1).trim();
            } else {
              term = line.replace(/\*\*|\*/g, '').trim();
              definition = '';
            }
          }

          if (term) {
            items.push({
              id: `${lesson.id}-${term.toLowerCase().replace(/[^a-z0-9]/g, '-')}-${lineIdx}`,
              term,
              definition,
              lessonId: lesson.id,
              lessonTitle: lesson.title
            });
          }
        });
      });
    });
    return items;
  }, [lessons]);

  // Sync mastered list to localStorage
  useEffect(() => {
    localStorage.setItem(LOCAL_STORAGE_VOCAB_KEY, JSON.stringify(masteredIds));
  }, [masteredIds]);

  // Filter items based on selections
  const filteredItems = React.useMemo(() => {
    return allVocabItems.filter((item) => {
      const matchesLesson = selectedLessonId === 'all' || item.lessonId === selectedLessonId;
      const matchesSearch =
        item.term.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.definition.toLowerCase().includes(searchQuery.toLowerCase());
      return matchesLesson && matchesSearch;
    });
  }, [allVocabItems, selectedLessonId, searchQuery]);

  // Initialize and shuffle deck for flashcards
  const initDeck = (itemsToUse = filteredItems) => {
    // Filter out mastered items if there are unmastered items left
    const unmastered = itemsToUse.filter((item) => !masteredIds.includes(item.id));
    const finalItems = unmastered.length > 0 ? unmastered : itemsToUse;
    
    // Shuffle
    const shuffled = [...finalItems].sort(() => Math.random() - 0.5);
    setDeck(shuffled);
    setCurrentIndex(0);
    setIsFlipped(false);
  };

  useEffect(() => {
    initDeck();
  }, [selectedLessonId, allVocabItems]);

  const handleFlip = () => {
    setIsFlipped(!isFlipped);
  };

  const handleNext = () => {
    if (deck.length === 0) return;
    setIsFlipped(false);
    setTimeout(() => {
      setCurrentIndex((prev) => (prev + 1) % deck.length);
    }, 150);
  };

  const handlePrev = () => {
    if (deck.length === 0) return;
    setIsFlipped(false);
    setTimeout(() => {
      setCurrentIndex((prev) => (prev - 1 + deck.length) % deck.length);
    }, 150);
  };

  const handleMarkMastered = (itemId: string) => {
    if (!masteredIds.includes(itemId)) {
      setMasteredIds((prev) => [...prev, itemId]);
    }
    
    // Remove from current deck or just advance
    if (deck.length > 1) {
      // Create next deck state
      const nextDeck = deck.filter((item) => item.id !== itemId);
      setDeck(nextDeck);
      setIsFlipped(false);
      // Adjust index if out of bounds
      if (currentIndex >= nextDeck.length) {
        setCurrentIndex(0);
      }
    } else {
      // Last card marked mastered
      setDeck([]);
    }
  };

  const handleToggleMasteredLibrary = (itemId: string) => {
    setMasteredIds((prev) => {
      if (prev.includes(itemId)) {
        return prev.filter((id) => id !== itemId);
      } else {
        return [...prev, itemId];
      }
    });
  };

  const handleResetProgress = () => {
    if (window.confirm('Are you sure you want to reset all vocabulary study progress?')) {
      setMasteredIds([]);
      setTimeout(() => initDeck(filteredItems), 50);
    }
  };

  const currentCard = deck[currentIndex];
  const totalMasteredFiltered = filteredItems.filter((item) => masteredIds.includes(item.id)).length;
  const percentMastered = filteredItems.length > 0 
    ? Math.round((totalMasteredFiltered / filteredItems.length) * 100) 
    : 0;

  // Get unique lesson list that actually has vocabulary
  const lessonsWithVocab = React.useMemo(() => {
    const ids = new Set(allVocabItems.map((item) => item.lessonId));
    return lessons.filter((lesson) => ids.has(lesson.id));
  }, [lessons, allVocabItems]);

  return (
    <div className="vocab-trainer-container" style={{ padding: '32px', maxWidth: '1000px', margin: '0 auto', width: '100%' }}>
      <header style={{ marginBottom: '32px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <h1 style={{ fontSize: '2.5rem', fontWeight: 800, marginBottom: '8px', fontFamily: 'var(--font-title)' }}>
            Vocabulary Trainer
          </h1>
          <p style={{ color: 'hsl(var(--text-secondary))' }}>
            Master core TOEIC terms dynamically compiled from your reading exercises.
          </p>
        </div>

        <div className="segmented-control">
          <button
            className={`segmented-btn ${activeTab === 'flashcards' ? 'active' : ''}`}
            onClick={() => setActiveTab('flashcards')}
          >
            <Bookmark size={16} />
            <span>Flashcards</span>
          </button>
          <button
            className={`segmented-btn ${activeTab === 'library' ? 'active' : ''}`}
            onClick={() => setActiveTab('library')}
          >
            <BookOpen size={16} />
            <span>Library</span>
          </button>
        </div>
      </header>

      {/* Filter and Search Panel */}
      <div className="glass-panel" style={{ padding: '20px', marginBottom: '32px', display: 'flex', gap: '16px', flexWrap: 'wrap', alignItems: 'center' }}>
        <div style={{ flex: 1, minWidth: '240px', position: 'relative' }}>
          <Search size={18} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'hsl(var(--text-muted))' }} />
          <input
            type="text"
            placeholder="Search terms or translations..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{
              width: '100%',
              padding: '10px 12px 10px 40px',
              borderRadius: '8px',
              border: '1px solid hsl(var(--panel-border))',
              background: 'hsl(var(--panel-bg) / 0.3)',
              color: 'hsl(var(--text-primary))',
              fontSize: '0.95rem'
            }}
          />
        </div>

        <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', alignItems: 'center' }}>
          <select
            value={selectedLessonId}
            onChange={(e) => setSelectedLessonId(e.target.value)}
            style={{
              padding: '10px 16px',
              borderRadius: '8px',
              border: '1px solid hsl(var(--panel-border))',
              background: 'hsl(var(--panel-bg) / 0.5)',
              color: 'hsl(var(--text-primary))',
              fontSize: '0.9rem',
              cursor: 'pointer'
            }}
          >
            <option value="all">All Lessons</option>
            {lessonsWithVocab.map((l) => (
              <option key={l.id} value={l.id}>
                {l.title.replace(/📘|Lesson\s*/g, '').trim()}
              </option>
            ))}
          </select>

          {masteredIds.length > 0 && (
            <button className="secondary-btn" onClick={handleResetProgress} style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '9px 16px' }}>
              <RotateCcw size={14} />
              <span>Reset Trainer</span>
            </button>
          )}
        </div>
      </div>

      {/* Progress Bar */}
      <div style={{ marginBottom: '24px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', color: 'hsl(var(--text-secondary))', marginBottom: '8px' }}>
          <span>Accuracy Mastery: <strong>{totalMasteredFiltered} / {filteredItems.length}</strong> words learned</span>
          <span>{percentMastered}%</span>
        </div>
        <div style={{ height: '8px', width: '100%', background: 'hsl(var(--panel-border) / 0.3)', borderRadius: '4px', overflow: 'hidden' }}>
          <div style={{ height: '100%', width: `${percentMastered}%`, background: 'linear-gradient(90deg, hsl(var(--primary)) 0%, hsl(var(--primary-hover)) 100%)', borderRadius: '4px', transition: 'width 0.4s ease' }} />
        </div>
      </div>

      {/* FLASHCARD TAB */}
      {activeTab === 'flashcards' && (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '24px' }}>
          {deck.length === 0 ? (
            <div className="glass-panel" style={{ padding: '60px 40px', textAlign: 'center', width: '100%', maxWidth: '600px' }}>
              <CheckCircle size={48} className="text-emerald-500" style={{ margin: '0 auto 16px auto' }} />
              <h2 style={{ fontSize: '1.5rem', fontWeight: 700, marginBottom: '8px' }}>All caught up!</h2>
              <p style={{ color: 'hsl(var(--text-secondary))', marginBottom: '24px' }}>
                You have marked all words in this deck as Mastered. Reset the deck to study again or change filters.
              </p>
              <button className="primary-btn" onClick={() => initDeck(filteredItems)} style={{ margin: '0 auto' }}>
                <RotateCcw size={16} />
                <span>Restart Deck</span>
              </button>
            </div>
          ) : (
            <>
              {/* Flashcard Shell */}
              <div 
                className={`flashcard-card ${isFlipped ? 'flipped' : ''}`}
                onClick={handleFlip}
                style={{
                  width: '100%',
                  maxWidth: '550px',
                  height: '320px',
                  perspective: '1000px',
                  cursor: 'pointer'
                }}
              >
                <div 
                  className="flashcard-inner"
                  style={{
                    position: 'relative',
                    width: '100%',
                    height: '100%',
                    textAlign: 'center',
                    transition: 'transform 0.6s cubic-bezier(0.4, 0, 0.2, 1)',
                    transformStyle: 'preserve-3d',
                    transform: isFlipped ? 'rotateY(180deg)' : 'rotateY(0deg)'
                  }}
                >
                  {/* Front Side */}
                  <div 
                    className="flashcard-front glass-panel"
                    style={{
                      position: 'absolute',
                      width: '100%',
                      height: '100%',
                      backfaceVisibility: 'hidden',
                      display: 'flex',
                      flexDirection: 'column',
                      justifyContent: 'center',
                      alignItems: 'center',
                      padding: '32px',
                      borderRadius: '16px',
                      border: '1px solid hsl(var(--panel-border))',
                      boxShadow: '0 8px 30px rgba(0, 0, 0, 0.12)'
                    }}
                  >
                    <span style={{ fontSize: '0.8rem', color: 'hsl(var(--primary))', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.1em', position: 'absolute', top: '24px' }}>
                      {currentCard.lessonTitle.replace(/📘|Lesson\s*/g, '').trim()}
                    </span>
                    
                    <h2 style={{ fontSize: '2.2rem', fontWeight: 800, color: 'hsl(var(--text-primary))', textAlign: 'center', wordBreak: 'break-word', padding: '0 10px' }}>
                      {currentCard.term}
                    </h2>
                    
                    <div style={{ position: 'absolute', bottom: '24px', display: 'flex', alignItems: 'center', gap: '6px', color: 'hsl(var(--text-muted))', fontSize: '0.85rem' }}>
                      <HelpCircle size={15} />
                      <span>Click card to reveal translation</span>
                    </div>
                  </div>

                  {/* Back Side */}
                  <div 
                    className="flashcard-back glass-panel"
                    style={{
                      position: 'absolute',
                      width: '100%',
                      height: '100%',
                      backfaceVisibility: 'hidden',
                      transform: 'rotateY(180deg)',
                      display: 'flex',
                      flexDirection: 'column',
                      justifyContent: 'center',
                      alignItems: 'center',
                      padding: '32px',
                      borderRadius: '16px',
                      border: '1px solid hsl(var(--panel-border))',
                      boxShadow: '0 8px 30px rgba(0, 0, 0, 0.12)',
                      background: 'linear-gradient(135deg, hsl(var(--panel-bg) / 0.8) 0%, hsl(var(--panel-bg) / 0.5) 100%)'
                    }}
                  >
                    <span style={{ fontSize: '0.8rem', color: 'hsl(var(--primary))', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.1em', position: 'absolute', top: '24px' }}>
                      Definition / Translation
                    </span>
                    
                    <h3 style={{ fontSize: '1.4rem', fontWeight: 700, color: 'hsl(var(--text-primary))', textAlign: 'center', wordBreak: 'break-word', lineHeight: 1.5, margin: '20px 0' }}>
                      {currentCard.definition || 'No translation available.'}
                    </h3>

                    <div style={{ position: 'absolute', bottom: '24px', display: 'flex', alignItems: 'center', gap: '6px', color: 'hsl(var(--text-muted))', fontSize: '0.85rem' }}>
                      <HelpCircle size={15} />
                      <span>Click to flip back</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Navigation and Study Actions */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginTop: '8px' }}>
                <button className="secondary-btn icon-only" onClick={handlePrev} style={{ width: '44px', height: '44px', borderRadius: '50%' }}>
                  <ChevronLeft size={20} />
                </button>

                <button 
                  className="secondary-btn" 
                  onClick={() => handleMarkMastered(currentCard.id)}
                  style={{ 
                    display: 'flex', 
                    alignItems: 'center', 
                    gap: '8px', 
                    padding: '12px 24px', 
                    borderColor: 'hsl(var(--success) / 0.3)',
                    color: 'hsl(var(--success))',
                    background: 'hsl(var(--success) / 0.05)'
                  }}
                >
                  <Check size={16} />
                  <span>Mark Mastered</span>
                </button>

                <button className="primary-btn" onClick={handleNext} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '12px 24px' }}>
                  <span>Next Card</span>
                  <ChevronRight size={16} />
                </button>
              </div>

              <span style={{ fontSize: '0.85rem', color: 'hsl(var(--text-muted))' }}>
                Card {currentIndex + 1} of {deck.length} in active loop
              </span>
            </>
          )}
        </div>
      )}

      {/* LIBRARY TAB */}
      {activeTab === 'library' && (
        <div className="glass-panel" style={{ overflow: 'hidden', borderRadius: '12px', border: '1px solid hsl(var(--panel-border))' }}>
          {filteredItems.length === 0 ? (
            <div style={{ padding: '48px', textAlign: 'center', color: 'hsl(var(--text-muted))' }}>
              No vocabulary items found matching your filters.
            </div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.95rem' }}>
                <thead>
                  <tr style={{ background: 'hsl(var(--panel-bg) / 0.5)', borderBottom: '1px solid hsl(var(--panel-border))' }}>
                    <th style={{ padding: '16px', fontWeight: 600 }}>Word / Phrase</th>
                    <th style={{ padding: '16px', fontWeight: 600 }}>Translation / Usage</th>
                    <th style={{ padding: '16px', fontWeight: 600 }}>Source Lesson</th>
                    <th style={{ padding: '16px', fontWeight: 600, width: '120px', textAlign: 'center' }}>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredItems.map((item, idx) => {
                    const isLearned = masteredIds.includes(item.id);
                    return (
                      <tr 
                        key={item.id} 
                        style={{ 
                          borderBottom: idx < filteredItems.length - 1 ? '1px solid hsl(var(--panel-border) / 0.5)' : 'none',
                          background: isLearned ? 'hsl(var(--success) / 0.02)' : 'transparent',
                          transition: 'background 0.2s ease'
                        }}
                      >
                        <td style={{ padding: '16px', fontWeight: 700, color: 'hsl(var(--text-primary))' }}>
                          {item.term}
                        </td>
                        <td style={{ padding: '16px', color: 'hsl(var(--text-secondary))', lineHeight: 1.4 }}>
                          {item.definition}
                        </td>
                        <td style={{ padding: '16px', fontSize: '0.85rem', color: 'hsl(var(--text-muted))' }}>
                          {item.lessonTitle.replace(/📘|Lesson\s*/g, '').trim()}
                        </td>
                        <td style={{ padding: '16px', textAlign: 'center' }}>
                          <button
                            onClick={() => handleToggleMasteredLibrary(item.id)}
                            style={{
                              background: 'transparent',
                              border: 'none',
                              cursor: 'pointer',
                              color: isLearned ? 'hsl(var(--success))' : 'hsl(var(--text-muted))',
                              padding: '6px',
                              borderRadius: '4px',
                              display: 'inline-flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              transition: 'all 0.2s ease'
                            }}
                            title={isLearned ? 'Mark as learning' : 'Mark as mastered'}
                          >
                            {isLearned ? <CheckCircle size={20} fill="currentColor" style={{ color: 'hsl(var(--success) / 0.2)', stroke: 'hsl(var(--success))' }} /> : <HelpCircle size={20} />}
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
