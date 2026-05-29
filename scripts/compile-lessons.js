import fs from 'fs';
import path from 'path';

const LESSONS_DIR = './lessons';
const PUBLIC_DIR = './public';
const AUDIO_DIR = path.join(PUBLIC_DIR, 'audio');
const ASSETS_DIR = path.join(PUBLIC_DIR, 'assets');

const YOUTUBE_AUDIO_BY_LESSON = {
  '11': 'https://www.youtube.com/watch?v=BKSLF-FVcwE&list=PLlkDYJdqzAu_psKIKMnj1WsOLqi5WvjBA&index=11'
};
const OUTPUT_DIR = './src/data';
const OUTPUT_FILE = path.join(OUTPUT_DIR, 'lessons.json');

// Make sure target directory exists
fs.mkdirSync(OUTPUT_DIR, { recursive: true });

function cleanMarkdown(text) {
  if (!text) return '';
  return text
    .replace(/\*\*(.*?)\*\*/g, '$1') // remove bold
    .replace(/\*(.*?)\*/g, '$1')     // remove italic
    .replace(/<u>(.*?)<\/u>/g, '$1') // remove underline
    .replace(/&nbsp;/g, ' ')         // replace HTML spaces
    .replace(/\s+/g, ' ')
    .trim();
}

function findFirstIndex(text, needles) {
  const indexes = needles
    .map((needle) => text.indexOf(needle))
    .filter((index) => index !== -1);
  return indexes.length > 0 ? Math.min(...indexes) : -1;
}

function findLessonAudio(lessonId) {
  if (!fs.existsSync(AUDIO_DIR)) return `audio/${lessonId}.mp3`;

  const audioFile = fs.readdirSync(AUDIO_DIR)
    .find((file) => {
      const parsed = path.parse(file);
      return parsed.name === lessonId && ['.mp3', '.m4a', '.wav', '.ogg'].includes(parsed.ext.toLowerCase());
    });

  return audioFile ? `audio/${audioFile}` : `audio/${lessonId}.mp3`;
}

function findLessonGraphics(lessonId) {
  if (!fs.existsSync(ASSETS_DIR)) return {};

  return fs.readdirSync(ASSETS_DIR).reduce((graphics, file) => {
    const parsed = path.parse(file);
    const match = parsed.name.match(new RegExp(`^${lessonId}_(\\d+)$`));
    if (!match || !['.png', '.jpg', '.jpeg', '.webp', '.svg'].includes(parsed.ext.toLowerCase())) {
      return graphics;
    }

    graphics[parseInt(match[1], 10)] = `assets/${file}`;
    return graphics;
  }, {});
}

function validateQuestion(question, context, errors) {
  if (!question.num) {
    errors.push(`${context}: missing question number`);
  }

  if (!Array.isArray(question.options) || question.options.length !== 4) {
    errors.push(`${context} question ${question.num}: expected 4 options, found ${question.options?.length || 0}`);
    return;
  }

  const correctCount = question.options.filter((option) => option.correct).length;
  if (correctCount !== 1) {
    errors.push(`${context} question ${question.num}: expected 1 correct answer, found ${correctCount}`);
  }
}

function validateLesson(lesson) {
  const errors = [];

  if (!lesson.listening.length && !lesson.reading.length) {
    errors.push(`Lesson ${lesson.id}: no parsed listening or reading groups`);
  }

  lesson.listening.forEach((group) => {
    if (!group.transcript.length) {
      errors.push(`Lesson ${lesson.id} ${group.id}: missing transcript`);
    }

    const expectedCount = group.endQ - group.startQ + 1;
    if (group.questions.length !== expectedCount) {
      errors.push(`Lesson ${lesson.id} ${group.id}: expected ${expectedCount} questions, found ${group.questions.length}`);
    }

    group.questions.forEach((question) => validateQuestion(question, `Lesson ${lesson.id} ${group.id}`, errors));
  });

  lesson.reading.forEach((group) => {
    if (!group.originalPassage) {
      errors.push(`Lesson ${lesson.id} ${group.id}: missing original passage`);
    }
    if (!group.completedPassage) {
      errors.push(`Lesson ${lesson.id} ${group.id}: missing completed passage`);
    }

    const expectedCount = group.endQ - group.startQ + 1;
    if (group.questions.length !== expectedCount) {
      errors.push(`Lesson ${lesson.id} ${group.id}: expected ${expectedCount} questions, found ${group.questions.length}`);
    }

    group.questions.forEach((question) => validateQuestion(question, `Lesson ${lesson.id} ${group.id}`, errors));
  });

  return errors;
}

