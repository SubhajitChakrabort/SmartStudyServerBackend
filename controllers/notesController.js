const fs = require('fs');
const fsPromises = require('fs').promises;
const path = require('path');
const PDFDocument = require('pdfkit');
const db = require('../config/db');

const getNotes = async (req, res) => {
  try {
    const userId = req.user.userId;
    const query = 'SELECT * FROM notes WHERE user_id = ? ORDER BY created_at DESC';
    
    db.query(query, [userId], (err, results) => {
      if (err) {
        return res.status(500).json({ error: err.message });
      }
      res.json(results);
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

const createNote = async (req, res) => {
  try {
    const { subjectName, title, content } = req.body;
    const userId = req.user.userId;
    
    const query = 'INSERT INTO notes (user_id, subject_name, title, content) VALUES (?, ?, ?, ?)';
    
    db.query(query, [userId, subjectName, title, content], (err, result) => {
      if (err) {
        return res.status(400).json({ error: err.message });
      }
      res.status(201).json({ 
        message: 'Note created successfully',
        noteId: result.insertId 
      });
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

const updateNote = async (req, res) => {
  try {
    const { subjectName, title, content } = req.body;
    const noteId = req.params.id;
    const userId = req.user.userId;
    
    const query = 'UPDATE notes SET subject_name = ?, title = ?, content = ? WHERE id = ? AND user_id = ?';
    
    db.query(query, [subjectName, title, content, noteId, userId], (err, result) => {
      if (err) {
        return res.status(400).json({ error: err.message });
      }
      if (result.affectedRows === 0) {
        return res.status(404).json({ error: 'Note not found or unauthorized' });
      }
      res.json({ message: 'Note updated successfully' });
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

const deleteNote = async (req, res) => {
  try {
    const noteId = req.params.id;
    const userId = req.user.userId;
    
    const query = 'DELETE FROM notes WHERE id = ? AND user_id = ?';
    
    db.query(query, [noteId, userId], (err, result) => {
      if (err) {
        return res.status(400).json({ error: err.message });
      }
      if (result.affectedRows === 0) {
        return res.status(404).json({ error: 'Note not found or unauthorized' });
      }
      res.json({ message: 'Note deleted successfully' });
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

const savePDF = async (req, res) => {
  try {
    const userId = req.user.userId;
    const { subjectName, title, content } = req.body;

    // Clean the content by removing HTML entities and special characters
    const cleanContent = content
      .replace(/&nbsp;/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/<[^>]*>/g, '')
      .trim();

    // Create study folder structure
    const baseDir = path.join(__dirname, '..', 'uploads', 'study', userId.toString());
    const subjectDir = path.join(baseDir, subjectName);
    await fsPromises.mkdir(subjectDir, { recursive: true });

    // Create PDF with enhanced styling
    const doc = new PDFDocument();
    const pdfPath = path.join(subjectDir, `${title}.pdf`);
    const writeStream = fs.createWriteStream(pdfPath);
    doc.pipe(writeStream);

    // Add header with styling
    doc.font('Helvetica-Bold')
       .fontSize(24)
       .fillColor('#333')
       .text(title, { align: 'center' });

    doc.moveDown();
    doc.font('Helvetica-Oblique')
       .fontSize(18)
       .fillColor('#666')
       .text(`Subject: ${subjectName}`, { align: 'center' });

    doc.moveDown(2);
    doc.font('Helvetica')
       .fontSize(12)
       .fillColor('#000')
       .text(cleanContent, {
         align: 'justify',
         lineGap: 10,
         paragraphGap: 15,
         columns: 1
       });

    doc.end();

    await new Promise(resolve => writeStream.on('finish', resolve));

    // Save to database
    const query = 'INSERT INTO study_materials (user_id, subject_name, title, file_path) VALUES (?, ?, ?, ?)';
    db.query(query, [userId, subjectName, title, pdfPath], (err, result) => {
      if (err) {
        return res.status(400).json({ error: err.message });
      }
      res.json({ 
        message: 'PDF saved successfully',
        filePath: pdfPath
      });
    });

  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Get all teachers' notes (public ones)
const getTeachersNotes = async (req, res) => {
  try {
    // Check if user is authenticated
    if (!req.user || !req.user.userId) {
      return res.status(401).json({ message: 'User not authenticated' });
    }
    
    // Get all public notes from teachers (assuming teachers have role field in users table)
    const query = `
      SELECT n.*, u.name as teacher_name
      FROM notes n
      JOIN users u ON n.user_id = u.id
      WHERE u.role = 'teacher' AND n.is_public = 1
      ORDER BY n.created_at DESC
    `;
    
    db.query(query, (err, results) => {
      if (err) {
        return res.status(500).json({ error: err.message });
      }
      res.json(results);
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};


// Get all subjects and semesters
const getSubjectsAndSemesters = async (req, res) => {
  try {
    // Get unique subjects
    const subjectsQuery = `SELECT DISTINCT subject_name as subject FROM notes WHERE is_public = 1`;
    
    // Get unique semesters
    const semestersQuery = `SELECT DISTINCT semester FROM notes WHERE is_public = 1`;
    
    db.query(subjectsQuery, (err, subjectsResult) => {
      if (err) {
        return res.status(500).json({ error: err.message });
      }
      
      db.query(semestersQuery, (err, semestersResult) => {
        if (err) {
          return res.status(500).json({ error: err.message });
        }
        
        const subjects = subjectsResult.map(row => row.subject).filter(Boolean);
        const semesters = semestersResult.map(row => row.semester).filter(Boolean);
        
        res.json({
          subjects,
          semesters
        });
      });
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};
// Save a note to a study folder
const saveNoteToFolder = async (req, res) => {
  try {
    const userId = req.user.userId;
    const { folderId, noteId } = req.body;
    
    if (!folderId || !noteId) {
      return res.status(400).json({ error: 'Folder ID and Note ID are required' });
    }
    
    // Check if the folder belongs to the user
    const folderQuery = 'SELECT * FROM study_folders WHERE id = ? AND user_id = ?';
    
    db.query(folderQuery, [folderId, userId], (err, folderResults) => {
      if (err) {
        return res.status(500).json({ error: err.message });
      }
      
      if (folderResults.length === 0) {
        return res.status(404).json({ error: 'Folder not found or unauthorized' });
      }
      
      // Check if the note exists and is public
      const noteQuery = `
        SELECT * FROM notes 
        WHERE id = ? AND (user_id = ? OR is_public = 1)
      `;
      
      db.query(noteQuery, [noteId, userId], (err, noteResults) => {
        if (err) {
          return res.status(500).json({ error: err.message });
        }
        
        if (noteResults.length === 0) {
          return res.status(404).json({ error: 'Note not found or unauthorized' });
        }
        
        // Check if the note is already in the folder
        const checkQuery = 'SELECT * FROM folder_notes WHERE folder_id = ? AND note_id = ?';
        
        db.query(checkQuery, [folderId, noteId], (err, checkResults) => {
          if (err) {
            return res.status(500).json({ error: err.message });
          }
          
          if (checkResults.length > 0) {
            return res.status(400).json({ error: 'Note is already in this folder' });
          }
          
          // Add the note to the folder
          const insertQuery = 'INSERT INTO folder_notes (folder_id, note_id, added_at) VALUES (?, ?, NOW())';
          
          db.query(insertQuery, [folderId, noteId], (err, result) => {
            if (err) {
              return res.status(500).json({ error: err.message });
            }
            
            res.status(201).json({ 
              message: 'Note added to folder successfully',
              id: result.insertId
            });
          });
        });
      });
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

module.exports = {
  getNotes,
  createNote,
  updateNote,
  deleteNote,
  savePDF,
  getTeachersNotes,
  getSubjectsAndSemesters,
  saveNoteToFolder
};
