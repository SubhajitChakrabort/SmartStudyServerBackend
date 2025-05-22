const db = require("../config/db");
const util = require("util");

// Convert db.query to use promises
const query = util.promisify(db.query).bind(db);

// Helper function to calculate moving average
const calculateMovingAverage = (data, window = 3) => {
  const result = [];
  for (let i = 0; i < data.length; i++) {
    if (i < window - 1) {
      result.push(data[i]);
    } else {
      const windowSlice = data.slice(i - window + 1, i + 1);
      const sum = windowSlice.reduce((acc, val) => acc + val, 0);
      result.push(sum / window);
    }
  }
  return result;
};

// Helper function to identify trends
const identifyTrend = (data) => {
  if (data.length < 2) return "stable";

  const lastValue = data[data.length - 1];
  const secondLastValue = data[data.length - 2];

  if (lastValue > secondLastValue * 1.05) return "increasing";
  if (lastValue < secondLastValue * 0.95) return "decreasing";
  return "stable";
};

// Get prediction insights for a student
exports.getStudentInsights = async (req, res) => {
  try {
    const userId = req.user.id;

    // Initialize averageScore with a default value at the beginning
    let averageScore = 75; // Default value

    // Fetch user's exam history - using real exam data
    const exams = await query(
      "SELECT * FROM exam_results WHERE user_id = ? ORDER BY completed_at ASC",
      [userId]
    );

    // Fetch user's notes
    const notes = await query(
      "SELECT * FROM notes WHERE user_id = ? ORDER BY created_at DESC",
      [userId]
    );

    // Fetch user's study materials
    const studyMaterials = await query(
      "SELECT * FROM study_materials WHERE user_id = ? ORDER BY created_at DESC",
      [userId]
    );

    // Fetch user's study folders
    const studyFolders = await query(
      "SELECT * FROM study_folders WHERE user_id = ? ORDER BY created_at DESC",
      [userId]
    );

    // Fetch user's activity data
    const activities = await query(
      "SELECT * FROM student_activities WHERE user_id = ? ORDER BY timestamp ASC",
      [userId]
    );

    // If no data is available, return default predictions
    if (
      exams.length === 0 &&
      notes.length === 0 &&
      studyMaterials.length === 0
    ) {
      return res.json({
        performanceTrend: generateDefaultPerformanceTrend(),
        recommendedSubjects: [
          { name: "Mathematics", relevance: 85 },
          { name: "Computer Science", relevance: 78 },
          { name: "Physics", relevance: 65 },
        ],
        weakAreas: [
          { name: "Chemistry", score: 45 },
          { name: "Biology", score: 52 },
        ],
        predictedScore: 75,
        studyTimeRecommendation: 4, // Default study time recommendation
        performancePercentile: 65,
        nextExamPrediction: 78,
        learningPatternInsights:
          "You learn best in the morning. Try to allocate more study time before noon.",
        stats: {
          totalNotes: 0,
          totalStudyMaterials: 0,
          totalExams: 0,
          totalStudyFolders: 0,
          averageScore: 75, // Default average score
        },
      });
    }

    // Extract exam scores and dates
    const examScores = exams.map((exam) => {
      // Calculate percentage score
      return Math.round((exam.score / exam.total_questions) * 100);
    });

    // Calculate average score directly from exam scores
    if (examScores.length > 0) {
      // Calculate the sum of all exam scores
      const totalScore = examScores.reduce((sum, score) => sum + score, 0);
      // Calculate the average
      averageScore = Math.round(totalScore / examScores.length);
    } else {
      // If no exams, try to get average from database
      const avgScoreResult = await query(
        "SELECT AVG(score/total_questions*100) as avg_score FROM exam_results WHERE user_id = ?",
        [userId]
      );
      
      if (avgScoreResult[0] && avgScoreResult[0].avg_score) {
        averageScore = Math.round(avgScoreResult[0].avg_score);
      }
    }

    // Ensure averageScore is a valid number
    averageScore = isNaN(averageScore) ? 75 : averageScore;

    const examDates = exams.map((exam) => {
      const date = new Date(exam.completed_at);
      return date.toISOString().split("T")[0];
    });

    // Calculate moving average for smoothing
    const smoothedScores = calculateMovingAverage(examScores);

    // Simple linear regression for prediction
    const predictedNextScore = predictNextScore(examScores) || 75;

    const noteSubjects = notes.map((note) => note.subject_name).filter(Boolean);
    const studyMaterialSubjects = studyMaterials
      .map((material) => material.subject_name)
      .filter(Boolean);

    // Combine all subjects
    const allSubjects = [
      ...new Set([...noteSubjects, ...studyMaterialSubjects]),
    ];

    // Analyze subject performance based on notes, study materials, and exam results
    const subjectPerformance = {};

    // Initialize subject performance with default values
    allSubjects.forEach((subject) => {
      subjectPerformance[subject] = 50; // Default score
    });

    // Update subject performance based on notes count (more notes = more interest/engagement)
    noteSubjects.forEach((subject) => {
      const subjectNotes = notes.filter(
        (note) => note.subject_name === subject
      );
      // Increase score based on number of notes (max +15 points)
      const notesBonus = Math.min(15, subjectNotes.length * 3);
      subjectPerformance[subject] += notesBonus;
    });

    // Update subject performance based on study materials
    studyMaterialSubjects.forEach((subject) => {
      const subjectMaterials = studyMaterials.filter(
        (material) => material.subject_name === subject
      );
      // Increase score based on number of study materials (max +10 points)
      const materialsBonus = Math.min(10, subjectMaterials.length * 2);
      subjectPerformance[subject] += materialsBonus;
    });

    // Get weak areas (subjects with lowest scores)
    const weakAreas = Object.entries(subjectPerformance)
      .sort((a, b) => a[1] - b[1])
      .slice(0, 3)
      .map(([name, score]) => ({ name, score: Math.round(score) }));

    // Get recommended subjects (subjects with highest scores or most interest)
    const recommendedSubjects = Object.entries(subjectPerformance)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([name, score]) => ({ name, relevance: Math.round(score) }));

    // Analyze study patterns from activity data
    const studyPatterns = analyzeStudyPatterns(activities);

    // Calculate performance percentile (compare to other students)
    const performancePercentile = await calculatePercentile(examScores, userId);

    // Ensure performancePercentile is never 0
    const finalPercentile =
      performancePercentile > 0 ? performancePercentile : 50;

    // Generate performance trend data
    const performanceTrend = [];
    for (let i = 0; i < examScores.length; i++) {
      performanceTrend.push({
        date: examDates[i],
        actual: examScores[i],
        predicted: i > 0 ? smoothedScores[i] : examScores[i],
      });
    }

    // Add future prediction point
    const lastDate =
      examDates.length > 0
        ? new Date(examDates[examDates.length - 1])
        : new Date();
    const nextDate = new Date(lastDate);
    nextDate.setDate(nextDate.getDate() + 30); // Predict one month ahead

    performanceTrend.push({
      date: nextDate.toISOString().split("T")[0],
      actual: null,
      predicted: predictedNextScore,
    });

    // Calculate recommended study time based on performance and goals
    // Ensure this is always a number between 1 and 8
    let studyTimeRecommendation = 4; // Default value
    if (examScores.length > 0) {
      studyTimeRecommendation = calculateStudyTimeRecommendation(
        examScores,
        weakAreas.length
      );
    }
    // Ensure it's a valid number and round it
    studyTimeRecommendation = Math.round(Math.max(1, Math.min(8, studyTimeRecommendation || 4)));

    // Generate learning pattern insights
    const learningPatternInsights = generateLearningInsights(
      studyPatterns,
      examScores
    );

    console.log("Student insights response:", {
      studyTimeRecommendation,
      averageScore,
    });

    return res.json({
      performanceTrend,
      recommendedSubjects,
      weakAreas,
      predictedScore: Math.round(predictedNextScore),
      studyTimeRecommendation, // Make sure this is included
      performancePercentile: finalPercentile,
      nextExamPrediction: Math.round(predictedNextScore),
      learningPatternInsights,
      stats: {
        totalNotes: notes.length,
        totalStudyMaterials: studyMaterials.length,
        totalExams: exams.length,
        totalStudyFolders: studyFolders.length,
        averageScore, // Make sure this is included
      },
    });
  } catch (error) {
    console.error("Error generating predictions:", error);
    return res.json({ 
      error: "Failed to generate predictions",
      performanceTrend: generateDefaultPerformanceTrend(),
      recommendedSubjects: [
        { name: "Mathematics", relevance: 85 },
        { name: "Computer Science", relevance: 78 },
        { name: "Physics", relevance: 65 },
      ],
      weakAreas: [
        { name: "Chemistry", score: 45 },
        { name: "Biology", score: 52 },
      ],
      predictedScore: 75,
      studyTimeRecommendation: 4, // Default study time recommendation
      performancePercentile: 65,
      nextExamPrediction: 78,
      learningPatternInsights:
        "You learn best in the morning. Try to allocate more study time before noon.",
      stats: {
        totalNotes: 0,
        totalStudyMaterials: 0,
        totalExams: 0,
        totalStudyFolders: 0,
        averageScore: 75, // Default average score
      }
    });
  }
};


