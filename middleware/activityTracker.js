const db = require('../config/db');

// Middleware to track user activity
const trackActivity = (activityType) => {
  return async (req, res, next) => {
    // Only track for authenticated users
    if (!req.user || req.user.role !== 'student') {
      return next();
    }

    try {
      // Truncate activity type to fit in the column (assuming it's VARCHAR(20))
      const truncatedActivityType = activityType.substring(0, 20);
      
      // Create a new activity record
      const activityData = {
        user_id: req.user.id,
        activity_type: truncatedActivityType,
        timestamp: new Date(),
        details: JSON.stringify({
          url: req.originalUrl,
          method: req.method,
          ip: req.ip
        })
      };

      // Insert activity into database
      db.query(
        'INSERT INTO student_activities SET ?',
        activityData,
        (err) => {
          if (err) {
            console.error('Error saving activity:', err);
          }
        }
      );
      
      // Continue with the request
      next();
    } catch (error) {
      console.error('Activity tracking error:', error);
      next(); // Continue even if tracking fails
    }
  };
};

module.exports = trackActivity;
