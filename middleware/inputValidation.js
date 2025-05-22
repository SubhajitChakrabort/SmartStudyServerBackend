const validator = require('validator');

const validateLoginInput = (req, res, next) => {
  const { username, password } = req.body;
  
  // Sanitize and validate username/email
  const sanitizedUsername = validator.escape(username.trim());
  if (!sanitizedUsername || sanitizedUsername.length < 3) {
    return res.status(400).json({ error: "Invalid username format" });
  }
  
  // Validate password format
  if (!password || password.length < 8) {
    return res.status(400).json({ error: "Invalid password format" });
  }
  
  req.body.username = sanitizedUsername;
  next();
};

module.exports = { validateLoginInput };