// Get prediction insights for teachers
exports.getTeacherInsights = async (req, res) => {
  try {
    const teacherId = req.user.id;

    // Get total students count directly from database
    const studentsResult = await query("SELECT COUNT(*) as count FROM users WHERE role = 'student'");
    const totalStudents = studentsResult[0].count;

    // Get total notes count directly from database
    const notesResult = await query("SELECT COUNT(*) as count FROM notes");
    const totalNotes = notesResult[0].count;

    // Get total exams count directly from database
    const examsResult = await query("SELECT COUNT(*) as count FROM exam_results");
    const totalExams = examsResult[0].count;

    // Calculate average score directly from database
    let averageScore = 75; // Default value
    const avgScoreResult = await query(
      "SELECT AVG(score/total_questions*100) as avg_score FROM exam_results"
    );
    
    if (avgScoreResult[0].avg_score) {
      averageScore = Math.round(avgScoreResult[0].avg_score);
    }

    // Calculate at-risk percentage
    // Students with average score below 60 are considered at risk
    const atRiskResult = await query(`
      SELECT COUNT(*) as count FROM (
        SELECT user_id, AVG(score/total_questions*100) as avg_score 
        FROM exam_results 
        GROUP BY user_id
        HAVING avg_score < 60
      ) as at_risk_students
    `);
    
    const atRiskCount = atRiskResult[0].count;
    const atRiskPercentage = totalStudents > 0 
      ? Math.round((atRiskCount / totalStudents) * 100) 
      : 15; // Default if no students

    // Get performance trend data
    const performanceTrend = await getTeacherPerformanceTrendData();

    // Get subject distribution
    const subjectDistribution = await getTeacherSubjectDistribution();

    // Get notes activity trend data
    const notesActivity = await getNotesActivityData();

    // Determine overall trend
    const overallTrend = "increase"; // You can calculate this based on trend data
    const overallChangePercentage = 5; // You can calculate this based on trend data

    return res.json({
      performanceTrend,
      atRiskPercentage,
      overallTrend,
      overallChangePercentage,
      subjectDistribution,
      notesActivity, // Add the notes activity data
      stats: {
        totalStudents,
        totalNotes,
        totalExams,
        averageScore,
      },
    });
  } catch (error) {
    console.error("Error generating teacher predictions:", error);
    // Return default data instead of an error
    return res.json({
      performanceTrend: generateDefaultPerformanceTrend(),
      atRiskPercentage: 15,
      overallTrend: "increase",
      overallChangePercentage: 5,
      notesActivity: generateDefaultNotesActivity(), // Add default notes activity
      stats: {
        totalStudents: 0,
        totalNotes: 0,
        totalExams: 0,
        averageScore: 75,
      },
    });
  }
};

