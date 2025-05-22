const express = require("express");
const mysql = require("mysql2");
const cors = require("cors");
const dotenv = require("dotenv");
const authRoutes = require("./routes/auth");
const userRoutes = require("./routes/user");
const notesRoutes = require("./routes/notes");
const studyMaterialsRoutes = require("./routes/studyMaterials");
const examRoutes = require("./routes/exam");
const dashboardRoutes = require("./routes/dashboard");
const teacherRoutes = require("./routes/teacherRoutes");
const studentRoutes = require("./routes/studentRoutes");
const teachersRoutes = require("./routes/teachersRoutes");
const adminRoutes = require("./routes/adminRoutes");
const paymentRoutes = require("./routes/paymentRoutes");
const codeExecutionRoutes = require("./routes/codeExecution");
const noteSummaryRoutes = require('./routes/noteSummaryRoutes');
const predictionRoutes = require('./routes/predictionRoutes');
const aiRoutes = require('./routes/aiRoutes');
const auth = require('./middleware/auth');
const uploadController = require('./controllers/uploadController');
const axios = require("axios");
const path = require("path");
dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());
app.use("/api/study-materials", studyMaterialsRoutes);
app.use("/uploads", express.static(path.join(__dirname, "uploads")));
app.use("/api/upload", require("./routes/uploadRoutes"));
app.use("/api/students", studentRoutes); 
app.use("/api/teachers", teachersRoutes); 
app.use("/api/admin", adminRoutes);
app.use("/api/payment", paymentRoutes);
app.use("/api/code", codeExecutionRoutes);
app.use('/api/note-summaries', noteSummaryRoutes);
app.use('/api/notes', noteSummaryRoutes);
app.use('/api/predictions', predictionRoutes);
app.use('/api/ai', aiRoutes);
// Add this to your existing routes
app.use(
  "/api/subjects-semesters",
  require("./routes/notes").subjectsAndSemesters
);
app.use("/api/study-folders", require("./routes/studyFolderRoutes"));
// Add this to your existing routes
app.use("/api/notices", require("./routes/noticeRoutes"));
// Database connection
const db = mysql.createConnection({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
});

db.connect((err) => {
  if (err) {
    console.error("Database connection failed:", err);
  } else {
    console.log("Connected to database");
  }
});

global.db = db;

// Routes
app.use("/api/auth", authRoutes);
app.use("/api/user", userRoutes);
app.use("/api/notes", notesRoutes);
app.use("/api/exam", examRoutes);
app.use("/api/dashboard", dashboardRoutes);
app.use("/api/teacher", teacherRoutes);
// Add this to your existing routes if it's not already there
app.use("/api/study-folders", require("./routes/studyFolderRoutes"));
app.use('/api/teacher-uploads', require('./routes/teacherUploadRoutes'));
app.post("/chat", async (req, res) => {
  const { message } = req.body;
  
  try {
    // Check if we have an API key
    if (!process.env.OPENAI_API_KEY) {
      throw new Error("OpenAI API key is not configured");
    }
    
    // Make the request to OpenAI
    const response = await axios.post(
      "https://api.openai.com/v1/chat/completions", 
      {
        model: "gpt-3.5-turbo",
        messages: [{ role: "user", content: message }],
        max_tokens: 500,
        temperature: 0.7
      }, 
      {
        headers: { 
          "Authorization": `Bearer ${process.env.OPENAI_API_KEY}`,
          "Content-Type": "application/json"
        },
        timeout: 10000
      }
    );

    const aiReply = response.data.choices[0].message.content;
    res.json({ reply: aiReply });
    
  } catch (error) {
    console.error("OpenAI API error:", error);
    
    // Handle quota exceeded error specifically
    if (error.response && 
        error.response.status === 429 && 
        error.response.data && 
        error.response.data.error && 
        error.response.data.error.code === 'insufficient_quota') {
      
      return res.json({ 
        reply: "I'm sorry, but the AI service is currently unavailable due to quota limitations. Please contact the administrator to resolve this issue.",
        error: "QUOTA_EXCEEDED"
      });
    }
    
    // Handle other rate limiting
    if (error.response && error.response.status === 429) {
      return res.json({ 
        reply: "I'm currently experiencing high demand. Please try again in a few moments.",
        isRateLimited: true
      });
    }
    
    // Generic error handler
    res.status(500).json({ 
      error: "Failed to get response from AI service",
      details: error.message
    });
  }
});
// Add this route to your main routes file
app.get('/api/uploads/subject-distribution', auth, uploadController.getSubjectDistribution);

app.post("/predict", (req, res) => {
  console.log("=== PREDICT ENDPOINT CALLED ===");
  console.log("Request body:", req.body);
  const { inputValue } = req.body;
  console.log("Input value:", inputValue);
  
  let responseHasBeenSent = false;
  
  console.log("Spawning Python process...");
  // Call Python script to load model and predict
  const pythonProcess = spawn("python", ["predict.py", inputValue]);
  console.log("Python process spawned");

  pythonProcess.stdout.on("data", (data) => {
    console.log("Python stdout data received:", data.toString());
    if (!responseHasBeenSent) {
      responseHasBeenSent = true;
      console.log("Sending success response with prediction:", data.toString().trim());
      res.json({ prediction: data.toString().trim() });
    } else {
      console.log("Additional stdout data received but response already sent");
    }
  });

  pythonProcess.stderr.on("data", (data) => {
    console.error("Python stderr:", data.toString());
    if (!responseHasBeenSent) {
      responseHasBeenSent = true;
      console.log("Sending error response due to Python stderr");
      res.status(500).json({ error: "Error in model prediction.", details: data.toString() });
    } else {
      console.log("Error received but response already sent");
    }
  });
  
  pythonProcess.on("error", (error) => {
    console.error("Python process error:", error.message);
    if (!responseHasBeenSent) {
      responseHasBeenSent = true;
      console.log("Sending error response due to process error");
      res.status(500).json({ error: "Failed to start Python process.", details: error.message });
    } else {
      console.log("Process error occurred but response already sent");
    }
  });
  
  pythonProcess.on("close", (code) => {
    console.log(`Python process exited with code ${code}`);
    if (!responseHasBeenSent) {
      responseHasBeenSent = true;
      if (code !== 0) {
        console.log(`Sending error response due to non-zero exit code: ${code}`);
        res.status(500).json({ error: `Python process exited with code ${code}` });
      } else {
        console.log("Python process completed successfully but no output was received");
        res.status(500).json({ error: "No output from prediction model" });
      }
    } else {
      console.log("Process closed but response already sent");
    }
  });
  
  // Add a timeout in case the Python process hangs
  setTimeout(() => {
    if (!responseHasBeenSent) {
      responseHasBeenSent = true;
      console.log("Timeout reached, sending timeout response");
      res.status(504).json({ error: "Prediction request timed out" });
      pythonProcess.kill(); // Kill the Python process
    }
  }, 30000); // 30 seconds timeout
});

 

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