function parseLesson(filePath) {
  const content = fs.readFileSync(filePath, 'utf-8');
  const filename = path.basename(filePath);
  
  // Extract Title and Lesson ID
  const titleMatch = content.match(/^#\s*(.*?)\s*$/m);
  const title = titleMatch ? titleMatch[1] : 'TOEIC Practice';
  
  const lessonIdMatch = title.match(/Lesson\s*(\d+)/i) || filename.match(/(\d+)/);
  const lessonId = lessonIdMatch ? lessonIdMatch[1] : '12';
  
  console.log(`Parsing ${filename} (Lesson ID: ${lessonId}, Title: "${title}")...`);
  
  // Split into Listening and Reading sections
  const listeningStart = findFirstIndex(content, [
    '## 🎧 Part 3: Listening Comprehension',
    '## Listening Comprehension'
  ]);
  const readingStart = findFirstIndex(content, [
    '## 📖 Part 6-7: Reading Comprehension',
    '## Reading Comprehension'
  ]);
  
  if (listeningStart === -1) {
    console.warn(`Warning: Missing core sections in ${filename}`);
    return null;
  }
  
  const listeningEnd = readingStart === -1 ? content.length : readingStart;
  const listeningSection = content.substring(listeningStart, listeningEnd);
  const readingSection = readingStart === -1 ? '' : content.substring(readingStart);
  
  // 1. Parse Listening Comprehension
  const listeningGroups = [];
  // Use multiline ^ to only match Level 3 headers starting at line boundaries
  const listeningBlocks = listeningSection.split(/^### (?:\S+\s+)?Questions /m);
  
  // Skip the first block (it is the section header)
  for (let i = 1; i < listeningBlocks.length; i++) {
    const block = listeningBlocks[i];
    const lines = block.split('\n');
    
    // Group title/range
    const rangeMatch = lines[0].trim().match(/^(\d+)[–-](\d+)/);
    if (!rangeMatch) continue;
    const startQ = parseInt(rangeMatch[1]);
    const endQ = parseInt(rangeMatch[2]);
    const key = `lc-${startQ}`;
    
    const transcriptIndex = findFirstIndex(block, [
      '#### 📝 Questions & Answers',
      '#### Questions & Answers'
    ]);
    if (transcriptIndex === -1) continue;
    
    // Parse Transcript
    const transcriptText = block.substring(0, transcriptIndex);
    const transcriptLines = transcriptText.split('\n');
    const transcript = [];
    let currentSpeaker = null;
    let currentText = [];
    let currentTranslation = [];

    const flushTranscriptLine = () => {
      if (!currentSpeaker) return;
      const transcriptLine = {
        speaker: currentSpeaker,
        text: currentText.join(' ').replace(/\s+/g, ' ').trim()
      };
      const translation = currentTranslation.join(' ').replace(/\s+/g, ' ').trim();
      if (translation) {
        transcriptLine.translation = translation;
      }
      transcript.push(transcriptLine);
    };
    
    for (const line of transcriptLines) {
      const trimmed = line.replace(/\r/g, '').trim();
      const speakerMatch = trimmed.match(/^\*\*\[(.*?)\]\*\*/);
      if (speakerMatch) {
        flushTranscriptLine();
        currentSpeaker = speakerMatch[1];
        currentText = [trimmed.replace(/^\*\*\[.*?\]\*\*\s*/, '')];
        currentTranslation = [];
      } else if (currentSpeaker && trimmed.startsWith('>')) {
        currentTranslation.push(
          trimmed
            .replace(/^>\s*/, '')
            .replace(/^\*\*?Dịch:\*\*?\s*/i, '')
            .replace(/^Dịch:\s*/i, '')
            .trim()
        );
      } else if (currentSpeaker && trimmed !== '') {
        currentText.push(trimmed);
      }
    }
    flushTranscriptLine();
    
    // Parse Questions
    const questionsBlock = block.substring(transcriptIndex);
    const qSplits = questionsBlock.split(/\n(?=\d+\.\s+\*\*)/);
    const questions = [];
    
    for (const qSplit of qSplits) {
      const qMatch = qSplit.match(/^\s*(\d+)\.\s+\*\*(.*?)\*\*/);
      if (!qMatch) continue;
      
      const qNum = parseInt(qMatch[1]);
      const qText = qMatch[2].trim();
      
      // Parse Options
      const options = [];
      const qLines = qSplit.split('\n');
      for (const qLine of qLines) {
        const cleanedLine = qLine.replace(/\r/g, '').trim();
        if (cleanedLine === '') continue;
        
        // Strip bolding from the start if option is bolded e.g. **A.** -> A.
        const unboldedLine = cleanedLine.replace(/^\*\*(.*?)\*\*/, '$1').trim();
        // Match A., (A), A)
        const optMatch = unboldedLine.match(/^[\(\[]?([A-D])[\)\]\.]?\s+(.*)$/i);
        if (optMatch) {
          options.push({
            label: optMatch[1].toUpperCase(),
            text: optMatch[2].trim(),
            correct: false
          });
        }
      }
      
      // Parse Correct Answer
      const answerMatch = qSplit.match(/(?:👉\s*)?\*\*Answer:\s*([A-D])\*\*/i);
      const correctAnswer = answerMatch ? answerMatch[1].toUpperCase() : '';
      options.forEach(opt => {
        if (opt.label === correctAnswer) {
          opt.correct = true;
        }
      });
      
      // Parse Explanation (consecutive quote block lines)
      const explanationLines = [];
      let inExplanation = false;
      for (const qLine of qLines) {
        const trimmed = qLine.trim();
        if (trimmed.startsWith('>')) {
          inExplanation = true;
          explanationLines.push(trimmed.replace(/^>\s*/, '').trim());
        } else if (inExplanation && trimmed !== '') {
          break;
        }
      }
      const explanation = explanationLines
        .join(' ')
        .replace(/^\*\*Explanation:\*\*\s*/i, '')
        .trim();
        
      questions.push({
        num: qNum,
        text: qText,
        options,
        explanation
      });
    }
    
    listeningGroups.push({
      id: key,
      range: `${startQ}–${endQ}`,
      startQ,
      endQ,
      transcript,
      questions
    });
  }
  
  // 2. Parse Reading Comprehension
  const readingGroupsMap = {};
  // Use multiline ^ to only match Level 3 headers starting at line boundaries
  const readingBlocks = readingSection.split(/^### \S+ Questions /m);
  
  for (let i = 1; i < readingBlocks.length; i++) {
    const block = readingBlocks[i];
    const lines = block.split('\n');
    const header = lines[0].trim();
    
    const rangeMatch = header.match(/^(\d+)[–-](\d+)\s*\((Original Exercise|Completed Version)\)/i);
    if (!rangeMatch) continue;
    
    const startQ = parseInt(rangeMatch[1]);
    const endQ = parseInt(rangeMatch[2]);
    const type = rangeMatch[3]; // "Original Exercise" or "Completed Version"
    const key = `${startQ}-${endQ}`;
    
    if (!readingGroupsMap[key]) {
      readingGroupsMap[key] = {
        id: `rc-${startQ}`,
        range: `${startQ}–${endQ}`,
        startQ,
        endQ,
        originalPassage: '',
        completedPassage: '',
        options: {},
        vocabulary: [],
        takeaways: []
      };
    }
    
    const groupData = readingGroupsMap[key];
    
    if (type === 'Original Exercise') {
      const passageLines = [];
      let inPassage = false;
      let optionsStartIndex = -1;
      
      for (let j = 1; j < lines.length; j++) {
        const line = lines[j].trim();
        if (line.startsWith('>')) {
          inPassage = true;
          passageLines.push(line.replace(/^>\s*/, ''));
        } else if (line.toLowerCase().startsWith('**options:**') || line.toLowerCase().startsWith('options:')) {
          optionsStartIndex = j;
          break;
        } else if (inPassage && line === '') {
          passageLines.push('');
        } else if (inPassage) {
          break;
        }
      }
      groupData.originalPassage = passageLines.join('\n').trim();
      
      if (optionsStartIndex !== -1) {
        const optionsText = lines.slice(optionsStartIndex + 1).join('\n');
        // Handle (131) or **(131)**
        const qOptsSplits = optionsText.split(/(?:\*\*\(|\()(\d+)(?:\)\*\*|\))/);
        
        for (let k = 1; k < qOptsSplits.length; k += 2) {
          const qNum = parseInt(qOptsSplits[k]);
          const qBody = qOptsSplits[k+1];
          const opts = [];
          const optLines = qBody.split('\n');
          for (const optLine of optLines) {
            const cleanedOpt = optLine.replace(/\r/g, '').trim();
            if (cleanedOpt === '') continue;
            
            const unboldedOpt = cleanedOpt.replace(/^\*\*(.*?)\*\*/, '$1').trim();
            const optMatch = unboldedOpt.match(/^[\(\[]?([A-D])[\)\]\.]?\s+(.*)$/i);
            if (optMatch) {
              opts.push({
                label: optMatch[1].toUpperCase(),
                text: optMatch[2].trim(),
                correct: false
              });
            }
          }
          groupData.options[qNum] = opts;
        }
      }
    } else if (type === 'Completed Version') {
      const passageLines = [];
      let inPassage = false;
      let vocabStartIndex = -1;
      let takeawaysStartIndex = -1;
      
      for (let j = 1; j < lines.length; j++) {
        const line = lines[j].trim();
        if (line.startsWith('>')) {
          inPassage = true;
          passageLines.push(line.replace(/^>\s*/, ''));
        } else if (line.toLowerCase().includes('vocabulary & analysis') || line.toLowerCase().includes('vocabulary')) {
          vocabStartIndex = j;
          break;
        } else if (line.toLowerCase().includes('key takeaways') || line.toLowerCase().includes('takeaways')) {
          takeawaysStartIndex = j;
          break;
        } else if (inPassage && line === '') {
          passageLines.push('');
        } else if (inPassage) {
          break;
        }
      }
      groupData.completedPassage = passageLines.join('\n').trim();
      
      let activeSection = null;
      for (let j = 1; j < lines.length; j++) {
        const line = lines[j].replace(/\r/g, '').trim();
        if (line.toLowerCase().includes('vocabulary & analysis') || line.toLowerCase().includes('vocabulary')) {
          activeSection = 'vocabulary';
          continue;
        } else if (line.toLowerCase().includes('key takeaways') || line.toLowerCase().includes('takeaways')) {
          activeSection = 'takeaways';
          continue;
        } else if (line.startsWith('---') || line.startsWith('###')) {
          activeSection = null;
        }
        
        if (activeSection === 'vocabulary') {
          const itemMatch = line.match(/^[-*+]\s*(.*?)$/) || line.match(/^\d+\.\s*(.*?)$/);
          if (itemMatch) {
            groupData.vocabulary.push(itemMatch[1].trim());
          }
        } else if (activeSection === 'takeaways') {
          const itemMatch = line.match(/^[-*+]\s*(.*?)$/) || line.match(/^\d+\.\s*(.*?)$/);
          if (itemMatch) {
            groupData.takeaways.push(itemMatch[1].trim());
          }
        }
      }
    }
  }
  
  // Resolve correct answers for Reading questions by comparing options to completed text
  Object.values(readingGroupsMap).forEach(group => {
    Object.keys(group.options).forEach(qStr => {
      const qNum = parseInt(qStr);
      const opts = group.options[qNum];
      
      // Match <u>Answer</u> (qNum) or **<u>Answer</u>** (qNum) or <u>Answer</u>(qNum)
      const regexStr = `(?:\\*\\%)?(?:\\*\\*)?<u>(.*?)</u>(?:\\*\\*)?\\s*\\(${qNum}\\)`;
      const regex = new RegExp(regexStr, 'i');
      const match = group.completedPassage.match(regex);
      
      if (match) {
        const correctText = cleanMarkdown(match[1]).toLowerCase();
        let foundCorrect = false;
        
        // Try exact match
        for (const opt of opts) {
          if (cleanMarkdown(opt.text).toLowerCase() === correctText) {
            opt.correct = true;
            foundCorrect = true;
            break;
          }
        }
        
        // Try substring match if exact fails
        if (!foundCorrect) {
          for (const opt of opts) {
            const cleanOpt = cleanMarkdown(opt.text).toLowerCase();
            if (cleanOpt.includes(correctText) || correctText.includes(cleanOpt)) {
              opt.correct = true;
              foundCorrect = true;
              break;
            }
          }
        }
      }
    });
  });
  
  // Flatten reading groups to array
  const readingGroups = Object.values(readingGroupsMap).map(group => {
    // Convert options map to list
    const questionsList = Object.keys(group.options).map(qStr => {
      const qNum = parseInt(qStr);
      return {
        num: qNum,
        options: group.options[qNum]
      };
    }).sort((a, b) => a.num - b.num);
    
    return {
      id: group.id,
      range: group.range,
      startQ: group.startQ,
      endQ: group.endQ,
      originalPassage: group.originalPassage,
      completedPassage: group.completedPassage,
      questions: questionsList,
      vocabulary: group.vocabulary,
      takeaways: group.takeaways
    };
  }).sort((a, b) => a.startQ - b.startQ);

  const graphics = findLessonGraphics(lessonId);
  
  return {
    id: lessonId,
    title,
    audio: findLessonAudio(lessonId),
    youtubeUrl: YOUTUBE_AUDIO_BY_LESSON[lessonId],
    graphics,
    listening: listeningGroups,
    reading: readingGroups
  };
}

function main() {
  if (!fs.existsSync(LESSONS_DIR)) {
    console.error(`Error: Lessons directory "${LESSONS_DIR}" does not exist.`);
    process.exit(1);
  }
  
  const files = fs.readdirSync(LESSONS_DIR)
    .filter(file => file.endsWith('.md'))
    .sort((a, b) => {
      const numA = parseInt(a.match(/(\d+)/)?.[0] || '0');
      const numB = parseInt(b.match(/(\d+)/)?.[0] || '0');
      return numA - numB;
    });
    
  console.log(`Found ${files.length} markdown lesson file(s).`);
  const lessons = [];
  
  for (const file of files) {
    const filePath = path.join(LESSONS_DIR, file);
    try {
      const parsed = parseLesson(filePath);
      if (parsed) {
        const validationErrors = validateLesson(parsed);
        if (validationErrors.length > 0) {
          throw new Error(`Validation failed:\n${validationErrors.map((error) => `  - ${error}`).join('\n')}`);
        }
        lessons.push(parsed);
      }
    } catch (err) {
      console.error(`Failed to parse ${file}:`, err);
    }
  }
  
  fs.writeFileSync(OUTPUT_FILE, JSON.stringify(lessons, null, 2), 'utf-8');
  console.log(`Successfully generated ${lessons.length} lessons in ${OUTPUT_FILE}`);
}

main();
