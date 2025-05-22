// const jwt = require('jsonwebtoken');

// const auth = (req, res, next) => {
//   try {
//     const token = req.headers.authorization.split(' ')[1];
//     const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
//     // Map userId to id if it exists
//     if (decoded.userId && !decoded.id) {
//       decoded.id = decoded.userId;
//     }
    
//     req.user = decoded;
    
//     // Check if user ID exists after mapping
//     if (!req.user.id) {
//       return res.status(401).json({ error: 'Invalid token structure - no user ID' });
//     }
    
//     next();
//   } catch (error) {
//     res.status(401).json({ error: 'Authentication failed' });
//   }
// };

// module.exports = auth;

// const jwt = require('jsonwebtoken');
// const db = require('../config/db');
// const util = require('util');

// // Convert db.query to use promises
// const query = util.promisify(db.query).bind(db);

// module.exports = async (req, res, next) => {
//   try {
//     // Get token from header
//     const token = req.header('Authorization')?.replace('Bearer ', '');
    
//     if (!token) {
//       return res.status(401).json({ error: 'No token, authorization denied' });
//     }

//     // Verify token
//     const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
//     // Get user from database
//     const user = await query('SELECT id, email, role FROM users WHERE id = ?', [decoded.userId]);
    
//     if (user.length === 0) {
//       return res.status(401).json({ error: 'User not found' });
//     }
    
//     // Set user in request
//     req.user = user[0];
//     next();
//   } catch (error) {
//     console.error('Auth middleware error:', error);
//     res.status(401).json({ error: 'Token is not valid' });
//   }
// };
const jwt = require('jsonwebtoken');
const db = require('../config/db');
const util = require('util');

// Convert db.query to use promises
const query = util.promisify(db.query).bind(db);

module.exports = async (req, res, next) => {
  try {
    // Get token from header
    const token = req.header('Authorization')?.replace('Bearer ', '') || 
                 (req.headers.authorization && req.headers.authorization.split(' ')[1]);
    
    if (!token) {
      return res.status(401).json({ error: 'No token, authorization denied' });
    }

    // Verify token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
    // First, set the decoded token data (for compatibility with existing code)
    req.user = decoded;
    
    // Map userId to id if needed for compatibility
    if (decoded.userId && !decoded.id) {
      req.user.id = decoded.userId;
    }
    
    // Then, enhance with database data if available
    try {
      const user = await query('SELECT id, email, role FROM users WHERE id = ?', [req.user.id]);
      
      if (user.length > 0) {
        // Merge database user data with token data
        req.user = {
          ...req.user,
          ...user[0],
          // Ensure id is consistent
          id: req.user.id || user[0].id
        };
      }
    } catch (dbError) {
      console.error('Database lookup in auth middleware failed:', dbError);
      // Continue with just the token data if DB lookup fails
    }
    
    // Final check to ensure we have a user ID
    if (!req.user.id) {
      return res.status(401).json({ error: 'Invalid token structure - no user ID' });
    }
    
    next();
  } catch (error) {
    console.error('Auth middleware error:', error);
    res.status(401).json({ error: 'Token is not valid' });
  }
};



// const jwt = require('jsonwebtoken');

// const auth = (req, res, next) => {
//   try {
//     const token = req.headers.authorization.split(' ')[1];
//     const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
//     // Map userId to id if it exists
//     if (decoded.userId && !decoded.id) {
//       decoded.id = decoded.userId;
//     }
    
//     req.user = decoded;
    
//     // Check if user ID exists after mapping
//     if (!req.user.id) {
//       return res.status(401).json({ error: 'Invalid token structure - no user ID' });
//     }
    
//     next();
//   } catch (error) {
//     res.status(401).json({ error: 'Authentication failed' });
//   }
// };

// module.exports = auth;