// Helper function to get notes activity data
async function getNotesActivityData() {
  try {
    // Get notes created per day
    const notesActivityResult = await query(`
      SELECT 
        DATE(created_at) as note_date, 
        COUNT(*) as count 
      FROM notes 
      GROUP BY DATE(created_at) 
      ORDER BY note_date ASC
      LIMIT 30
    `);

    if (notesActivityResult.length === 0) {
      return generateDefaultNotesActivity();
    }

    // Format the data for the chart
    const notesActivityTrend = notesActivityResult.map(item => ({
      date: item.note_date.toISOString().split('T')[0],
      count: item.count
    }));

    // Get total notes count
    const totalNotesResult = await query("SELECT COUNT(*) as count FROM notes");
    const totalNotesCreated = totalNotesResult[0].count;

    return {
      notesActivityTrend,
      totalNotesCreated
    };
  } catch (error) {
    console.error("Error getting notes activity data:", error);
    return generateDefaultNotesActivity();
  }
}

// Helper function to generate default notes activity data
function generateDefaultNotesActivity() {
  const today = new Date();
  const notesActivityTrend = [];

  // Generate data for the past 14 days
  for (let i = 13; i >= 0; i--) {
    const date = new Date(today);
    date.setDate(date.getDate() - i);
    
    // Generate random count between 1 and 10
    const count = Math.floor(Math.random() * 10) + 1;
    
    notesActivityTrend.push({
      date: date.toISOString().split('T')[0],
      count: count
    });
  }

  return {
    notesActivityTrend,
    totalNotesCreated: 45 // Default value
  };
}

// Helper function to get performance trend data for teachers
async function getTeacherPerformanceTrendData() {
  try {
    // Get exam data grouped by date
    const examsByDateResult = await query(`
      SELECT 
        DATE(completed_at) as exam_date, 
        AVG(score/total_questions*100) as avg_score 
      FROM exam_results 
      GROUP BY DATE(completed_at) 
      ORDER BY exam_date ASC
    `);

    if (examsByDateResult.length === 0) {
      return generateDefaultPerformanceTrend();
    }

    // Format the data for the chart
    const performanceTrend = examsByDateResult.map(item => ({
      date: item.exam_date.toISOString().split('T')[0],
      actual: Math.round(item.avg_score),
      predicted: Math.round(item.avg_score), // For simplicity, use the same value
    }));

    // Add a future prediction point
    const lastDate = new Date(performanceTrend[performanceTrend.length - 1].date);
    const nextDate = new Date(lastDate);
    nextDate.setDate(nextDate.getDate() + 30); // Predict one month ahead

    // Simple prediction: last value + small increase
    const lastScore = performanceTrend[performanceTrend.length - 1].actual;
    const predictedScore = Math.min(100, lastScore + 5); // Cap at 100

    performanceTrend.push({
      date: nextDate.toISOString().split('T')[0],
      actual: null,
      predicted: predictedScore,
    });

    return performanceTrend;
  } catch (error) {
    console.error("Error getting teacher performance trend data:", error);
    return generateDefaultPerformanceTrend();
  }
}

// Helper function to get subject distribution for teachers
async function getTeacherSubjectDistribution() {
  try {
    const result = await query(`
      SELECT subject_name, COUNT(*) as count 
      FROM notes 
      WHERE subject_name IS NOT NULL 
      GROUP BY subject_name
    `);
    
    // Convert to object format
    const distribution = {};
    result.forEach(item => {
      distribution[item.subject_name] = item.count;
    });
    
    return distribution;
  } catch (error) {
    console.error("Error getting teacher subject distribution:", error);
    return { "Mathematics": 20, "Physics": 15, "Chemistry": 10 }; // Default values
  }
}


