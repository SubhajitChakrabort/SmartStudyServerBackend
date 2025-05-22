const multer = require('multer');
const path = require('path');

// Configure multer for file upload
const storage = multer.diskStorage({
  destination: './uploads/',
  filename: function(req, file, cb) {
    cb(null, 'profile-' + Date.now() + path.extname(file.originalname));
  }
});

const upload = multer({ 
  storage: storage,
  limits: { fileSize: 5000000 }, // 5MB limit
  fileFilter: (req, file, cb) => {
    const filetypes = /jpeg|jpg|png/;
    const mimetype = filetypes.test(file.mimetype);
    const extname = filetypes.test(path.extname(file.originalname).toLowerCase());
    
    if (mimetype && extname) {
      return cb(null, true);
    }
    cb(new Error('Only .png, .jpg and .jpeg format allowed!'));
  }
}).single('photo');

const getProfile = async (req, res) => {
  try {
    const userId = req.user.userId;
    const query = `
      SELECT email, name, university_roll, department, 
             address, user_id, photo_url, role 
      FROM users 
      WHERE id = ?`;
    
    db.query(query, [userId], (err, results) => {
      if (err || results.length === 0) {
        return res.status(404).json({ error: 'User not found' });
      }
      res.json({
        email: results[0].email,
        name: results[0].name,
        universityRoll: results[0].university_roll,
        department: results[0].department,
        address: results[0].address,
        userId: results[0].user_id,
        photoUrl: results[0].photo_url,
        role: results[0].role
      });
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};


const updateProfile = async (req, res) => {
  upload(req, res, async (err) => {
    if (err) {
      return res.status(400).json({ error: err.message });
    }

    try {
      const userId = req.user.userId;
      const { name, universityRoll, department, address } = req.body;
      
      // Generate unique user ID
      const userIdPrefix = department ? department.substring(0, 4).toUpperCase() : '';
      const rollLastDigits = universityRoll ? universityRoll.slice(-5) : '';
      const generatedUserId = `${userIdPrefix}${rollLastDigits}`;

      const updateQuery = `
        UPDATE users 
        SET name = ?, 
            university_roll = ?, 
            department = ?, 
            address = ?,
            user_id = ?
            ${req.file ? ', photo_url = ?' : ''}
        WHERE id = ?
      `;

      const queryParams = [
        name, 
        universityRoll, 
        department, 
        address, 
        generatedUserId
      ];

      if (req.file) {
        queryParams.push(`/uploads/${req.file.filename}`);
      }
      queryParams.push(userId);

      db.query(updateQuery, queryParams, (err, result) => {
        if (err) {
          return res.status(400).json({ error: err.message });
        }
        res.json({ 
          message: 'Profile updated successfully',
          userId: generatedUserId,
          photoUrl: req.file ? `/uploads/${req.file.filename}` : null
        });
      });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });
};

module.exports = {
  getProfile,
  updateProfile
};
