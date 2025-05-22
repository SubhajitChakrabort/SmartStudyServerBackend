const express = require('express');
const router = express.Router();
const predictionController = require('../controllers/predictionController');
const auth = require('../middleware/auth');
const trackActivity = require('../middleware/activityTracker');

// Route to get prediction insights (with activity tracking)
router.get('/insights', auth, trackActivity('view_predictions'), predictionController.getInsights);

// Add a test route to check user role
router.get('/check-role', auth, (req, res) => {
  res.json({ 
    message: 'Auth working', 
    role: req.user.role,
    userId: req.user.id
  });
});

module.exports = router;