// Get prediction insights for admins
exports.getAdminInsights = async (req, res) => {
  try {
    // Get all students - make sure this query works
    const studentsResult = await query("SELECT COUNT(*) as count FROM users WHERE role = 'student'");
    const totalStudents = studentsResult[0].count;

    // Get all teachers - make sure this query works
    const teachersResult = await query("SELECT COUNT(*) as count FROM users WHERE role = 'teacher'");
    const totalTeachers = teachersResult[0].count;

    // Get total exams - make sure this query works
    const examsResult = await query("SELECT COUNT(*) as count FROM exam_results");
    const totalExams = examsResult[0].count;

    // Get total notes - make sure this query works
    const notesResult = await query("SELECT COUNT(*) as count FROM notes");
    const totalNotes = notesResult[0].count;

    // Get total study materials - make sure this query works
    const materialsResult = await query("SELECT COUNT(*) as count FROM study_materials");
    const totalStudyMaterials = materialsResult[0].count;

    // Calculate average score from all exams
    let averageScore = 75; // Default value
    const avgScoreResult = await query(
      "SELECT AVG(score/total_questions*100) as avg_score FROM exam_results"
    );
    
    if (avgScoreResult[0].avg_score) {
      averageScore = Math.round(avgScoreResult[0].avg_score);
    }

    // Get performance trend data
    const performanceTrend = await getPerformanceTrendData();

    // Get department distribution
    const departmentDistribution = await getDepartmentDistribution();

    // Get semester distribution
    const semesterDistribution = await getSemesterDistribution();

    // Get subject distribution
    const subjectDistribution = await getSubjectDistribution();

    return res.json({
      performanceTrend,
      overallTrend: "increase", // You can calculate this based on trend data
      overallChangePercentage: 7, // You can calculate this based on trend data
      subjectDistribution,
      departmentDistribution,
      semesterDistribution,
      stats: {
        totalStudents,
        totalTeachers,
        totalNotes,
        totalExams,
        totalStudyMaterials,
        averageScore,
      },
    });
  } catch (error) {
    console.error("Error generating admin predictions:", error);
    // Return default data instead of an error
    return res.json({
      performanceTrend: generateDefaultPerformanceTrend(),
      overallTrend: "increase",
      overallChangePercentage: 7,
      stats: {
        totalStudents: 0,
        totalTeachers: 0,
        totalNotes: 0,
        totalExams: 0,
        totalStudyMaterials: 0,
        averageScore: 75,
      },
    });
  }
};

// Helper functions for getting distribution data
async function getPerformanceTrendData() {
  try {
    // Get exam data grouped by date
    const examsByDateResult = await query(`
      SELECT 
        DATE(completed_at) as exam_date, 
        AVG(score/total_questions*100) as avg_score 
      FROM exam_results 
      GROUP BY DATE(completed_at) 
      ORDER BY exam_date ASC
    `);

    if (examsByDateResult.length === 0) {
      return generateDefaultPerformanceTrend();
    }

    // Format the data for the chart
    const performanceTrend = examsByDateResult.map(item => ({
      date: item.exam_date.toISOString().split('T')[0],
      actual: Math.round(item.avg_score),
      predicted: Math.round(item.avg_score), // For simplicity, use the same value
    }));

    // Add a future prediction point
    const lastDate = new Date(performanceTrend[performanceTrend.length - 1].date);
    const nextDate = new Date(lastDate);
    nextDate.setDate(nextDate.getDate() + 30); // Predict one month ahead

    // Simple prediction: last value + small increase
    const lastScore = performanceTrend[performanceTrend.length - 1].actual;
    const predictedScore = Math.min(100, lastScore + 5); // Cap at 100

    performanceTrend.push({
      date: nextDate.toISOString().split('T')[0],
      actual: null,
      predicted: predictedScore,
    });

    return performanceTrend;
  } catch (error) {
    console.error("Error getting performance trend data:", error);
    return generateDefaultPerformanceTrend();
  }
}

async function getDepartmentDistribution() {
  try {
    const result = await query(`
      SELECT department, COUNT(*) as count 
      FROM users 
      WHERE role = 'student' AND department IS NOT NULL 
      GROUP BY department
    `);
    
    // Convert to object format
    const distribution = {};
    result.forEach(item => {
      distribution[item.department] = item.count;
    });
    
    return distribution;
  } catch (error) {
    console.error("Error getting department distribution:", error);
    return { "Computer Science": 10, "Engineering": 8, "Business": 5 }; // Default values
  }
}

async function getSemesterDistribution() {
  try {
    const result = await query(`
      SELECT semester, COUNT(*) as count 
      FROM users 
      WHERE role = 'student' AND semester IS NOT NULL 
      GROUP BY semester
    `);
    
    // Convert to object format
    const distribution = {};
    result.forEach(item => {
      distribution[item.semester] = item.count;
    });
    
    return distribution;
  } catch (error) {
    console.error("Error getting semester distribution:", error);
    return { "1": 15, "2": 12, "3": 8, "4": 5 }; // Default values
  }
}

async function getSubjectDistribution() {
  try {
    const result = await query(`
      SELECT subject_name, COUNT(*) as count 
      FROM notes 
      WHERE subject_name IS NOT NULL 
      GROUP BY subject_name
    `);
    
    // Convert to object format
    const distribution = {};
    result.forEach(item => {
      distribution[item.subject_name] = item.count;
    });
    
    return distribution;
  } catch (error) {
    console.error("Error getting subject distribution:", error);
    return { "Mathematics": 20, "Physics": 15, "Chemistry": 10 }; // Default values
  }
}

