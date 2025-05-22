const db = require('../config/db');
const pool = db.promise();

exports.identifyAtRiskStudents = async (req, res) => {
  try {
    // Only accessible by teachers and admins
    if (req.user.role !== 'teacher' && req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Unauthorized' });
    }
    
    // Get students with declining performance or low engagement
    const [atRiskStudents] = await pool.query(
      `SELECT 
         u.id, u.name, u.email,
         COUNT(DISTINCT n.id) as notes_count,
         COUNT(DISTINCT nv.id) as note_views,
         AVG(er.score/er.total_questions) as avg_score,
         MAX(er.completed_at) as last_test_date
       FROM users u
       LEFT JOIN notes n ON u.id = n.user_id
       LEFT JOIN note_views nv ON u.id = nv.user_id
       LEFT JOIN exam_results er ON u.id = er.user_id
       WHERE u.role = 'student'
       GROUP BY u.id
       HAVING 
         (avg_score < 0.6 OR 
          note_views < 10 OR 
          DATEDIFF(NOW(), last_test_date) > 14)
       ORDER BY avg_score ASC`
    );
    
    // Calculate risk factors
    const studentsWithRiskFactors = atRiskStudents.map(student => {
      const riskFactors = [];
      
      if (student.avg_score < 0.6) {
        riskFactors.push('Low test scores');
      }
      
      if (student.note_views < 10) {
        riskFactors.push('Low engagement with content');
      }
      
      if (student.last_test_date && new Date(student.last_test_date) < new Date(Date.now() - 14 * 24 * 60 * 60 * 1000)) {
        riskFactors.push('No recent test activity');
      }
      
      return {
        id: student.id,
        name: student.name,
        email: student.email,
        riskFactors,
        riskLevel: riskFactors.length > 2 ? 'high' : (riskFactors.length > 1 ? 'medium' : 'low')
      };
    });
    
    res.json({ atRiskStudents: studentsWithRiskFactors });
  } catch (error) {
    console.error('Error identifying at-risk students:', error);
    res.status(500).json({ error: 'Failed to identify at-risk students' });
  }
};
