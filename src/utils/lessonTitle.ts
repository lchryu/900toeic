export const formatLessonTitle = (title: string) => {
  const cleanedTitle = title
    .replace(/^\S+\s+(?=Lesson\b)/, '')
    .replace(/\bLesson\s*/i, '')
    .replace(/\s+\u2013\s+/g, ' - ')
    .trim();
  const homeworkMatch = cleanedTitle.match(/^(\d+)\s*[-\u2013]?\s*Homework$/i);

  if (homeworkMatch) {
    return `${homeworkMatch[1]} - Homework`;
  }

  return cleanedTitle;
};
