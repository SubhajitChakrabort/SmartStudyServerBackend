const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const db = require('../config/db');
const axios = require('axios');
const fs = require('fs');
const path = require('path');
const { createWorker } = require('tesseract.js'); // For OCR on images
const pdf = require('pdf-parse');

// Get all summary notes for the current user
router.get('/summaries', auth, (req, res) => {
  const userId = req.user.userId;
  const noteId = req.query.note_id;
  
  console.log(`Fetching note summaries for user ${userId}${noteId ? ` and note ${noteId}` : ''}`);
  
  let query = 'SELECT * FROM note_summaries WHERE user_id = ?';
  let params = [userId];
  
  if (noteId) {
    query += ' AND note_id = ?';
    params.push(noteId);
  }
  
  db.query(query, params, (err, results) => {
    if (err) {
      console.error('Error fetching note summaries:', err);
      return res.status(500).json({ error: err.message });
    }
    console.log(`Found ${results.length} note summaries`);
    res.json(results);
  });
});

// Get summary for a specific note
router.get('/summary/:noteId', auth, (req, res) => {
  const userId = req.user.userId;
  const noteId = req.params.noteId;
  
  console.log(`Fetching summary for note ${noteId} by user ${userId}`);
  
  db.query(
    'SELECT * FROM note_summaries WHERE note_id = ? AND user_id = ?',
    [noteId, userId],
    (err, results) => {
      if (err) {
        console.error('Error fetching note summary:', err);
        return res.status(500).json({ error: err.message });
      }
      
      if (results.length === 0) {
        return res.status(404).json({ error: 'Summary not found for this note' });
      }
      
      res.json(results[0]);
    }
  );
});

// Create or update a summary note
router.post('/summaries', auth, (req, res) => {
  const { note_id, content } = req.body;
  const userId = req.user.userId;
  
  console.log(`Attempting to save summary for note ${note_id} by user ${userId}`);
  
  if (!note_id || content === undefined) {
    return res.status(400).json({ error: 'Note ID and content are required' });
  }
  
  // Check if summary already exists
  db.query(
    'SELECT * FROM note_summaries WHERE note_id = ? AND user_id = ?',
    [note_id, userId],
    (err, results) => {
      if (err) {
        console.error('Error checking for existing summary:', err);
        return res.status(500).json({ error: err.message });
      }
      
      if (results.length > 0) {
        // Update existing summary
        console.log(`Updating existing summary for note ${note_id}`);
        db.query(
          'UPDATE note_summaries SET content = ? WHERE note_id = ? AND user_id = ?',
          [content, note_id, userId],
          (err) => {
            if (err) {
              console.error('Error updating summary:', err);
              return res.status(500).json({ error: err.message });
            }
            
            console.log('Summary updated successfully');
            res.json({ message: 'Summary updated successfully' });
          }
        );
      } else {
        // Create new summary
        console.log(`Creating new summary for note ${note_id}`);
        db.query(
          'INSERT INTO note_summaries (note_id, user_id, content) VALUES (?, ?, ?)',
          [note_id, userId, content],
          (err) => {
            if (err) {
              console.error('Error creating summary:', err);
              return res.status(500).json({ error: err.message });
            }
            
            console.log('Summary created successfully');
            res.status(201).json({ message: 'Summary created successfully' });
          }
        );
      }
    }
  );
});

// Modify the auto-summary endpoint to check multiple tables for notes
router.post('/auto-summary', auth, async (req, res) => {
  const { noteId } = req.body;
  const userId = req.user.userId;
  
  console.log(`Generating auto-summary for note ${noteId}`);
  
  if (!noteId) {
    return res.status(400).json({ error: 'Note ID is required' });
  }
  
  try {
    // First, try to find the note in teacher_uploads table
    db.query(
      'SELECT * FROM teacher_uploads WHERE id = ?',
      [noteId],
      async (err, results) => {
        if (err) {
          console.error('Error fetching note from teacher_uploads:', err);
          return res.status(500).json({ error: err.message });
        }
        
        // If note not found in teacher_uploads, check other possible tables
        if (results.length === 0) {
          console.log(`Note ${noteId} not found in teacher_uploads, checking other tables...`);
          
          // Try to find the note in notes table (if you have one)
          db.query(
            'SELECT * FROM notes WHERE id = ?',
            [noteId],
            async (err, noteResults) => {
              if (err) {
                console.error('Error fetching note from notes table:', err);
                return res.status(500).json({ error: err.message });
              }
              
              if (noteResults.length === 0) {
                // Log all tables to help debug
                db.query('SHOW TABLES', (err, tables) => {
                  if (err) {
                    console.error('Error showing tables:', err);
                  } else {
                    console.log('Available tables:', tables.map(t => Object.values(t)[0]));
                  }
                  
                  return res.status(404).json({ error: 'Note not found' });
                });
                return;
              }
              
              // Process note from notes table
              processAndGenerateAISummary(noteResults[0], userId, res);
            }
          );
        } else {
          // Process note from teacher_uploads table
          processAndGenerateAISummary(results[0], userId, res);
        }
      }
    );
  } catch (error) {
    console.error('Error generating summary:', error);
    res.status(500).json({ error: 'Failed to generate summary' });
  }
});

