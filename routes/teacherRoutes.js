const express = require('express');
const router = express.Router();
const teacherController = require('../controllers/teacherController');
const authMiddleware = require('../middleware/auth');
const fileUpload = require('express-fileupload');
// Apply middleware
router.use(authMiddleware);
router.use(fileUpload());

// Routes
router.get('/profile', teacherController.getTeacherProfile);
router.put('/update-profile', teacherController.updateTeacherProfile);


module.exports = router;
