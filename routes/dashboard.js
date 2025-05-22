const express = require('express');
const router = express.Router();
const dashboardController = require('../controllers/dashboardController');
const authMiddleware = require('../middleware/auth');

// Main dashboard stats route
router.get('/stats', authMiddleware, dashboardController.getDashboardStats);

// Teachers notes stats route
router.get('/teachers-notes-stats', authMiddleware, dashboardController.getTeachersNotesStats);

// Additional routes for total students, total teachers, and students by department
router.get('/total-students', authMiddleware, dashboardController.getTotalStudents);
router.get('/total-teachers', authMiddleware, dashboardController.getTotalTeachers);
router.get('/students-by-department', authMiddleware, dashboardController.getStudentsByDepartment);

// Add these routes for the notification feature
router.get('/new-notes-count', authMiddleware, dashboardController.getNewTeacherNotesCount);
router.post('/mark-notes-viewed', authMiddleware, dashboardController.markTeacherNotesAsViewed);

module.exports = router;