// Helper function to process note and generate summary
async function processAndGenerateAISummary(note, userId, res) {
  try {
    console.log(`Processing note: ${note.id}, title: ${note.title}, type: ${note.file_type}`);
    
    // Extract text based on file type
    let extractedText = '';
    let filePath = '';
    
    if (note.file_path) {
      filePath = path.join(__dirname, '..', note.file_path);
    }
    
    try {
      if (note.file_type === 'pdf' && fs.existsSync(filePath)) {
        // Extract text from PDF
        const dataBuffer = fs.readFileSync(filePath);
        const pdfData = await pdf(dataBuffer);
        extractedText = pdfData.text;
        console.log(`Extracted ${extractedText.length} characters from PDF`);
      } 
      else if (note.file_type === 'image' && fs.existsSync(filePath)) {
        // Extract text from image using OCR
        const worker = await createWorker();
        await worker.loadLanguage('eng');
        await worker.initialize('eng');
        const { data } = await worker.recognize(filePath);
        extractedText = data.text;
        await worker.terminate();
        console.log(`Extracted ${extractedText.length} characters from image using OCR`);
      }
      else if (note.file_type === 'video' && fs.existsSync(filePath)) {
        // For videos, we'll use the title and description as context
        console.log('Skipping video transcription due to API limitations');
        extractedText = `Video Title: ${note.title}\n\nVideo content could not be transcribed due to API limitations.`;
      }
    } catch (extractionError) {
      console.error('Error extracting content:', extractionError);
      extractedText = `Error extracting content: ${extractionError.message}`;
    }
    
    // If we couldn't extract meaningful text, use metadata
    if (!extractedText || extractedText.trim().length < 50) {
      extractedText = `Title: ${note.title}\nSubject: ${note.subject_name || 'Not specified'}\nDescription: ${note.description || 'No description provided'}`;
      console.log('Using metadata as fallback for content extraction');
    }
    
    // Generate summary using our manual algorithm instead of AI
    console.log('Generating manual summary instead of using OpenAI API');
    const summary = generateManualSummary(extractedText, note.file_type, note.title);
    
    // Save the summary
    saveOrUpdateSummary(note.id, userId, summary, (err) => {
      if (err) {
        console.error('Error saving summary:', err);
        return res.status(500).json({ error: err.message });
      }
      
      res.json({ 
        message: 'Summary generated successfully', 
        summary 
      });
    });
  } catch (error) {
    console.error('Error processing note:', error);
    
    // Create a fallback summary with error information
    const errorSummary = `## Error Processing Content\n\nThere was an error processing this content: ${error.message}\n\n### Content Information\n- Title: ${note.title || 'Unknown'}\n- Type: ${note.file_type || 'Unknown'}\n\n---\n*Please create a manual summary for this content.*`;
    
    saveOrUpdateSummary(note.id, userId, errorSummary, (err) => {
      if (err) {
        console.error('Error saving error summary:', err);
        return res.status(500).json({ error: err.message });
      }
      
      res.json({ 
        message: 'Generated error summary', 
        summary: errorSummary,
        error: 'Content processing failed, but a placeholder summary was created.'
      });
    });
  }
}