// Get insights for all users (router will determine which function to call)
exports.getInsights = async (req, res) => {
  try {
    console.log("Getting insights for user:", {
      id: req.user.id,
      role: req.user.role,
      hasEmail: !!req.user.email,
    });

    const userRole = req.user.role;

    if (!userRole) {
      console.error("User role is missing:", req.user);
      return res.status(400).json({ error: "User role is missing" });
    }

    if (userRole === "student") {
      return await exports.getStudentInsights(req, res);
    } else if (userRole === "teacher") {
      return await exports.getTeacherInsights(req, res);
    } else if (userRole === "admin") {
      return await exports.getAdminInsights(req, res);
    } else {
      console.error("Unauthorized role:", userRole);
      return res.status(403).json({ error: "Unauthorized role" });
    }
  } catch (error) {
    console.error("Error in getInsights:", error);
    // Return a default response instead of an error
    return res.json({
      performanceTrend: generateDefaultPerformanceTrend(),
      recommendedSubjects: [
        { name: "Mathematics", relevance: 85 },
        { name: "Computer Science", relevance: 78 },
        { name: "Physics", relevance: 65 },
      ],
      weakAreas: [
        { name: "Chemistry", score: 45 },
        { name: "Biology", score: 52 },
      ],
      predictedScore: 75,
      studyTimeRecommendation: 4,
      performancePercentile: 65,
      nextExamPrediction: 78,
      learningPatternInsights:
        "You learn best in the morning. Try to allocate more study time before noon.",
      stats: {
        totalStudents: 0,
        totalTeachers: 0,
        totalNotes: 0,
        totalExams: 0,
        totalStudyMaterials: 0,
        averageScore: 75,
      },
    });
  }
};

// Helper functions for predictions

// Predict next score using simple linear regression
function predictNextScore(scores) {
  if (scores.length <= 1) return scores[0] || 75; // Default if not enough data

  const n = scores.length;
  const x = Array.from({ length: n }, (_, i) => i + 1); // [1, 2, 3, ...]

  // Calculate means
  const meanX = x.reduce((sum, val) => sum + val, 0) / n;
  const meanY = scores.reduce((sum, val) => sum + val, 0) / n;

  // Calculate slope (m) and y-intercept (b)
  let numerator = 0;
  let denominator = 0;

  for (let i = 0; i < n; i++) {
    numerator += (x[i] - meanX) * (scores[i] - meanY);
    denominator += (x[i] - meanX) ** 2;
  }

  const slope = denominator !== 0 ? numerator / denominator : 0;
  const intercept = meanY - slope * meanX;

  // Predict next value
  const nextX = n + 1;
  const prediction = slope * nextX + intercept;

  // Ensure prediction is within reasonable bounds (0-100)
  return Math.max(0, Math.min(100, prediction));
}
// Analyze study patterns from activity data
function analyzeStudyPatterns(activities) {
  if (!activities || activities.length === 0) {
    return {
      preferredTime: "morning",
      averageDuration: 2,
      consistency: "moderate",
    };
  }

  // Count activities by time of day
  const timeOfDay = {
    morning: 0, // 5am - 12pm
    afternoon: 0, // 12pm - 5pm
    evening: 0, // 5pm - 10pm
    night: 0, // 10pm - 5am
  };

  // Calculate average duration
  let totalDuration = 0;

  activities.forEach((activity) => {
    const timestamp = new Date(activity.timestamp);
    const hour = timestamp.getHours();

    if (hour >= 5 && hour < 12) {
      timeOfDay.morning++;
    } else if (hour >= 12 && hour < 17) {
      timeOfDay.afternoon++;
    } else if (hour >= 17 && hour < 22) {
      timeOfDay.evening++;
    } else {
      timeOfDay.night++;
    }

    if (activity.duration) {
      totalDuration += activity.duration;
    }
  });

  // Find preferred time of day
  const preferredTime = Object.keys(timeOfDay).reduce((a, b) =>
    timeOfDay[a] > timeOfDay[b] ? a : b
  );

  // Calculate average duration
  const averageDuration =
    activities.length > 0 ? totalDuration / activities.length : 2;

  // Determine consistency (simple algorithm)
  // Group activities by day and count days with activities
  const activityDays = new Set();
  activities.forEach((activity) => {
    const timestamp = new Date(activity.timestamp);
    const day = timestamp.toISOString().split("T")[0];
    activityDays.add(day);
  });

  // Calculate days between first and last activity
  const dates = activities.map((a) => new Date(a.timestamp));
  const firstDate = new Date(Math.min(...dates));
  const lastDate = new Date(Math.max(...dates));
  const daysBetween =
    Math.ceil((lastDate - firstDate) / (1000 * 60 * 60 * 24)) || 1;

  // Calculate consistency ratio
  const consistencyRatio = activityDays.size / daysBetween;

  let consistency;
  if (consistencyRatio >= 0.8) {
    consistency = "high";
  } else if (consistencyRatio >= 0.5) {
    consistency = "moderate";
  } else {
    consistency = "low";
  }

  return {
    preferredTime,
    averageDuration,
    consistency,
  };
}

