const db = require("../config/db");
const path = require("path");
const fs = require("fs");
const { v4: uuidv4 } = require("uuid");

// Helper function to get teacher profile ID
const getTeacherProfileId = async (userId) => {
  const [rows] = await db
    .promise()
    .query("SELECT id FROM teacher_profiles WHERE user_id = ?", [userId]);

  if (rows.length === 0) {
    throw new Error("Teacher profile not found");
  }

  return rows[0].id;
};

// Upload a single file (PDF, video, or image)
exports.uploadFile = async (req, res) => {
  try {
    // Check if user is authenticated
    if (!req.user || !req.user.id) {
      return res.status(401).json({ message: "User not authenticated" });
    }

    const userId = req.user.id;

    // Check if file exists
    if (!req.files || !req.files.file) {
      return res.status(400).json({ message: "No file uploaded" });
    }

    // Extract form data
    const { title, description, subject, semester, isPublic, tags } = req.body;

    // Validate required fields
    if (!title || !subject || !semester) {
      return res
        .status(400)
        .json({ message: "Title, subject, and semester are required" });
    }

    // Handle file upload
    const file = req.files.file;
    const fileExtension = path.extname(file.name).toLowerCase();

    // Determine file type
    let fileType;
    if ([".pdf"].includes(fileExtension)) {
      fileType = "pdf";
    } else if (
      [".mp4", ".mov", ".avi", ".wmv", ".mkv"].includes(fileExtension)
    ) {
      fileType = "video";
    } else if (
      [".jpg", ".jpeg", ".png", ".gif", ".webp"].includes(fileExtension)
    ) {
      fileType = "image";
    } else {
      return res.status(400).json({ message: "Unsupported file type" });
    }

    // Create upload directory if it doesn't exist
    const uploadDir = path.join(__dirname, `../uploads/${fileType}s`);
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }

    // Generate unique filename
    const uniqueFilename = `${fileType}_${userId}_${uuidv4()}${fileExtension}`;
    const uploadPath = path.join(uploadDir, uniqueFilename);
    const filePath = `/uploads/${fileType}s/${uniqueFilename}`;

    // Move the file
    await file.mv(uploadPath);

    // Get the subject name from the subject ID if needed
    // This assumes you have a subjects table with id and name columns
    let subjectName = subject;
    try {
      const [subjectRows] = await db
        .promise()
        .query("SELECT name FROM subjects WHERE id = ?", [subject]);
      if (subjectRows.length > 0) {
        subjectName = subjectRows[0].name;
      }
    } catch (error) {
      console.log("Could not fetch subject name, using subject ID as name");
    }

    // Save to database - Adjusted to match your schema
    const [result] = await db.promise().query(
      `INSERT INTO notes 
       (user_id, title, description, file_path, file_type, subject, semester, is_public, subject_name, created_at) 
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())`,
      [
        userId,
        title,
        description || "",
        filePath,
        fileType,
        subject,
        semester,
        isPublic === "true" || isPublic === true ? 1 : 0,
        subjectName,
      ]
    );

    // Process tags if provided
    if (tags) {
      const tagArray = typeof tags === "string" ? JSON.parse(tags) : tags;

      for (const tag of tagArray) {
        await db
          .promise()
          .query("INSERT INTO note_tags (note_id, tag) VALUES (?, ?)", [
            result.insertId,
            tag,
          ]);
      }
    }

    res.status(201).json({
      message: "File uploaded successfully",
      noteId: result.insertId,
      filePath,
    });
  } catch (error) {
    console.error("Error uploading file:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

// Bulk upload files
exports.bulkUpload = async (req, res) => {
  try {
    // Check if user is authenticated
    if (!req.user || !req.user.id) {
      return res.status(401).json({ message: "User not authenticated" });
    }

    const userId = req.user.id;

    // Extract common form data
    const { subject, semester, isPublic } = req.body;

    // Validate required fields
    if (!subject || !semester) {
      return res
        .status(400)
        .json({ message: "Subject and semester are required" });
    }

    // Check if files exist
    if (!req.files || !req.files.files) {
      return res.status(400).json({ message: "No files uploaded" });
    }

    // Get the subject name from the subject ID if needed
    let subjectName = subject;
    try {
      const [subjectRows] = await db
        .promise()
        .query("SELECT name FROM subjects WHERE id = ?", [subject]);
      if (subjectRows.length > 0) {
        subjectName = subjectRows[0].name;
      }
    } catch (error) {
      console.log("Could not fetch subject name, using subject ID as name");
    }

    const files = Array.isArray(req.files.files)
      ? req.files.files
      : [req.files.files];
    const results = [];

    // Process each file
    for (const file of files) {
      const fileExtension = path.extname(file.name).toLowerCase();
      const fileName = path.basename(file.name, fileExtension);

      // Determine file type
      let fileType;
      if ([".pdf"].includes(fileExtension)) {
        fileType = "pdf";
      } else if (
        [".mp4", ".mov", ".avi", ".wmv", ".mkv"].includes(fileExtension)
      ) {
        fileType = "video";
      } else if (
        [".jpg", ".jpeg", ".png", ".gif", ".webp"].includes(fileExtension)
      ) {
        fileType = "image";
      } else {
        // Skip unsupported file types
        results.push({
          fileName: file.name,
          status: "skipped",
          reason: "Unsupported file type",
        });
        continue;
      }

      // Create upload directory if it doesn't exist
      const uploadDir = path.join(__dirname, `../uploads/${fileType}s`);
      if (!fs.existsSync(uploadDir)) {
        fs.mkdirSync(uploadDir, { recursive: true });
      }

      // Generate unique filename
      const uniqueFilename = `${fileType}_${userId}_${uuidv4()}${fileExtension}`;
      const uploadPath = path.join(uploadDir, uniqueFilename);
      const filePath = `/uploads/${fileType}s/${uniqueFilename}`;

      try {
        // Move the file
        await file.mv(uploadPath);

        // Save to database - Adjusted to match your schema
        const [result] = await db.promise().query(
          `INSERT INTO notes 
           (user_id, title, description, file_path, file_type, subject, semester, is_public, subject_name, created_at) 
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())`,
          [
            userId,
            fileName,
            "",
            filePath,
            fileType,
            subject,
            semester,
            isPublic === "true" || isPublic === true ? 1 : 0,
            subjectName,
          ]
        );

        results.push({
          fileName: file.name,
          status: "success",
          noteId: result.insertId,
          filePath,
        });
      } catch (error) {
        results.push({
          fileName: file.name,
          status: "error",
          reason: error.message,
        });
      }
    }

    res.status(201).json({
      message: "Bulk upload processed",
      results,
    });
  } catch (error) {
    console.error("Error processing bulk upload:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

// Get user's uploads
exports.getUserUploads = async (req, res) => {
  try {
    // Check if user is authenticated
    if (!req.user || !req.user.id) {
      return res.status(401).json({ message: "User not authenticated" });
    }

    const userId = req.user.id;

    // Get uploads with optional filters
    const { fileType, subject, semester } = req.query;

    let query = `
      SELECT * FROM notes 
      WHERE user_id = ?
    `;

    const queryParams = [userId];

    if (fileType) {
      query += " AND file_type = ?";
      queryParams.push(fileType);
    }

    if (subject) {
      query += " AND subject = ?";
      queryParams.push(subject);
    }

    if (semester) {
      query += " AND semester = ?";
      queryParams.push(semester);
    }

    query += " ORDER BY created_at DESC";

    const [uploads] = await db.promise().query(query, queryParams);

    // Get tags for each upload
    for (const upload of uploads) {
      const [tags] = await db
        .promise()
        .query("SELECT tag FROM note_tags WHERE note_id = ?", [upload.id]);

      upload.tags = tags.map((t) => t.tag);
    }

    res.json(uploads);
  } catch (error) {
    console.error("Error fetching user uploads:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

// Delete an upload
exports.deleteUpload = async (req, res) => {
  try {
    // Check if user is authenticated
    if (!req.user || !req.user.id) {
      return res.status(401).json({ message: "User not authenticated" });
    }

    const userId = req.user.id;
    const uploadId = req.params.id;

    // Get upload details
    const [uploads] = await db
      .promise()
      .query("SELECT * FROM notes WHERE id = ? AND user_id = ?", [
        uploadId,
        userId,
      ]);

    if (uploads.length === 0) {
      return res
        .status(404)
        .json({ message: "Upload not found or not authorized" });
    }

    const upload = uploads[0];

    // Delete the file
    const filePath = path.join(__dirname, "..", upload.file_path);
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }

    // Delete from database
    await db
      .promise()
      .query("DELETE FROM note_tags WHERE note_id = ?", [uploadId]);
    await db.promise().query("DELETE FROM notes WHERE id = ?", [uploadId]);

    res.json({ message: "Upload deleted successfully" });
  } catch (error) {
    console.error("Error deleting upload:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

// Update an existing upload
exports.updateUpload = async (req, res) => {
  try {
    // Check if user is authenticated
    if (!req.user || !req.user.id) {
      return res.status(401).json({ message: "User not authenticated" });
    }

    const userId = req.user.id;
    const uploadId = req.params.id;
    const { title, description, isPublic } = req.body;

    // Validate required fields
    if (!title) {
      return res.status(400).json({ message: "Title is required" });
    }

    // Update the upload in the database
    await db.promise().query(
      `UPDATE notes 
       SET title = ?, description = ?, is_public = ? 
       WHERE id = ? AND user_id = ?`,
      [
        title,
        description || "",
        isPublic === "true" || isPublic === true ? 1 : 0,
        uploadId,
        userId,
      ]
    );

    res.json({ message: "Upload updated successfully" });
  } catch (error) {
    console.error("Error updating upload:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
};
// Add this new function to the uploadController.js file

// Get subject distribution based on uploaded notes
exports.getSubjectDistribution = async (req, res) => {
  try {
    // Check if user is authenticated
    if (!req.user || !req.user.id) {
      return res.status(401).json({ message: "User not authenticated" });
    }

    const userId = req.user.id;
    const userRole = req.user.role;
    
    let query = '';
    let queryParams = [];
    
    if (userRole === 'teacher') {
      // For teachers, get distribution of their own uploads
      query = `
        SELECT subject_name, COUNT(*) as count 
        FROM notes 
        WHERE user_id = ? 
        GROUP BY subject_name 
        ORDER BY count DESC
      `;
      queryParams = [userId];
    } else if (userRole === 'admin') {
      // For admins, get distribution across all notes
      query = `
        SELECT subject_name, COUNT(*) as count 
        FROM notes 
        GROUP BY subject_name 
        ORDER BY count DESC
      `;
    } else {
      // For students, get distribution of their own notes
      query = `
        SELECT subject_name, COUNT(*) as count 
        FROM notes 
        WHERE user_id = ? 
        GROUP BY subject_name 
        ORDER BY count DESC
      `;
      queryParams = [userId];
    }

    // Execute the query
    const [results] = await db.promise().query(query, queryParams);
    
    // Transform results into an object with subject names as keys and counts as values
    const subjectDistribution = {};
    results.forEach(row => {
      if (row.subject_name) {
        subjectDistribution[row.subject_name] = row.count;
      }
    });

    // Get total notes count
    let totalQuery = '';
    if (userRole === 'teacher') {
      totalQuery = 'SELECT COUNT(*) as total FROM notes WHERE user_id = ?';
    } else if (userRole === 'admin') {
      totalQuery = 'SELECT COUNT(*) as total FROM notes';
    } else {
      totalQuery = 'SELECT COUNT(*) as total FROM notes WHERE user_id = ?';
    }
    
    const [totalResults] = await db.promise().query(
      totalQuery, 
      userRole === 'admin' ? [] : [userId]
    );
    
    const totalNotes = totalResults[0]?.total || 0;

    // Get notes activity trend (creation dates grouped by day)
    let trendQuery = '';
    if (userRole === 'teacher') {
      trendQuery = `
        SELECT DATE(created_at) as date, COUNT(*) as count 
        FROM notes 
        WHERE user_id = ? 
        GROUP BY DATE(created_at) 
        ORDER BY date DESC 
        LIMIT 10
      `;
    } else if (userRole === 'admin') {
      trendQuery = `
        SELECT DATE(created_at) as date, COUNT(*) as count 
        FROM notes 
        GROUP BY DATE(created_at) 
        ORDER BY date DESC 
        LIMIT 10
      `;
    } else {
      trendQuery = `
        SELECT DATE(created_at) as date, COUNT(*) as count 
        FROM notes 
        WHERE user_id = ? 
        GROUP BY DATE(created_at) 
        ORDER BY date DESC 
        LIMIT 10
      `;
    }
    
    const [trendResults] = await db.promise().query(
      trendQuery, 
      userRole === 'admin' ? [] : [userId]
    );
    
    // Format the trend data
    const notesActivityTrend = trendResults.map(row => ({
      date: row.date.toISOString().split('T')[0],
      count: row.count
    }));

    // Return the subject distribution and related data
    res.json({
      subjectDistribution,
      notesActivity: {
        totalNotesCreated: totalNotes,
        notesActivityTrend
      }
    });
  } catch (error) {
    console.error("Error fetching subject distribution:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
};
