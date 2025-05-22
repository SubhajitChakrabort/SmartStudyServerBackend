const express = require('express');
const router = express.Router();
const studyMaterialsController = require('../controllers/studyMaterialsController');
const authMiddleware = require('../middleware/auth');

router.get('/', authMiddleware, studyMaterialsController.getStudyMaterials);
router.get('/search', authMiddleware, studyMaterialsController.searchMaterials);
router.get('/view/:subject/:fileName', authMiddleware, studyMaterialsController.viewPDF);
router.post('/save-pdf', authMiddleware, studyMaterialsController.savePDF);


module.exports = router;