// Calculate percentile (compare to other students)
async function calculatePercentile(scores, userId) {
  if (!scores || scores.length === 0) return 50;

  try {
    // Calculate this student's average score
    const avgScore =
      scores.reduce((sum, score) => sum + score, 0) / scores.length;

    // Get all other students' exam results
    const allExams = await query(
      "SELECT user_id, AVG(score/total_questions*100) as avg_score FROM exam_results WHERE user_id != ? GROUP BY user_id",
      [userId]
    );

    if (allExams.length === 0) return 50;

    // Count how many students have lower average scores
    const lowerScores = allExams.filter(
      (exam) => exam.avg_score < avgScore
    ).length;

    // Calculate percentile
    const percentile = Math.round((lowerScores / allExams.length) * 100);

    return percentile;
  } catch (error) {
    console.error("Error calculating percentile:", error);
    return 50; // Default value
  }
}


function calculateStudyTimeRecommendation(scores, weakAreasCount) {
  if (!scores || scores.length === 0) return 4;

  // Calculate average score
  const avgScore =
    scores.reduce((sum, score) => sum + score, 0) / scores.length;

  // Base recommendation on average score and number of weak areas
  let baseTime;

  if (avgScore >= 90) {
    baseTime = 2; // High performers need less time to maintain
  } else if (avgScore >= 75) {
    baseTime = 3; // Good performers need moderate time
  } else if (avgScore >= 60) {
    baseTime = 4; // Average performers need more time
  } else {
    baseTime = 5; // Struggling students need more intensive study
  }

  // Add time for each weak area
  const weakAreaAdjustment = weakAreasCount * 0.5;

  // Calculate final recommendation (cap at 8 hours) and round to nearest integer
  return Math.round(Math.min(8, Math.max(1, baseTime + weakAreaAdjustment)));
}

// Generate learning insights based on study patterns and performance
function generateLearningInsights(studyPatterns, examScores) {
  if (!studyPatterns || !examScores || examScores.length === 0) {
    return "Try to establish a consistent study routine to improve your learning outcomes.";
  }

  const { preferredTime, averageDuration, consistency } = studyPatterns;
  const avgScore =
    examScores.reduce((sum, score) => sum + score, 0) / examScores.length;

  // Generate insights based on patterns
  let insights = "";

  // Time of day insights
  if (preferredTime === "morning") {
    insights +=
      "You tend to study in the morning, which is great for retention. ";
  } else if (preferredTime === "afternoon") {
    insights +=
      "You prefer studying in the afternoon. Consider trying morning sessions for difficult topics. ";
  } else if (preferredTime === "evening") {
    insights +=
      "Evening study sessions work well for you. Make sure to avoid studying too close to bedtime. ";
  } else {
    insights +=
      "You often study at night. While this works for some, consider if earlier sessions might improve your focus. ";
  }

  // Duration insights
  if (averageDuration < 1) {
    insights +=
      "Your study sessions are quite short. Try to extend them gradually for better comprehension. ";
  } else if (averageDuration > 4) {
    insights +=
      "Your study sessions are quite long. Consider breaking them into smaller chunks with breaks in between. ";
  } else {
    insights +=
      "Your study session duration is good. Remember to take short breaks every 25-30 minutes. ";
  }

  // Consistency insights
  if (consistency === "high") {
    insights +=
      "Your consistent study habit is excellent and contributes to your learning success.";
  } else if (consistency === "moderate") {
    insights +=
      "Try to make your study schedule more consistent to improve retention and understanding.";
  } else {
    insights +=
      "Establishing a more regular study routine could significantly improve your performance.";
  }

  // Performance-based insights
  if (avgScore < 60 && consistency !== "high") {
    insights +=
      " Increasing your study consistency could help improve your scores.";
  } else if (avgScore < 60 && averageDuration < 2) {
    insights +=
      " Consider increasing your study time to improve your understanding of difficult concepts.";
  } else if (avgScore > 85) {
    insights += " Your current approach is working well. Keep it up!";
  }

  return insights;
}

// Calculate at-risk percentage for teacher view
async function calculateAtRiskPercentage(exams, studentIds) {
  if (!exams || exams.length === 0 || !studentIds || studentIds.length === 0) {
    return 15; // Default value
  }

  try {
    // Get average scores for each student
    const studentScores = await query(
      `SELECT user_id, AVG(score/total_questions*100) as avg_score 
             FROM exam_results 
             WHERE user_id IN (?) 
             GROUP BY user_id`,
      [studentIds]
    );

    if (studentScores.length === 0) return 15;

    // Count students with average score below threshold (e.g., 60)
    const threshold = 60;
    const atRiskCount = studentScores.filter(
      (student) => student.avg_score < threshold
    ).length;

    // Calculate percentage
    return Math.round((atRiskCount / studentIds.length) * 100);
  } catch (error) {
    console.error("Error calculating at-risk percentage:", error);
    return 15; // Default value
  }
}
// Generate default performance trend for new users
function generateDefaultPerformanceTrend() {
  const today = new Date();
  const dates = [];

  // Generate dates for the past 6 months
  for (let i = 5; i >= 0; i--) {
    const date = new Date(today);
    date.setMonth(date.getMonth() - i);
    dates.push(date.toISOString().split("T")[0]);
  }

  // Generate future date
  const futureDate = new Date(today);
  futureDate.setMonth(futureDate.getMonth() + 1);
  dates.push(futureDate.toISOString().split("T")[0]);

  // Generate mock data
  return [
    { date: dates[0], actual: 65, predicted: 65 },
    { date: dates[1], actual: 68, predicted: 67 },
    { date: dates[2], actual: 72, predicted: 70 },
    { date: dates[3], actual: 70, predicted: 73 },
    { date: dates[4], actual: 75, predicted: 74 },
    { date: dates[5], actual: 78, predicted: 77 },
    { date: dates[6], actual: null, predicted: 80 },
  ];
}

