const express = require('express');
const router = express.Router();
const uploadController = require('../controllers/uploadController');
const auth = require('../middleware/auth');
const fileUpload = require('express-fileupload');

// Apply middleware
router.use(auth);
router.use(fileUpload({
  limits: { fileSize: 50 * 1024 * 1024 }, // 50MB limit
  abortOnLimit: true,
  createParentPath: true
}));

// Routes
router.post('/file', uploadController.uploadFile);
router.post('/bulk', uploadController.bulkUpload);
router.get('/user', uploadController.getUserUploads);
router.put('/:id', uploadController.updateUpload); // Add this route
router.delete('/:id', uploadController.deleteUpload);
// Add this route to your upload routes file
router.get('/subject-distribution', uploadController.getSubjectDistribution);

module.exports = router;
