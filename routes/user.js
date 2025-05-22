const express = require('express');
const router = express.Router();
const { updateProfile, getProfile } = require('../controllers/userController');
const auth = require('../middleware/auth');
// Add the database connection import
const db = require('../config/db');
const pool = db.promise();

router.get('/profile', auth, getProfile);
router.put('/update-profile', auth, updateProfile);

// GET subscription info
// GET subscription info
router.get('/subscription-info', auth, async (req, res) => {
    try {
      const userId = req.user.id;
      
      // First, let's check what columns are available in the users table
      const [columns] = await pool.query(`SHOW COLUMNS FROM users`);
      console.log('Available columns in users table:', columns.map(col => col.Field));
      
      // Find a date column that might represent registration date
      const dateColumns = columns.filter(col => 
        col.Field.toLowerCase().includes('date') || 
        col.Field.toLowerCase().includes('created') ||
        col.Field.toLowerCase().includes('registered')
      );
      
      console.log('Potential date columns:', dateColumns.map(col => col.Field));
      
      // Let's assume the first date-related column is our registration date
      // If no date column is found, we'll use the current date as a fallback
      const dateColumn = dateColumns.length > 0 ? dateColumns[0].Field : null;
      
      // Query the database to get the user's subscription details
      const query = `
        SELECT payment_plan${dateColumn ? `, ${dateColumn}` : ''} 
        FROM users 
        WHERE id = ?
      `;
      
      const [user] = await pool.query(query, [userId]);
      
      if (!user || user.length === 0) {
        return res.status(404).json({ error: 'User not found' });
      }
      
      const userData = user[0];
      
      // If user doesn't have a payment plan, they're not a regular student
      if (!userData.payment_plan) {
        return res.json({ daysLeft: null, message: 'No active subscription' });
      }
      
      // Calculate subscription end date based on payment plan
      // If we couldn't find a date column, use current date as fallback
      const registrationDate = dateColumn ? new Date(userData[dateColumn]) : new Date();
      let daysInPlan = 0;
      
      switch(userData.payment_plan) {
        case '1_month':
          daysInPlan = 30;
          break;
        case '3_month':
          daysInPlan = 90;
          break;
        case '6_month':
          daysInPlan = 180;
          break;
        case '18_month':
          daysInPlan = 540;
          break;
        case '24_month':
          daysInPlan = 720;
          break;
        default:
          daysInPlan = 0;
      }
      
      // Calculate end date by adding days to registration date
      const endDate = new Date(registrationDate);
      endDate.setDate(endDate.getDate() + daysInPlan);
      
      // Calculate days left
      const today = new Date();
      const timeDiff = endDate.getTime() - today.getTime();
      const daysLeft = Math.ceil(timeDiff / (1000 * 3600 * 24));
      
      // Return the days left
      return res.json({ 
        daysLeft: Math.max(0, daysLeft),
        endDate: endDate.toISOString().split('T')[0],
        plan: userData.payment_plan,
        registrationDate: registrationDate.toISOString().split('T')[0],
        dateColumnUsed: dateColumn || 'none'
      });
      
    } catch (error) {
      console.error('Error fetching subscription info:', error);
      res.status(500).json({ error: 'Failed to fetch subscription information' });
    }
});

  
module.exports = router;
