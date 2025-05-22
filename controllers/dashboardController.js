const db = require("../config/db");

const getDashboardStats = async (req, res) => {
  try {
    const userId = req.user.userId;

    // Get notes by subject
    const notesQuery = `
      SELECT subject_name, COUNT(*) as count
      FROM notes
      WHERE user_id = ?
      GROUP BY subject_name
    `;

    // Get highest exam score
    const examQuery = `
      SELECT MAX(score) as highest_score
      FROM exam_results
      WHERE user_id = ?
    `;

    // Get total notes
    const totalNotesQuery = `
      SELECT COUNT(*) as total
      FROM notes
      WHERE user_id = ?
    `;

    // Get total number of students (only for admin)
    const totalStudentsQuery = `
      SELECT COUNT(*) as total_students
      FROM users
      WHERE role = 'student'
    `;

    // Get total number of teachers (only for admin)
    const totalTeachersQuery = `
      SELECT COUNT(*) as total_teachers
      FROM users
      WHERE role = 'teacher'
    `;

    // Execute notes query to get notes by subject
    db.query(notesQuery, [userId], (err, notesResults) => {
      if (err) return res.status(500).json({ error: err.message });

      const notesBySubject = {};
      notesResults.forEach((row) => {
        notesBySubject[row.subject_name] = row.count;
      });

      // Execute exam query to get highest exam score
      db.query(examQuery, [userId], (err, [examResult]) => {
        if (err) return res.status(500).json({ error: err.message });

        // Execute total notes query
        db.query(totalNotesQuery, [userId], (err, [totalResult]) => {
          if (err) return res.status(500).json({ error: err.message });

          // Fetch total students and teachers (only for admin)
          if (req.user.role === "admin") {
            db.query(totalStudentsQuery, (err, [studentsResult]) => {
              if (err) return res.status(500).json({ error: err.message });

              db.query(totalTeachersQuery, (err, [teachersResult]) => {
                if (err) return res.status(500).json({ error: err.message });

                // Send response with all stats for admin
                res.json({
                  notesBySubject,
                  totalNotes: totalResult.total,
                  highestExamScore: examResult.highest_score || 0,
                  recentExams: [],
                  totalStudents: studentsResult.total_students || 0,
                  totalTeachers: teachersResult.total_teachers || 0,
                });
              });
            });
          } else {
            // For non-admin users, return only the basic stats
            res.json({
              notesBySubject,
              totalNotes: totalResult.total,
              highestExamScore: examResult.highest_score || 0,
              recentExams: [],
            });
          }
        });
      });
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Get teachers notes statistics
const getTeachersNotesStats = async (req, res) => {
  try {
    // Get total count of teacher notes
    const [totalResult] = await db
      .promise()
      .query(
        `SELECT COUNT(*) AS total FROM teacher_uploads WHERE is_public = 1`
      );

    // Extract the total count safely
    const totalNotes = totalResult.length > 0 ? totalResult[0].total : 0;

    // Get notes by subject
    const [subjectResult] = await db.promise().query(
      `SELECT subject, COUNT(*) as count 
       FROM teacher_uploads 
       WHERE is_public = 1 
       GROUP BY subject`
    );

    // Get notes by month (for the last 6 months) with correct aggregation
    const [monthResult] = await db.promise().query(
      `SELECT 
          DATE_FORMAT(MIN(created_at), '%b') AS month,  -- Ensure compatibility
          COUNT(*) AS count
       FROM teacher_uploads
       WHERE is_public = 1
       AND created_at >= DATE_SUB(NOW(), INTERVAL 6 MONTH)
       GROUP BY DATE_FORMAT(created_at, '%Y-%m')
       ORDER BY MIN(created_at) ASC`
    );

    // Format the data
    const bySubject = {};
    subjectResult.forEach((item) => {
      bySubject[item.subject] = item.count;
    });

    const byMonth = {};
    monthResult.forEach((item) => {
      byMonth[item.month] = item.count;
    });

    res.json({
      total: totalNotes,
      bySubject,
      byMonth,
    });
  } catch (error) {
    console.error("Error fetching teachers notes stats:", error);
    res.status(500).json({ error: error.message });
  }
};

const getTotalStudents = async (req, res) => {
  try {
    const query = `
      SELECT COUNT(*) as total_students
      FROM users
      WHERE role = 'student'
    `;

    db.query(query, (err, [result]) => {
      if (err) return res.status(500).json({ error: err.message });

      res.json({ totalStudents: result.total_students || 0 });
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

const getTotalTeachers = async (req, res) => {
  try {
    const query = `
      SELECT COUNT(*) as total_teachers
      FROM users
      WHERE role = 'teacher'
    `;

    db.query(query, (err, [result]) => {
      if (err) return res.status(500).json({ error: err.message });

      res.json({ totalTeachers: result.total_teachers || 0 });
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

const getStudentsByDepartment = async (req, res) => {
  try {
    const query = `
      SELECT department, COUNT(*) as count
      FROM users
      WHERE role = 'student'
      GROUP BY department
    `;

    db.query(query, (err, results) => {
      if (err) return res.status(500).json({ error: err.message });

      const studentsByDepartment = {};
      results.forEach((row) => {
        studentsByDepartment[row.department] = row.count;
      });

      res.json(studentsByDepartment);
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Add this new function to get the count of new teacher notes
const getNewTeacherNotesCount = async (req, res) => {
  try {
    const userId = req.user.userId;
    
    // Make sure we're only getting this for students
    if (req.user.role !== 'student') {
      return res.json({ newNotesCount: 0 });
    }
    
    // Get count of teacher notes that the student hasn't viewed yet
    const query = `
      SELECT COUNT(*) as new_notes_count
      FROM teacher_uploads
      WHERE is_public = 1
      AND id NOT IN (
        SELECT note_id 
        FROM viewed_notes 
        WHERE user_id = ?
      )
    `;

    db.query(query, [userId], (err, results) => {
      if (err) return res.status(500).json({ error: err.message });
      
      // Make sure we have results
      if (!results || results.length === 0) {
        return res.json({ newNotesCount: 0 });
      }
      
      console.log("New notes count result:", results[0]);
      res.json({ newNotesCount: results[0].new_notes_count || 0 });
    });
  } catch (error) {
    console.error("Error fetching new notes count:", error);
    res.status(500).json({ error: error.message });
  }
};

// Add a function to mark notes as viewed
const markTeacherNotesAsViewed = async (req, res) => {
  try {
    const userId = req.user.userId;
    
    // Make sure we're only doing this for students
    if (req.user.role !== 'student') {
      return res.json({ message: "Not a student account" });
    }
    
    // First, check if the viewed_notes table exists
    db.query(`
      CREATE TABLE IF NOT EXISTS viewed_notes (
        id INT AUTO_INCREMENT PRIMARY KEY,
        user_id INT NOT NULL,
        note_id INT NOT NULL,
        viewed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE KEY unique_view (user_id, note_id)
      )
    `, (err) => {
      if (err) return res.status(500).json({ error: err.message });
      
      // Get all unviewed teacher notes
      const getNotesQuery = `
        SELECT id 
        FROM teacher_uploads 
        WHERE is_public = 1
        AND id NOT IN (
          SELECT note_id 
          FROM viewed_notes 
          WHERE user_id = ?
        )
      `;
      
      db.query(getNotesQuery, [userId], (err, notes) => {
        if (err) return res.status(500).json({ error: err.message });
        
        console.log("Unviewed notes:", notes);
        
        if (notes.length === 0) {
          return res.json({ message: "No new notes to mark as viewed" });
        }
        
        // Create values for bulk insert
        const values = notes.map(note => [userId, note.id]);
        
        // Insert records to mark notes as viewed
        const insertQuery = `
          INSERT INTO viewed_notes (user_id, note_id)
          VALUES ?
        `;
        
        db.query(insertQuery, [values], (err) => {
          if (err) return res.status(500).json({ error: err.message });
          
          res.json({ message: "All notes marked as viewed", count: notes.length });
        });
      });
    });
  } catch (error) {
    console.error("Error marking notes as viewed:", error);
    res.status(500).json({ error: error.message });
  }
};

module.exports = {
  getDashboardStats,
  getTeachersNotesStats,
  getTotalStudents,
  getTotalTeachers,
  getStudentsByDepartment,
  getNewTeacherNotesCount,
  markTeacherNotesAsViewed,
};
