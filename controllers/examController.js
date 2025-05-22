const getQuestions = async (req, res) => {
    try {
      const query = `
        SELECT * FROM exam_questions 
        ORDER BY RAND() 
        LIMIT 20
      `;
      
      db.query(query, (err, results) => {
        if (err) {
          return res.status(500).json({ error: err.message });
        }
        res.json(results);
      });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  };
  
  const submitExam = async (req, res) => {
    try {
      const userId = req.user.userId;
      const { score, totalQuestions, timeLeft } = req.body;
      
      const timeTaken = 2400 - timeLeft; // Calculate actual time taken
      
      const query = 'INSERT INTO exam_results (user_id, score, total_questions, time_taken, completed_at) VALUES (?, ?, ?, ?, NOW())';
      db.query(query, [userId, parseInt(score), parseInt(totalQuestions), parseInt(timeTaken)], (err, result) => {
        if (err) {
          return res.status(500).json({ error: err.message });
        }
        res.json({ 
          message: 'Exam results saved successfully',
          score: parseInt(score),
          totalQuestions: parseInt(totalQuestions),
          timeTaken: parseInt(timeTaken)
        });
      });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  };
  
  const getExamResults = async (req, res) => {
    try {
      const userId = req.user.userId;
      const query = `
        SELECT 
          id,
          score,
          total_questions,
          time_taken,
          completed_at
        FROM exam_results 
        WHERE user_id = ? 
        ORDER BY completed_at DESC
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
  
  
  module.exports = {
    submitExam,
    getExamResults
  };
  
  