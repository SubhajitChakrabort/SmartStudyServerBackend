const express = require('express');
const router = express.Router();
const examController = require('../controllers/examController');
const authMiddleware = require('../middleware/auth');

router.post('/submit', authMiddleware, examController.submitExam);
router.get('/results', authMiddleware, examController.getExamResults);

module.exports = router;
