// Add these routes to your existing noteRoutes.js file

// Get all summary notes for the current user
router.get('/summaries', auth, (req, res) => {
    const userId = req.user.userId;
    
    console.log(`Fetching note summaries for user ${userId}`);
    
    db.query(
      'SELECT * FROM note_summaries WHERE user_id = ?',
      [userId],
      (err, results) => {
        if (err) {
          console.error('Error fetching note summaries:', err);
          return res.status(500).json({ error: err.message });
        }
        console.log(`Found ${results.length} note summaries`);
        res.json(results);
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
  