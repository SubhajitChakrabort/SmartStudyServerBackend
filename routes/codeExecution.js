const express = require('express');
const router = express.Router();
const axios = require('axios');

// This route will proxy requests to a code execution API
router.post('/execute', async (req, res) => {
  try {
    const { language, code, input } = req.body;
    
    // Use a service like Judge0, JDoodle, or Sphere Engine
    // This is an example using Judge0 API
    const response = await axios.post('https://judge0-ce.p.rapidapi.com/submissions', {
      source_code: code,
      language_id: getLanguageId(language),
      stdin: input
    }, {
      headers: {
        'x-rapidapi-key': process.env.JUDGE0_API_KEY,
        'x-rapidapi-host': 'judge0-ce.p.rapidapi.com',
        'content-type': 'application/json'
      }
    });
    
    // Get the token from the submission
    const token = response.data.token;
    
    // Poll for results
    let result;
    let attempts = 0;
    
    while (!result && attempts < 10) {
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      const resultResponse = await axios.get(`https://judge0-ce.p.rapidapi.com/submissions/${token}`, {
        headers: {
          'x-rapidapi-key': process.env.JUDGE0_API_KEY,
          'x-rapidapi-host': 'judge0-ce.p.rapidapi.com'
        }
      });
      
      if (resultResponse.data.status.id > 2) { // If status is not "In Queue" or "Processing"
        result = resultResponse.data;
      }
      
      attempts++;
    }
    
    if (!result) {
      return res.status(408).json({ error: 'Execution timed out' });
    }
    
    // Format and send the response
    return res.json({
      output: result.stdout || '',
      error: result.stderr || '',
      status: result.status.description,
      time: result.time,
      memory: result.memory
    });
    
  } catch (error) {
    console.error('Code execution error:', error);
    return res.status(500).json({ error: 'Failed to execute code' });
  }
});

// Helper function to map language names to Judge0 language IDs
function getLanguageId(language) {
  const languageMap = {
    'javascript': 63,  // JavaScript (Node.js 12.14.0)
    'python': 71,      // Python (3.8.1)
    'java': 62,        // Java (OpenJDK 13.0.1)
    'c': 50,           // C (GCC 9.2.0)
    'cpp': 54,         // C++ (GCC 9.2.0)
    'csharp': 51,      // C# (Mono 6.6.0.161)
    'php': 68,         // PHP (7.4.1)
    'ruby': 72,        // Ruby (2.7.0)
    'sql': 82          // SQL (SQLite 3.27.2)
  };
  
  return languageMap[language] || 71; // Default to Python if language not found
}

module.exports = router;
