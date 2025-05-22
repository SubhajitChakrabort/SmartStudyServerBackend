const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const db = require('../config/db');

// Get all teacher uploads
router.get('/', auth, (req, res) => {
  // First try to get notes from teacher_uploads
  db.query(
    'SELECT * FROM teacher_uploads ORDER BY created_at DESC',
    (err, results) => {
      if (err) {
        console.error('Error fetching teacher uploads:', err);
        return res.status(500).json({ error: err.message });
      }
      
      console.log(`Found ${results.length} notes in teacher_uploads table`);
      
      // If no results found, check if there's another table that might contain notes
      if (results.length === 0) {
        // Check if notes table exists
        db.query(
          "SHOW TABLES LIKE 'notes'",
          (err, tableResults) => {
            if (err || tableResults.length === 0) {
              // No notes table, just return empty array
              return res.json([]);
            }
            
            // Notes table exists, query it
            db.query(
              'SELECT * FROM notes ORDER BY created_at DESC',
              (err, noteResults) => {
                if (err) {
                  console.error('Error fetching from notes table:', err);
                  return res.json([]); // Return empty array on error
                }
                
                console.log(`Found ${noteResults.length} notes in notes table`);
                res.json(noteResults);
              }
            );
          }
        );
      } else {
        res.json(results);
      }
    }
  );
});

// Add a new endpoint to get all notes from any table
router.get('/all-notes', auth, (req, res) => {
  console.log('Fetching all notes from all possible tables');
  
  // Query to get all possible note tables
  db.query(
    "SHOW TABLES LIKE '%notes%' OR TABLES LIKE '%uploads%'",
    (err, tableResults) => {
      if (err) {
        console.error('Error checking for note tables:', err);
        return res.status(500).json({ error: err.message });
      }
      
      // If no tables found
      if (tableResults.length === 0) {
        return res.json([]);
      }
      
      // Extract table names
      const tables = tableResults.map(row => Object.values(row)[0]);
      console.log('Found potential note tables:', tables);
      
      // Prepare to collect notes from all tables
      let allNotes = [];
      let completedQueries = 0;
      
      // Query each table
      tables.forEach(table => {
        db.query(
          `SELECT *, '${table}' as source_table FROM ${table}`,
          (err, results) => {
            completedQueries++;
            
            if (!err && results.length > 0) {
              console.log(`Found ${results.length} notes in ${table}`);
              allNotes = allNotes.concat(results);
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
});

module.exports = router;
