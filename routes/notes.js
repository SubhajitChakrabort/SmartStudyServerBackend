const express = require('express');
const router = express.Router();
const subjectsAndSemesters = express.Router();
const fileUpload = require('express-fileupload');
const { 
  getNotes, 
  createNote, 
  updateNote, 
  deleteNote, 
  savePDF,
  getTeachersNotes,
  getSubjectsAndSemesters,
  saveNoteToFolder
} = require('../controllers/notesController');
const auth = require('../middleware/auth');

// Add fileUpload middleware
router.use(fileUpload());
subjectsAndSemesters.get('/', auth, getSubjectsAndSemesters);
// Existing routes
router.get('/', auth, getNotes);
router.post('/', auth, createNote);
router.put('/:id', auth, updateNote);
router.delete('/:id', auth, deleteNote);
router.post('/save-pdf', auth, savePDF);

// New routes for teacher notes and study folders
router.get('/teachers', auth, getTeachersNotes);
router.get('/subjects-semesters', auth, getSubjectsAndSemesters);
router.post('/save-to-folder', auth, saveNoteToFolder);

module.exports = router;
module.exports.subjectsAndSemesters = subjectsAndSemesters;