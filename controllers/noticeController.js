const db = require('../config/db');
const path = require('path');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');

// Get all notices
exports.getNotices = async (req, res) => {
  try {
    // Check if user is authenticated
    if (!req.user || !req.user.userId) {
      return res.status(401).json({ message: 'User not authenticated' });
    }
    
    const userId = req.user.userId;
    
    // For teachers, get only their notices
    // For students, get all public notices
    let query;
    let queryParams;
    
    if (req.user.role === 'teacher') {
      query = 'SELECT * FROM notices WHERE user_id = ? ORDER BY created_at DESC';
      queryParams = [userId];
    } else {
      query = 'SELECT n.*, u.name as teacher_name FROM notices n JOIN users u ON n.user_id = u.id ORDER BY n.created_at DESC';
      queryParams = [];
    }
    
    db.query(query, queryParams, (err, results) => {
      if (err) {
        return res.status(500).json({ error: err.message });
      }
      res.json(results);
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Create a new notice
// exports.createNotice = async (req, res) => {
//   try {
//     // Check if user is authenticated and is a teacher
//     if (!req.user || !req.user.userId || req.user.role !== 'teacher') {
//       return res.status(401).json({ message: 'Unauthorized' });
//     }
    
//     const userId = req.user.userId;
//     const { title, description } = req.body;
    
//     // Validate required fields
//     if (!title) {
//       return res.status(400).json({ message: 'Title is required' });
//     }
    
//     // Check if file exists
//     if (!req.files || !req.files.file) {
//       return res.status(400).json({ message: 'No file uploaded' });
//     }
    
//     const file = req.files.file;
//     const fileExtension = path.extname(file.name).toLowerCase();
    
//     // Determine file type
//     let fileType;
//     if (['.pdf'].includes(fileExtension)) {
//       fileType = 'pdf';
//     } else if (['.doc', '.docx'].includes(fileExtension)) {
//       fileType = 'doc';
//     } else if (['.jpg', '.jpeg', '.png', '.gif'].includes(fileExtension)) {
//       fileType = 'image';
//     } else if (['.txt'].includes(fileExtension)) {
//       fileType = 'text';
//     } else {
//       return res.status(400).json({ message: 'Unsupported file type' });
//     }
    
//     // Create upload directory if it doesn't exist
//     const uploadDir = path.join(__dirname, '../uploads/notices');
//     if (!fs.existsSync(uploadDir)) {
//       fs.mkdirSync(uploadDir, { recursive: true });
//     }
    
//     // Generate unique filename
//     const uniqueFilename = `notice_${userId}_${uuidv4()}${fileExtension}`;
//     const uploadPath = path.join(uploadDir, uniqueFilename);
//     const filePath = `/uploads/notices/${uniqueFilename}`;
    
//     // Move the file
//     await file.mv(uploadPath);
    
//     // Save to database
//     const query = `
//       INSERT INTO notices 
//       (user_id, title, description, file_path, file_type, created_at) 
//       VALUES (?, ?, ?, ?, ?, NOW())
//     `;
    
//     db.query(
//       query, 
//       [userId, title, description || '', filePath, fileType], 
//       (err, result) => {
//         if (err) {
//           return res.status(500).json({ error: err.message });
//         }
        
//         res.status(201).json({ 
//           message: 'Notice created successfully',
//           noticeId: result.insertId,
//           filePath
//         });
//       }
//     );
//   } catch (error) {
//     res.status(500).json({ error: error.message });
//   }
// };

// // Update a notice
// exports.updateNotice = async (req, res) => {
//   try {
//     // Check if user is authenticated and is a teacher
//     if (!req.user || !req.user.userId || req.user.role !== 'teacher') {
//       return res.status(401).json({ message: 'Unauthorized' });
//     }
    
//     const userId = req.user.userId;
//     const noticeId = req.params.id;
//     const { title, description } = req.body;
    
//     // Validate required fields
//     if (!title) {
//       return res.status(400).json({ message: 'Title is required' });
//     }
    
//     // Check if notice exists and belongs to the user
//     db.query(
//       'SELECT * FROM notices WHERE id = ? AND user_id = ?',
//       [noticeId, userId],
//       (err, results) => {
//         if (err) {
//           return res.status(500).json({ error: err.message });
//         }
        
//         if (results.length === 0) {
//           return res.status(404).json({ message: 'Notice not found or unauthorized' });
//         }
        
//         // Update the notice
//         db.query(
//           'UPDATE notices SET title = ?, description = ? WHERE id = ?',
//           [title, description || '', noticeId],
//           (err, result) => {
//             if (err) {
//               return res.status(500).json({ error: err.message });
//             }
            
//             res.json({ message: 'Notice updated successfully' });
//           }
//         );
//       }
//     );
//   } catch (error) {
//     res.status(500).json({ error: error.message });
//   }
// };

// // Delete a notice
// exports.deleteNotice = async (req, res) => {
//   try {
//     // Check if user is authenticated and is a teacher
//     if (!req.user || !req.user.userId || req.user.role !== 'teacher') {
//       return res.status(401).json({ message: 'Unauthorized' });
//     }
    
//     const userId = req.user.userId;
//     const noticeId = req.params.id;
    
//     // Check if notice exists and belongs to the user
//     db.query(
//       'SELECT * FROM notices WHERE id = ? AND user_id = ?',
//       [noticeId, userId],
//       (err, results) => {
//         if (err) {
//           return res.status(500).json({ error: err.message });
//         }
        
//         if (results.length === 0) {
//           return res.status(404).json({ message: 'Notice not found or unauthorized' });
//         }
        
//         const notice = results[0];
        
//         // Delete the file
//         const filePath = path.join(__dirname, '..', notice.file_path);
//         if (fs.existsSync(filePath)) {
//           fs.unlinkSync(filePath);
//         }
        
//         // Delete from database
//         db.query(
//           'DELETE FROM notices WHERE id = ?',
//           [noticeId],
//           (err, result) => {
//             if (err) {
//               return res.status(500).json({ error: err.message });
//             }
            
//             res.json({ message: 'Notice deleted successfully' });
//           }
//         );
//       }
//     );
//   } catch (error) {
//     res.status(500).json({ error: error.message });
//   }
// };
// Create a new notice
// Create a new notice
// Create a new notice
exports.createNotice = async (req, res) => {
  try {
    // Debug: Log the user object to see what's available
    console.log('User in request:', req.user);
    
    // Check if user is authenticated
    if (!req.user || !req.user.id) {
      return res.status(401).json({ message: 'User not authenticated' });
    }
    
    const userId = req.user.id;
    
    // First, check if the user is a teacher by querying the database
    db.query(
      'SELECT role FROM users WHERE id = ?',
      [userId],
      (err, results) => {
        if (err) {
          return res.status(500).json({ error: err.message });
        }
        
        if (results.length === 0) {
          return res.status(404).json({ message: 'User not found' });
        }
        
        const userRole = results[0].role;
        
        // Check if user is a teacher
        if (userRole !== 'teacher') {
          return res.status(403).json({ message: 'Unauthorized: Only teachers can create notices' });
        }
        
        // Continue with notice creation
        const { title, description } = req.body;
        
        // Validate required fields
        if (!title) {
          return res.status(400).json({ message: 'Title is required' });
        }
        
        // Check if file exists
        if (!req.files || !req.files.file) {
          return res.status(400).json({ message: 'No file uploaded' });
        }
        
        const file = req.files.file;
        const fileExtension = path.extname(file.name).toLowerCase();
        
        // Determine file type
        let fileType;
        if (['.pdf'].includes(fileExtension)) {
          fileType = 'pdf';
        } else if (['.doc', '.docx'].includes(fileExtension)) {
          fileType = 'doc';
        } else if (['.jpg', '.jpeg', '.png', '.gif'].includes(fileExtension)) {
          fileType = 'image';
        } else if (['.txt'].includes(fileExtension)) {
          fileType = 'text';
        } else {
          return res.status(400).json({ message: 'Unsupported file type' });
        }
        
        // Create upload directory if it doesn't exist
        const uploadDir = path.join(__dirname, '../uploads/notices');
        if (!fs.existsSync(uploadDir)) {
          fs.mkdirSync(uploadDir, { recursive: true });
        }
        
        // Generate unique filename
        const uniqueFilename = `notice_${userId}_${uuidv4()}${fileExtension}`;
        const uploadPath = path.join(uploadDir, uniqueFilename);
        const filePath = `/uploads/notices/${uniqueFilename}`;
        
        // Move the file
        file.mv(uploadPath, (err) => {
          if (err) {
            return res.status(500).json({ error: err.message });
          }
          
          // Save to database
          const query = `
            INSERT INTO notices 
            (user_id, title, description, file_path, file_type, created_at) 
            VALUES (?, ?, ?, ?, ?, NOW())
          `;
          
          db.query(
            query, 
            [userId, title, description || '', filePath, fileType], 
            (err, result) => {
              if (err) {
                return res.status(500).json({ error: err.message });
              }
              
              res.status(201).json({ 
                message: 'Notice created successfully',
                noticeId: result.insertId,
                filePath
              });
            }
          );
        });
      }
    );
  } catch (error) {
    console.error('Error in createNotice:', error);
    res.status(500).json({ error: error.message });
  }
};


// Update a notice
// Update a notice
exports.updateNotice = async (req, res) => {
  try {
    // Check if user is authenticated
    if (!req.user || !req.user.id) {
      return res.status(401).json({ message: 'User not authenticated' });
    }
    
    const userId = req.user.id;
    const noticeId = req.params.id;
    
    // First, check if the user is a teacher by querying the database
    db.query(
      'SELECT role FROM users WHERE id = ?',
      [userId],
      (err, results) => {
        if (err) {
          return res.status(500).json({ error: err.message });
        }
        
        if (results.length === 0) {
          return res.status(404).json({ message: 'User not found' });
        }
        
        const userRole = results[0].role;
        
        // Check if user is a teacher
        if (userRole !== 'teacher') {
          return res.status(403).json({ message: 'Unauthorized: Only teachers can update notices' });
        }
        
        const { title, description } = req.body;
        
        // Validate required fields
        if (!title) {
          return res.status(400).json({ message: 'Title is required' });
        }
        
        // Check if notice exists and belongs to the user
        db.query(
          'SELECT * FROM notices WHERE id = ? AND user_id = ?',
          [noticeId, userId],
          (err, results) => {
            if (err) {
              return res.status(500).json({ error: err.message });
            }
            
            if (results.length === 0) {
              return res.status(404).json({ message: 'Notice not found or unauthorized' });
            }
            
            // Update the notice
            db.query(
              'UPDATE notices SET title = ?, description = ? WHERE id = ?',
              [title, description || '', noticeId],
              (err, result) => {
                if (err) {
                  return res.status(500).json({ error: err.message });
                }
                
                res.json({ message: 'Notice updated successfully' });
              }
            );
          }
        );
      }
    );
  } catch (error) {
    console.error('Error in updateNotice:', error);
    res.status(500).json({ error: error.message });
  }
};



// Also update the deleteNotice function for consistency
// Delete a notice
exports.deleteNotice = async (req, res) => {
  try {
    // Check if user is authenticated
    if (!req.user || !req.user.id) {
      return res.status(401).json({ message: 'User not authenticated' });
    }
    
    const userId = req.user.id;
    const noticeId = req.params.id;
    
    // First, check if the user is a teacher by querying the database
    db.query(
      'SELECT role FROM users WHERE id = ?',
      [userId],
      (err, results) => {
        if (err) {
          return res.status(500).json({ error: err.message });
        }
        
        if (results.length === 0) {
          return res.status(404).json({ message: 'User not found' });
        }
        
        const userRole = results[0].role;
        
        // Check if user is a teacher
        if (userRole !== 'teacher') {
          return res.status(403).json({ message: 'Unauthorized: Only teachers can delete notices' });
        }
        
        // Check if notice exists and belongs to the user
        db.query(
          'SELECT * FROM notices WHERE id = ? AND user_id = ?',
          [noticeId, userId],
          (err, results) => {
            if (err) {
              return res.status(500).json({ error: err.message });
            }
            
            if (results.length === 0) {
              return res.status(404).json({ message: 'Notice not found or unauthorized' });
            }
            
            const notice = results[0];
            
            // Delete the file
            const filePath = path.join(__dirname, '..', notice.file_path);
            if (fs.existsSync(filePath)) {
              fs.unlinkSync(filePath);
            }
            
            // Delete from database
            db.query(
              'DELETE FROM notices WHERE id = ?',
              [noticeId],
              (err, result) => {
                if (err) {
                  return res.status(500).json({ error: err.message });
                }
                
                res.json({ message: 'Notice deleted successfully' });
              }
            );
          }
        );
      }
    );
  } catch (error) {
    console.error('Error in deleteNotice:', error);
    res.status(500).json({ error: error.message });
  }
};

