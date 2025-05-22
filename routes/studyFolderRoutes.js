const express = require('express');
const router = express.Router();
const studyFolderController = require('../controllers/studyFolderController');
const auth = require('../middleware/auth');

router.get('/', auth, studyFolderController.getStudyFolders);
router.post('/', auth, studyFolderController.createStudyFolder);
router.get('/', auth, (req, res) => {
    const userId = req.user.userId;
    
    db.query(
      'SELECT * FROM study_folders WHERE user_id = ?',
      [userId],
      (err, results) => {
        if (err) {
          return res.status(500).json({ error: err.message });
        }
        res.json(results);
      }
    );
  });
  
  // Create a new study folder
  router.post('/', auth, (req, res) => {
    const { name } = req.body;
    const userId = req.user.userId;
    
    if (!name) {
      return res.status(400).json({ error: 'Folder name is required' });
    }
    
    db.query(
      'INSERT INTO study_folders (name, user_id) VALUES (?, ?)',
      [name, userId],
      (err, result) => {
        if (err) {
          return res.status(500).json({ error: err.message });
        }
        
        res.status(201).json({
          id: result.insertId,
          name,
          message: 'Folder created successfully'
        });
      }
    );
  });
  
 // Add a note to a folder - FIXED to handle notes from different tables
router.post('/add-note', auth, (req, res) => {
  const { folderId, noteId } = req.body;
  const userId = req.user.userId;
  
  console.log(`Attempting to add note ${noteId} to folder ${folderId} for user ${userId}`);
  
  if (!folderId || !noteId) {
    return res.status(400).json({ error: 'Folder ID and Note ID are required' });
  }
  
  // First check if the folder belongs to the user
  db.query(
    'SELECT * FROM study_folders WHERE id = ? AND user_id = ?',
    [folderId, userId],
    (err, results) => {
      if (err) {
        console.error('Error checking folder ownership:', err);
        return res.status(500).json({ error: err.message });
      }
      
      if (results.length === 0) {
        return res.status(403).json({ error: 'You do not have permission to access this folder' });
      }
      
      // Skip the note existence check and directly add to folder
      // This assumes the note ID is valid and will be handled by foreign key constraints if not
      db.query(
        'INSERT INTO folder_notes (folder_id, note_id) VALUES (?, ?)',
        [folderId, noteId],
        (err, result) => {
          if (err) {
            console.error('Error adding note to folder:', err);
            
            // Check if this is a foreign key constraint error
            if (err.code === 'ER_NO_REFERENCED_ROW_2' || err.message.includes('foreign key constraint fails')) {
              return res.status(404).json({ 
                error: 'Note not found',
                details: 'The note ID does not exist in the database'
              });
            }
            
            return res.status(500).json({ error: err.message });
          }
          
          console.log(`Successfully added note ${noteId} to folder ${folderId}`);
          res.status(201).json({
            message: 'Note added to folder successfully',
            folder_id: folderId,
            note_id: noteId,
            entry_id: result.insertId
          });
        }
      );
    }
  );
});


  // Get all notes in a folder
 // Get all notes in a folder - UPDATED to check multiple tables