// Enhanced manual summary generator that works without OpenAI
function generateManualSummary(content, contentType, title) {
  console.log(`Generating enhanced manual summary for ${contentType}`);
  
  // Clean the text and prepare it for processing
  const cleanText = content.replace(/\s+/g, ' ').trim();
  
  // Split into sentences
  const sentences = cleanText.match(/[^\.!\?]+[\.!\?]+/g) || [];
  
  // If we couldn't extract sentences, use a basic approach
  if (sentences.length === 0) {
    return generateBasicSummary(content, contentType, title);
  }
  
  // Calculate word frequency (TF - Term Frequency)
  const wordFrequency = {};
  const stopWords = new Set(['a', 'an', 'the', 'and', 'or', 'but', 'is', 'are', 'was', 'were', 
    'in', 'on', 'at', 'to', 'for', 'with', 'by', 'about', 'as', 'of', 'that', 'this', 'these', 
    'those', 'it', 'its', 'they', 'them', 'their', 'we', 'our', 'you', 'your', 'he', 'she', 'his', 'her']);
  
  const words = cleanText.toLowerCase().match(/\b[a-z\d]+\b/g) || [];
  
  words.forEach(word => {
    if (word.length > 2 && !stopWords.has(word)) { // Ignore stop words and very short words
      wordFrequency[word] = (wordFrequency[word] || 0) + 1;
    }
  });
  
  // Find the most frequent words (keywords)
  const sortedWords = Object.entries(wordFrequency)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(entry => entry[0]);
  
  // Score sentences based on:
  // 1. Position in the text (earlier sentences often contain key information)
  // 2. Presence of keywords
  // 3. Sentence length (not too short, not too long)
  const sentenceScores = sentences.map((sentence, index) => {
    const sentenceWords = sentence.toLowerCase().match(/\b[a-z\d]+\b/g) || [];
    let score = 0;
    
    // Position score - earlier sentences get higher scores
    score += Math.max(0, 1 - (index / Math.min(10, sentences.length)));
    
    // Keyword score
    let keywordCount = 0;
    sentenceWords.forEach(word => {
      if (sortedWords.includes(word)) {
        keywordCount++;
      }
    });
    score += keywordCount / Math.max(1, sentenceWords.length) * 2;
    
    // Length score - penalize very short or very long sentences
    const lengthScore = sentenceWords.length > 5 && sentenceWords.length < 25 ? 
      0.5 : (sentenceWords.length >= 25 ? 0.3 : 0);
    score += lengthScore;
    
    // Bonus for sentences that might be headings or contain structural cues
    if (/^(chapter|section|introduction|conclusion|summary|overview|key|important)/i.test(sentence)) {
      score += 0.5;
    }
    
    return { sentence, score, index };
  });
  
  // Sort sentences by score and take top N
  const numSentences = Math.min(5, Math.max(3, Math.ceil(sentences.length / 10)));
  let topSentences = sentenceScores
    .sort((a, b) => b.score - a.score)
    .slice(0, numSentences);
  
  // Re-sort by original position to maintain logical flow
  topSentences = topSentences.sort((a, b) => a.index - b.index);
  
  // Format the summary
  const summaryText = topSentences.map(item => item.sentence.trim()).join(' ');
  
  // Extract metadata for additional context
  const metadata = {
    title: title || 'Untitled',
    keyTerms: sortedWords.slice(0, 5).join(', '),
    contentLength: content.length,
    sentenceCount: sentences.length
  };
  
  // Create formatted summary based on content type
  switch (contentType) {
    case 'pdf':
      return `## PDF Document Summary: ${metadata.title}

${summaryText}

### Key Terms
${sortedWords.slice(0, 5).map(term => `- ${term}`).join('\n')}

---

*This summary was generated using an extractive summarization algorithm. The document contains approximately ${sentences.length} sentences.*`;
case 'image':
  return `## Image Content Summary: ${metadata.title}

${summaryText}

### Key Terms
${sortedWords.slice(0, 5).map(term => `- ${term}`).join('\n')}

---

*This summary was generated from text extracted from the image using OCR technology.*`;

case 'video':
  return `## Video Content Summary: ${metadata.title}

${summaryText}

### Key Terms
${sortedWords.slice(0, 5).map(term => `- ${term}`).join('\n')}

---

*This summary was generated from the video's metadata.*`;

default:
  return `## Content Summary: ${metadata.title}

${summaryText}

### Key Terms
${sortedWords.slice(0, 5).map(term => `- ${term}`).join('\n')}

---

*This summary was automatically generated using an extractive summarization algorithm.*`;
}
}

// Fallback for when we can't extract proper sentences
function generateBasicSummary(content, contentType, title) {
// Extract some basic information
const contentPreview = content.substring(0, 300).replace(/\n+/g, ' ').trim() + '...';
const wordCount = (content.match(/\b\w+\b/g) || []).length;

switch (contentType) {
case 'pdf':
  return `## PDF Document Summary: ${title}

This PDF document contains approximately ${wordCount} words.

### Content Preview
${contentPreview}

---

*A detailed summary could not be automatically generated. Please review the content manually.*`;

case 'image':
  return `## Image Content Summary: ${title}

This image contains text with approximately ${wordCount} words.

### Content Preview
${contentPreview}

---

*A detailed summary could not be automatically generated from the image text. Please review the content manually.*`;

case 'video':
  return `## Video Content Summary: ${title}

This video's metadata contains approximately ${wordCount} words.

### Content Preview
${contentPreview}

---

*A detailed summary could not be automatically generated from the video metadata. Please review the content manually.*`;

default:
  return `## Content Summary: ${title}

This content contains approximately ${wordCount} words.

### Content Preview
${contentPreview}

---

*A detailed summary could not be automatically generated. Please review the content manually.*`;
}
}

// Helper function to save or update summary
function saveOrUpdateSummary(noteId, userId, content, callback) {
// Check if summary already exists
db.query(
'SELECT * FROM note_summaries WHERE note_id = ? AND user_id = ?',
[noteId, userId],
(err, results) => {
  if (err) return callback(err);
  
  if (results.length > 0) {
    // Update existing summary
    db.query(
      'UPDATE note_summaries SET content = ?, updated_at = NOW() WHERE note_id = ? AND user_id = ?',
      [content, noteId, userId],
      callback
    );
  } else {
    // Create new summary
    db.query(
      'INSERT INTO note_summaries (note_id, user_id, content, created_at, updated_at) VALUES (?, ?, ?, NOW(), NOW())',
      [noteId, userId, content],
      callback
    );
  }
}
);
}

module.exports = router;
