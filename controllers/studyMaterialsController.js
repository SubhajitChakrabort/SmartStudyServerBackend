const path = require('path');

const getStudyMaterials = async (req, res) => {
  try {
    const userId = req.user.userId;
    const query = `
      SELECT 
        sm.*,
        n.content as note_content
      FROM study_materials sm
      LEFT JOIN notes n ON sm.title = n.title AND sm.subject_name = n.subject_name
      WHERE sm.user_id = ? 
      ORDER BY sm.created_at DESC
    `;
    
    db.query(query, [userId], (err, results) => {
      if (err) {
        return res.status(500).json({ error: err.message });
      }
      res.json(results);
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};


const viewPDF = async (req, res) => {
  try {
    const userId = req.user.userId;
    const fileName = req.params.fileName;
    const subjectName = req.params.subject;
    
    const filePath = path.join(__dirname, '..', 'uploads', 'study', userId.toString(), subjectName, fileName);
    
    // Verify file ownership and existence
    const query = 'SELECT * FROM study_materials WHERE user_id = ? AND subject_name = ? AND title = ?';
    db.query(query, [userId, subjectName, fileName.replace('.pdf', '')], (err, results) => {
      if (err || results.length === 0) {
        return res.status(404).json({ error: 'File not found' });
      }
      
      // Send file for viewing
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', 'inline');
      res.sendFile(filePath);
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

const savePDF = async (req, res) => {
  try {
    const userId = req.user.userId;
    const { subject, title } = req.body;
    const pdfFile = req.files.pdf;

    // Create study folder structure
    const baseDir = path.join(__dirname, '..', 'uploads', 'study', userId.toString());
    const subjectDir = path.join(baseDir, subject);
    
    await fs.mkdir(subjectDir, { recursive: true });
    
    // Save PDF
    const pdfPath = path.join(subjectDir, `${title}.pdf`);
    await fs.writeFile(pdfPath, pdfFile.data);

    // Save reference in database
    const query = 'INSERT INTO study_materials (user_id, subject_name, title, file_path) VALUES (?, ?, ?, ?)';
    db.query(query, [userId, subject, title, pdfPath], (err, result) => {
      if (err) {
        return res.status(400).json({ error: err.message });
      }
      res.json({ 
        message: 'PDF saved successfully',
        filePath: pdfPath
      });
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};
const searchMaterials = async (req, res) => {
  try {
    const userId = req.user.userId;
    const { searchTerm } = req.query;
    
    const query = `
      SELECT * FROM study_materials 
      WHERE user_id = ? 
      AND (subject_name LIKE ? OR title LIKE ?)
      ORDER BY created_at DESC
    `;
    
    const searchPattern = `%${searchTerm}%`;
    
    db.query(query, [userId, searchPattern, searchPattern], (err, results) => {
      if (err) {
        return res.status(500).json({ error: err.message });
      }
      
      const groupedResults = results.reduce((acc, item) => {
        if (!acc[item.subject_name]) {
          acc[item.subject_name] = [];
        }
        acc[item.subject_name].push(item);
        return acc;
      }, {});
      
      res.json(groupedResults);
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};
module.exports = {
  getStudyMaterials,
  viewPDF,
  savePDF,
  searchMaterials
};