router.get('/:folderId/notes', auth, (req, res) => {
  const { folderId } = req.params;
  const userId = req.user.userId;
  
  console.log(`Fetching notes for folder ${folderId} for user ${userId}`);
  
  // First check if the folder belongs to the user
  db.query(
    'SELECT * FROM study_folders WHERE id = ? AND user_id = ?',
    [folderId, userId],
    (err, results) => {
      if (err) {
        console.error('Error checking folder ownership:', err);
        return res.status(500).json({ error: err.message });
      }
      
      if (results.length === 0) {
        return res.status(403).json({ error: 'You do not have permission to access this folder' });
      }
      
      // Get all note IDs in the folder
      db.query(
        'SELECT note_id FROM folder_notes WHERE folder_id = ?',
        [folderId],
        (err, folderNoteResults) => {
          if (err) {
            console.error('Error fetching folder_notes entries:', err);
            return res.status(500).json({ error: err.message });
          }
          
          console.log(`Found ${folderNoteResults.length} folder_notes entries for folder ${folderId}`);
          
          if (folderNoteResults.length === 0) {
            return res.json([]);
          }
          
          // Extract note IDs
          const noteIds = folderNoteResults.map(fn => fn.note_id);
          console.log('Note IDs in folder:', noteIds);
          
          // Try to find notes in teacher_uploads table first
          const placeholders = noteIds.map(() => '?').join(',');
          db.query(
            `SELECT * FROM teacher_uploads WHERE id IN (${placeholders})`,
            noteIds,
            (err, teacherUploadResults) => {
              if (err) {
                console.error('Error fetching from teacher_uploads:', err);
                return res.status(500).json({ error: err.message });
              }
              
              console.log(`Found ${teacherUploadResults.length} notes in teacher_uploads table`);
              
              // If we found all notes in teacher_uploads, return them
              if (teacherUploadResults.length === noteIds.length) {
                return res.json(teacherUploadResults);
              }
              
              // If not all notes were found, try the notes table
              db.query(
                `SELECT * FROM notes WHERE id IN (${placeholders})`,
                noteIds,
                (err, notesResults) => {
                  // Ignore errors, just check if we got results
                  if (!err && notesResults && notesResults.length > 0) {
                    console.log(`Found ${notesResults.length} notes in notes table`);
                    
                    // Combine results from both tables
                    const combinedResults = [...teacherUploadResults];
                    
                    // Only add notes that weren't already found in teacher_uploads
                    const foundIds = new Set(teacherUploadResults.map(note => note.id));
                    notesResults.forEach(note => {
                      if (!foundIds.has(note.id)) {
                        combinedResults.push(note);
                      }
                    });
                    
                    console.log(`Returning ${combinedResults.length} combined notes`);
                    return res.json(combinedResults);
                  }
                  
                  // If we still don't have all notes, try one more generic approach
                  // Query all tables that might contain notes
                  db.query(
                    "SHOW TABLES LIKE '%notes%' OR TABLES LIKE '%uploads%'",
                    (err, tableResults) => {
                      if (err || tableResults.length === 0) {
                        // If we can't find more tables, return what we have so far
                        return res.json(teacherUploadResults);
                      }
                      
                      // Extract table names, excluding the ones we already checked
                      const tables = tableResults
                        .map(row => Object.values(row)[0])
                        .filter(table => !['teacher_uploads', 'notes', 'folder_notes'].includes(table));
                      
                      console.log('Checking additional tables:', tables);
                      
                      if (tables.length === 0) {
                        return res.json(teacherUploadResults);
                      }
                      
                      // Prepare to collect notes from all tables
                      let allNotes = [...teacherUploadResults];
                      let completedQueries = 0;
                      const foundIds = new Set(teacherUploadResults.map(note => note.id));
                      
                      // Query each table
                      tables.forEach(table => {
                        db.query(
                          `SELECT * FROM ${table} WHERE id IN (${placeholders})`,
                          noteIds,
                          (err, results) => {
                            completedQueries++;
                            
                            if (!err && results && results.length > 0) {
                              console.log(`Found ${results.length} notes in ${table}`);
                              
                              // Add only notes that weren't already found
                              results.forEach(note => {
                                if (!foundIds.has(note.id)) {
                                  foundIds.add(note.id);
                                  allNotes.push(note);
                                }
                              });
                            }
                            
                            // When all queries are done, return the combined results
                            if (completedQueries === tables.length) {
                              console.log(`Returning ${allNotes.length} total notes from all tables`);
                              res.json(allNotes);
                            }
                          }
                        );
                      });
                    }
                  );
                }
              );
            }
          );
        }
      );
    }
  );
});


  // Delete a study folder
router.delete('/:folderId', auth, (req, res) => {
    const { folderId } = req.params;
    const userId = req.user.userId;
    
    // Check if the folder belongs to the user
    db.query(
      'SELECT * FROM study_folders WHERE id = ? AND user_id = ?',
      [folderId, userId],
      (err, results) => {
        if (err) {
          return res.status(500).json({ error: err.message });
        }
        
        if (results.length === 0) {
          return res.status(403).json({ error: 'You do not have permission to delete this folder' });
        }
        
        // Delete the folder (cascade will delete folder_notes entries)
        db.query(
          'DELETE FROM study_folders WHERE id = ?',
          [folderId],
          (err) => {
            if (err) {
              return res.status(500).json({ error: err.message });
            }
            
            res.json({ message: 'Folder deleted successfully' });
          }
        );
      }
    );
  });
  // Get all notes in a folder
router.get('/:folderId/notes', auth, (req, res) => {
  const { folderId } = req.params;
  const userId = req.user.userId;
  
  // First check if the folder belongs to the user
  db.query(
    'SELECT * FROM study_folders WHERE id = ? AND user_id = ?',
    [folderId, userId],
    (err, results) => {
      if (err) {
        return res.status(500).json({ error: err.message });
      }
      
      if (results.length === 0) {
        return res.status(403).json({ error: 'You do not have permission to access this folder' });
      }
      
      // Get all notes in the folder - FIXED QUERY
      db.query(
        `SELECT tu.* 
         FROM teacher_uploads tu
         JOIN folder_notes fn ON tu.id = fn.note_id
         WHERE fn.folder_id = ?`,
        [folderId],
        (err, results) => {
          if (err) {
            return res.status(500).json({ error: err.message });
          }
          
          console.log(`Found ${results.length} notes in folder ${folderId}`);
          res.json(results);
        }
      );
    }
  );
});

module.exports = router;