// Get detailed analytics for a specific subject
exports.getSubjectAnalytics = async (req, res) => {
  try {
    const userId = req.user.id;
    const { subject } = req.params;

    if (!subject) {
      return res.status(400).json({ error: "Subject parameter is required" });
    }

    // Get all notes for this subject
    const notes = await query(
      "SELECT * FROM notes WHERE user_id = ? AND subject_name = ? ORDER BY created_at DESC",
      [userId, subject]
    );

    // Get all study materials for this subject
    const studyMaterials = await query(
      "SELECT * FROM study_materials WHERE user_id = ? AND subject_name = ? ORDER BY created_at DESC",
      [userId, subject]
    );

    // Get all exam results for this subject
    const exams = await query(
      "SELECT * FROM exam_results WHERE user_id = ? AND subject = ? ORDER BY completed_at ASC",
      [userId, subject]
    );

    // Calculate time spent on this subject (from activities)
    const activities = await query(
      `SELECT * FROM student_activities 
         WHERE user_id = ? AND details LIKE ? 
         ORDER BY timestamp ASC`,
      [userId, `%"subject":"${subject}"%`]
    );

    // Calculate total time spent (in hours)
    const totalTimeSpent =
      activities.reduce((total, activity) => {
        return total + (activity.duration || 0);
      }, 0) / 60; // Convert minutes to hours

    // Calculate average score for this subject
    const examScores = exams.map((exam) =>
      Math.round((exam.score / exam.total_questions) * 100)
    );
    const averageScore =
      examScores.length > 0
        ? examScores.reduce((sum, score) => sum + score, 0) / examScores.length
        : 0;

    // Calculate progress over time
    const progressData = exams.map((exam) => {
      return {
        date: new Date(exam.completed_at).toISOString().split("T")[0],
        score: Math.round((exam.score / exam.total_questions) * 100),
      };
    });

    // Predict future performance
    const predictedScore = predictNextScore(examScores);

    // Get strengths and weaknesses within this subject
    // This would require more detailed data about specific topics within the subject
    // For now, we'll use mock data
    const strengths = ["Topic 1", "Topic 3", "Topic 5"];
    const weaknesses = ["Topic 2", "Topic 4"];

    // Calculate engagement level (based on number of notes, study materials, and activities)
    const engagementScore = Math.min(
      100,
      notes.length * 5 + studyMaterials.length * 10 + activities.length * 2
    );

    return res.json({
      subject,
      stats: {
        totalNotes: notes.length,
        totalStudyMaterials: studyMaterials.length,
        totalExams: exams.length,
        totalTimeSpent: Math.round(totalTimeSpent * 10) / 10, // Round to 1 decimal place
        averageScore: Math.round(averageScore),
        engagementScore: Math.round(engagementScore),
      },
      progressData,
      predictedScore: Math.round(predictedScore || 75),
      strengths,
      weaknesses,
      recentNotes: notes.slice(0, 5),
      recentMaterials: studyMaterials.slice(0, 5),
    });
  } catch (error) {
    console.error("Error generating subject analytics:", error);
    return res
      .status(500)
      .json({ error: "Failed to generate subject analytics" });
  }
};

