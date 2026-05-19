import fs from 'fs';
import path from 'path';

const LESSONS_DIR = './lessons';
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
  const listeningStart = content.indexOf('## 🎧 Part 3: Listening Comprehension');
  const readingStart = content.indexOf('## 📖 Part 6-7: Reading Comprehension');
  
  if (listeningStart === -1 || readingStart === -1) {
    console.warn(`Warning: Missing core sections in ${filename}`);
    return null;
  }
  
  const listeningSection = content.substring(listeningStart, readingStart);
  const readingSection = content.substring(readingStart);
  
  // 1. Parse Listening Comprehension
  const listeningGroups = [];
  // Use multiline ^ to only match Level 3 headers starting at line boundaries
  const listeningBlocks = listeningSection.split(/^### \S+ Questions /m);
  
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
    
    const transcriptIndex = block.indexOf('#### 📝 Questions & Answers');
    if (transcriptIndex === -1) continue;
    
    // Parse Transcript
    const transcriptText = block.substring(0, transcriptIndex);
    const transcriptLines = transcriptText.split('\n');
    const transcript = [];
    let currentSpeaker = null;
    let currentText = [];
    
    for (const line of transcriptLines) {
      const trimmed = line.replace(/\r/g, '').trim();
      const speakerMatch = trimmed.match(/^\*\*\[(.*?)\]\*\*/);
      if (speakerMatch) {
        if (currentSpeaker) {
          transcript.push({
            speaker: currentSpeaker,
            text: currentText.join(' ').replace(/\s+/g, ' ').trim()
          });
        }
        currentSpeaker = speakerMatch[1];
        currentText = [trimmed.replace(/^\*\*\[.*?\]\*\*\s*/, '')];
      } else if (currentSpeaker && trimmed !== '') {
        currentText.push(trimmed);
      }
    }
    if (currentSpeaker) {
      transcript.push({
        speaker: currentSpeaker,
        text: currentText.join(' ').replace(/\s+/g, ' ').trim()
      });
    }
    
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
      const answerMatch = qSplit.match(/👉\s*\*\*Answer:\s*([A-D])\*\*/i);
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
  
  return {
    id: lessonId,
    title,
    audio: `audio/lesson${lessonId}.mp3`,
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
