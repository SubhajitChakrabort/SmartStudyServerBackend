const db = require('../config/db');

// Get user's study folders
exports.getStudyFolders = async (req, res) => {
  try {
    // Check if user is authenticated
    if (!req.user || !req.user.userId) {
      return res.status(401).json({ message: 'User not authenticated' });
    }
    
    const userId = req.user.userId;
    
    // Check if study_folders table exists, if not create it
    db.query(`
      CREATE TABLE IF NOT EXISTS study_folders (
        id INT AUTO_INCREMENT PRIMARY KEY,
        user_id INT NOT NULL,
        name VARCHAR(255) NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      )
    `, (err) => {
      if (err) {
        return res.status(500).json({ error: err.message });
      }
      
      // Check if folder_notes table exists, if not create it
      db.query(`
        CREATE TABLE IF NOT EXISTS folder_notes (
          id INT AUTO_INCREMENT PRIMARY KEY,
          folder_id INT NOT NULL,
          note_id INT NOT NULL,
          added_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (folder_id) REFERENCES study_folders(id) ON DELETE CASCADE,
          FOREIGN KEY (note_id) REFERENCES notes(id) ON DELETE CASCADE
        )
      `, (err) => {
        if (err) {
          return res.status(500).json({ error: err.message });
        }
        
        // Get user's folders
        db.query('SELECT * FROM study_folders WHERE user_id = ? ORDER BY created_at DESC', [userId], (err, results) => {
          if (err) {
            return res.status(500).json({ error: err.message });
          }
          
          res.json(results);
        });
      });
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Create a new study folder
exports.createStudyFolder = async (req, res) => {
  try {
    // Check if user is authenticated
    if (!req.user || !req.user.userId) {
      return res.status(401).json({ message: 'User not authenticated' });
    }
    
    const userId = req.user.userId;
    const { name } = req.body;
    
    if (!name) {
      return res.status(400).json({ error: 'Folder name is required' });
    }
    
    db.query('INSERT INTO study_folders (user_id, name) VALUES (?, ?)', [userId, name], (err, result) => {
      if (err) {
        return res.status(500).json({ error: err.message });
      }
      
      res.status(201).json({
        message: 'Folder created successfully',
        id: result.insertId,
        name
      });
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};
