const db = require('../config/db');
const path = require('path');
const fs = require('fs');

// Get teacher profile
exports.getTeacherProfile = async (req, res) => {
  try {
    // Log the entire user object for debugging
    console.log('User object from request:', req.user);
    
    // Check for user ID in different possible properties
    const userId = req.user?.id || req.user?.userId || req.user?.user_id;
    
    if (!userId) {
      console.log('User ID not found in token payload:', req.user);
      return res.status(401).json({ message: 'User not authenticated or ID not found' });
    }
    
    console.log('Getting profile for user ID:', userId);
    
    // Get teacher profile data
    const [teacherRows] = await db.promise().query(
      `SELECT tp.*, u.email, u.name 
       FROM teacher_profiles tp
       JOIN users u ON tp.user_id = u.id
       WHERE tp.user_id = ?`,
      [userId]
    );
    
    if (teacherRows.length === 0) {
      return res.status(404).json({ message: 'Teacher profile not found' });
    }
    
    const teacherProfile = teacherRows[0];
    
    // Get teacher's semesters
    const [semesterRows] = await db.promise().query(
      `SELECT semester FROM teacher_semesters WHERE teacher_id = ?`,
      [teacherProfile.id]
    );
    
    const semesters = semesterRows.map(row => row.semester);
    
    res.json({
      ...teacherProfile,
      semesters
    });
  } catch (error) {
    console.error('Error fetching teacher profile:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// Update teacher profile
exports.updateTeacherProfile = async (req, res) => {
  try {
    // Log the entire user object for debugging
    console.log('User object from request:', req.user);
    
    // Check for user ID in different possible properties
    const userId = req.user?.id || req.user?.userId || req.user?.user_id;
    
    if (!userId) {
      console.log('User ID not found in token payload:', req.user);
      return res.status(401).json({ message: 'User not authenticated or ID not found' });
    }
    
    console.log('Updating profile for user ID:', userId);
    
    const { 
      phoneNumber, 
      department, 
      teacherId, 
      address, 
      semesters 
    } = req.body;
    
    console.log('Request body:', req.body);
    
    let photoUrl = null;
    
    // Handle photo upload if present
    if (req.files && req.files.photo) {
      const photo = req.files.photo;
      const uploadDir = path.join(__dirname, '../uploads/profiles');
      
      // Create directory if it doesn't exist
      if (!fs.existsSync(uploadDir)) {
        fs.mkdirSync(uploadDir, { recursive: true });
      }
      
      const fileName = `teacher_${userId}_${Date.now()}${path.extname(photo.name)}`;
      const uploadPath = path.join(uploadDir, fileName);
      
      // Move the file
      await photo.mv(uploadPath);
      photoUrl = `/uploads/profiles/${fileName}`;
      console.log('Photo uploaded to:', photoUrl);
    }
    
    // Check if teacher profile exists
    const [existingTeacher] = await db.promise().query(
      'SELECT id FROM teacher_profiles WHERE user_id = ?',
      [userId]
    );
    
    let teacherProfileId;
    
    if (existingTeacher.length === 0) {
      console.log('Creating new teacher profile');
      // Create new teacher profile
      const [result] = await db.promise().query(
        `INSERT INTO teacher_profiles 
         (user_id, phone_number, department, teacher_id, address, photo_url) 
         VALUES (?, ?, ?, ?, ?, ?)`,
        [userId, phoneNumber || '', department || '', teacherId || '', address || '', photoUrl]
      );
      teacherProfileId = result.insertId;
      console.log('Created teacher profile with ID:', teacherProfileId);
    } else {
      console.log('Updating existing teacher profile');
      // Update existing teacher profile
      teacherProfileId = existingTeacher[0].id;
      
      // Update query parts
      const updateParts = [
        'phone_number = ?',
        'department = ?',
        'teacher_id = ?',
        'address = ?'
      ];
      const updateValues = [phoneNumber || '', department || '', teacherId || '', address || ''];
      
      // Add photo to update if provided
      if (photoUrl) {
        updateParts.push('photo_url = ?');
        updateValues.push(photoUrl);
      }
      
      // Add user ID to values
      updateValues.push(userId);
      
      await db.promise().query(
        `UPDATE teacher_profiles 
         SET ${updateParts.join(', ')} 
         WHERE user_id = ?`,
        updateValues
      );
      console.log('Updated teacher profile with ID:', teacherProfileId);
    }
    
    // Handle semesters - first delete existing ones
    await db.promise().query(
      'DELETE FROM teacher_semesters WHERE teacher_id = ?',
      [teacherProfileId]
    );
    console.log('Deleted existing semesters for teacher ID:', teacherProfileId);
    
    // Insert new semesters
    if (semesters && semesters.length > 0) {
      const parsedSemesters = typeof semesters === 'string' 
        ? JSON.parse(semesters) 
        : semesters;
      
      console.log('Adding semesters:', parsedSemesters);
        
      for (const semester of parsedSemesters) {
        await db.promise().query(
          'INSERT INTO teacher_semesters (teacher_id, semester) VALUES (?, ?)',
          [teacherProfileId, semester]
        );
      }
      console.log('Added semesters for teacher ID:', teacherProfileId);
    }
    
    res.json({ 
      message: 'Teacher profile updated successfully',
      teacherId: teacherProfileId
    });
  } catch (error) {
    console.error('Error updating teacher profile:', error);
    res.status(500).json({ 
      message: 'Server error', 
      error: error.message,
      stack: error.stack
    });
  }
};