// Get learning style analysis
exports.getLearningStyleAnalysis = async (req, res) => {
  try {
    const userId = req.user.id;

    // Get all user activities
    const activities = await query(
      "SELECT * FROM student_activities WHERE user_id = ? ORDER BY timestamp ASC",
      [userId]
    );

    // Get all notes
    const notes = await query(
      "SELECT * FROM notes WHERE user_id = ? ORDER BY created_at DESC",
      [userId]
    );

    // Get all study materials
    const studyMaterials = await query(
      "SELECT * FROM study_materials WHERE user_id = ? ORDER BY created_at DESC",
      [userId]
    );

    // Get all exam results
    const exams = await query(
      "SELECT * FROM exam_results WHERE user_id = ? ORDER BY completed_at ASC",
      [userId]
    );

    // If no data is available, return default analysis
    if (activities.length === 0 && notes.length === 0 && exams.length === 0) {
      return res.json({
        learningStyle: {
          visual: 33,
          auditory: 33,
          kinesthetic: 34,
        },
        studyHabits: {
          preferredTime: "evening",
          averageDuration: 2,
          consistency: "moderate",
          focusLevel: "medium",
        },
        recommendations: [
          "Try using visual aids like diagrams and charts",
          "Consider recording lectures and listening to them later",
          "Take regular breaks during study sessions",
          "Experiment with different study environments",
        ],
      });
    }

    // Analyze study patterns
    const studyPatterns = analyzeStudyPatterns(activities);

    // Analyze learning style based on activity types
    // This is a simplified approach - in a real system, you would need more detailed data
    const learningStyle = {
      visual: 0,
      auditory: 0,
      kinesthetic: 0,
    };

    // Count different types of study materials
    studyMaterials.forEach((material) => {
      if (material.file_path) {
        const extension = material.file_path.split(".").pop().toLowerCase();

        if (["pdf", "jpg", "jpeg", "png", "gif"].includes(extension)) {
          learningStyle.visual += 2;
        } else if (["mp3", "wav", "ogg"].includes(extension)) {
          learningStyle.auditory += 2;
        } else if (["mp4", "mov", "avi"].includes(extension)) {
          learningStyle.visual += 1;
          learningStyle.auditory += 1;
        }
      }
    });

    // Analyze activities
    activities.forEach((activity) => {
      const details = activity.details ? JSON.parse(activity.details) : {};

      if (
        details.activityType === "read_notes" ||
        details.activityType === "view_pdf"
      ) {
        learningStyle.visual += 1;
      } else if (details.activityType === "listen_audio") {
        learningStyle.auditory += 1;
      } else if (
        details.activityType === "practice_exercise" ||
        details.activityType === "take_exam"
      ) {
        learningStyle.kinesthetic += 1;
      }
    });

    // Ensure minimum values and normalize to percentages
    const minValue = 20; // Minimum percentage for any style

    // Add minimum values
    learningStyle.visual += minValue;
    learningStyle.auditory += minValue;
    learningStyle.kinesthetic += minValue;

    // Calculate total
    const total =
      learningStyle.visual + learningStyle.auditory + learningStyle.kinesthetic;

    // Normalize to percentages
    learningStyle.visual = Math.round((learningStyle.visual / total) * 100);
    learningStyle.auditory = Math.round((learningStyle.auditory / total) * 100);
    learningStyle.kinesthetic = Math.round(
      (learningStyle.kinesthetic / total) * 100
    );

    // Adjust to ensure total is 100%
    const adjustedTotal =
      learningStyle.visual + learningStyle.auditory + learningStyle.kinesthetic;
    if (adjustedTotal !== 100) {
      // Add or subtract the difference from the largest value
      const largest = Object.keys(learningStyle).reduce((a, b) =>
        learningStyle[a] > learningStyle[b] ? a : b
      );
      learningStyle[largest] += 100 - adjustedTotal;
    }

    // Generate recommendations based on learning style
    const recommendations = [];

    if (learningStyle.visual > 40) {
      recommendations.push(
        "Use more diagrams, charts, and visual aids in your notes"
      );
      recommendations.push("Try color-coding your notes for better retention");
      recommendations.push("Watch educational videos on difficult topics");
    }

    if (learningStyle.auditory > 40) {
      recommendations.push("Record lectures and listen to them during review");
      recommendations.push("Try reading your notes aloud when studying");
      recommendations.push(
        "Consider joining or forming study groups for discussion"
      );
    }

    if (learningStyle.kinesthetic > 40) {
      recommendations.push("Take frequent short breaks during study sessions");
      recommendations.push(
        "Try teaching concepts to others to reinforce learning"
      );
      recommendations.push("Use flashcards or other hands-on study tools");
    }

    // Add general recommendations based on study patterns
    if (studyPatterns.consistency === "low") {
      recommendations.push("Establish a more regular study schedule");
    }

    if (studyPatterns.averageDuration < 1) {
      recommendations.push(
        "Try to extend your study sessions for deeper understanding"
      );
    } else if (studyPatterns.averageDuration > 4) {
      recommendations.push(
        "Consider breaking long study sessions into smaller chunks with breaks"
      );
    }

    // Calculate focus level based on activity patterns
    let focusLevel = "medium";

    // If we have detailed activity data with start/end times, we could calculate this more accurately
    // For now, use a simplified approach
    if (
      studyPatterns.consistency === "high" &&
      studyPatterns.averageDuration >= 2
    ) {
      focusLevel = "high";
    } else if (
      studyPatterns.consistency === "low" ||
      studyPatterns.averageDuration < 1
    ) {
      focusLevel = "low";
    }

    return res.json({
      learningStyle,
      studyHabits: {
        ...studyPatterns,
        focusLevel,
      },
      recommendations: recommendations.slice(0, 5), // Limit to top 5 recommendations
    });
  } catch (error) {
    console.error("Error generating learning style analysis:", error);
    return res
      .status(500)
      .json({ error: "Failed to generate learning style analysis" });
  }
};

// Middleware to track user activity
const trackActivity = (activityType) => {
  return async (req, res, next) => {
    // Only track for authenticated users
    if (!req.user || req.user.role !== "student") {
      return next();
    }

    try {
      // Create a new activity record
      const activityData = {
        user_id: req.user.id,
        activity_type: activityType.substring(0, 20), // Truncate to fit column length
        timestamp: new Date(),
        details: JSON.stringify({
          url: req.originalUrl,
          method: req.method,
          ip: req.ip,
        }),
      };

      // Insert activity into database
      db.query("INSERT INTO student_activities SET ?", activityData, (err) => {
        if (err) {
          console.error("Error saving activity:", err);
        }
      });

      // Continue with the request
      next();
    } catch (error) {
      console.error("Activity tracking error:", error);
      next(); // Continue even if tracking fails
    }
  };
};

module.exports = {
  getInsights: exports.getInsights,
  getSubjectAnalytics: exports.getSubjectAnalytics,
  getLearningStyleAnalysis: exports.getLearningStyleAnalysis,
  getExamReadiness: exports.getExamReadiness,
  getStudyTimeOptimization: exports.getStudyTimeOptimization,
  trackActivity,
};
