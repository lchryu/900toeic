export interface Option {
  label: string;
  text: string;
  correct: boolean;
}

export interface Question {
  num: number;
  text?: string;
  options: Option[];
  explanation?: string;
}

export interface SpeakerText {
  speaker: string;
  text: string;
  translation?: string;
}

export interface ListeningGroup {
  id: string;
  range: string;
  startQ: number;
  endQ: number;
  transcript: SpeakerText[];
  questions: Question[];
}

export interface ReadingGroup {
  id: string;
  range: string;
  startQ: number;
  endQ: number;
  originalPassage: string;
  completedPassage: string;
  questions: Question[];
  vocabulary: string[];
  takeaways: string[];
}

export interface LessonData {
  id: string;
  title: string;
  audio: string;
  graphics?: { [qNum: number]: string };
  listening: ListeningGroup[];
  reading: ReadingGroup[];
}

export interface QuestionState {
  selectedOption: string; // 'A', 'B', 'C', 'D' or empty
  isFlagged: boolean;
}

export interface LessonProgress {
  lessonId: string;
  answers: { [qNum: number]: string }; // qNum -> selected option
  flaggedQuestions?: number[];
  lastTab?: 'listening' | 'reading';
  mode?: 'study' | 'practice' | 'review';
  timeSpent: number; // in seconds
  score: number;
  totalQuestions: number;
  isSubmitted?: boolean;
  completedDate?: string;
}
