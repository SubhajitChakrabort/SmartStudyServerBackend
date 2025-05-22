const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const nodemailer = require("nodemailer");
const multer = require("multer");
const fs = require("fs");
const path = require("path");
const Razorpay = require("razorpay");
const crypto = require("crypto");
// Ensure the uploads/offer_letters directory exists
const razorpay = new Razorpay({
  key_id: "rzp_test_mFFaw12AfREkru", // Replace with your Razorpay key
  key_secret: "9e3RFXcJc0KijB84mtr3ZPQD", // Replace with your Razorpay secret
});
// const uploadDir = path.join(__dirname, "uploads/offer_letters");
// if (!fs.existsSync(uploadDir)) {
//   fs.mkdirSync(uploadDir, { recursive: true });
// }
// Ensure the uploads directories exist
const uploadOfferLetterDir = path.join(__dirname, "../uploads/offer_letters");
const uploadEmployeeIdDir = path.join(__dirname, "../uploads/employee_ids");

if (!fs.existsSync(uploadOfferLetterDir)) {
  fs.mkdirSync(uploadOfferLetterDir, { recursive: true });
}

if (!fs.existsSync(uploadEmployeeIdDir)) {
  fs.mkdirSync(uploadEmployeeIdDir, { recursive: true });
}

// Multer setup for file upload
// const storage = multer.diskStorage({
//   destination: (req, file, cb) => {
//     cb(null, "uploads/offer_letters/");
//   },
//   filename: (req, file, cb) => {
//     cb(null, `offer_${Date.now()}${path.extname(file.originalname)}`);
//   },
// });

// const upload = multer({ storage });
// Multer setup for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    let uploadPath;
    if (file.fieldname === "offerLetter") {
      uploadPath = path.join(__dirname, "../uploads/offer_letters");
    } else if (file.fieldname === "employeeIdProof") {
      uploadPath = path.join(__dirname, "../uploads/employee_ids");
    } else {
      uploadPath = path.join(__dirname, "../uploads");
    }
    
    // Ensure the directory exists
    if (!fs.existsSync(uploadPath)) {
      fs.mkdirSync(uploadPath, { recursive: true });
    }
    
    cb(null, uploadPath);
  },
  filename: (req, file, cb) => {
    const prefix = file.fieldname === "offerLetter" ? "offer_" : "empid_";
    cb(null, `${prefix}${Date.now()}${path.extname(file.originalname)}`);
  },
});


const upload = multer({ storage });

const transporter = nodemailer.createTransport({
  host: "sandbox.smtp.mailtrap.io",
  port: 2525,
  secure: false,
  auth: {
    user: "cbff29cf96af1b", // Replace with your actual Mailtrap username
    pass: "b9a155e18df283", // Replace with your actual Mailtrap password
  },
});

const register = async (req, res) => {
  try {
    const { username, email, name, phone, role, password, studentType, paymentPlan , department} = req.body;
    // Add these validation checks at the beginning of the register function
// 1. Check if email already exists
const emailCheckQuery = "SELECT id FROM users WHERE email = ?";
const emailExists = await new Promise((resolve, reject) => {
  db.query(emailCheckQuery, [email], (err, results) => {
    if (err) reject(err);
    resolve(results.length > 0);
  });
});

if (emailExists) {
  return res.status(400).json({ error: "Email already registered", field: "email" });
}

// 2. Check if username already exists
const usernameCheckQuery = "SELECT id FROM users WHERE username = ?";
const usernameExists = await new Promise((resolve, reject) => {
  db.query(usernameCheckQuery, [username], (err, results) => {
    if (err) reject(err);
    resolve(results.length > 0);
  });
});

if (usernameExists) {
  return res.status(400).json({ error: "Username already taken", field: "username" });
}

// 3. Validate phone number (must be 10 digits)
if (!/^\d{10}$/.test(phone)) {
  return res.status(400).json({ error: "Phone number must be 10 digits", field: "phone" });
}

// 4. Validate password (8-32 chars, must include letter, number, and special char)
if (password.length < 8 || password.length > 32) {
  return res.status(400).json({ 
    error: "Password must be between 8 and 32 characters", 
    field: "password" 
  });
}


if (!/[A-Za-z]/.test(password) || !/[0-9]/.test(password) || !/[^A-Za-z0-9]/.test(password)) {
  return res.status(400).json({ 
    error: "Password must include at least one letter, one number, and one special character", 
    field: "password" 
  });
}
// 3. Check if phone number already exists
const phoneCheckQuery = "SELECT id FROM users WHERE phone = ?";
const phoneExists = await new Promise((resolve, reject) => {
  db.query(phoneCheckQuery, [phone], (err, results) => {
    if (err) reject(err);
    resolve(results.length > 0);
  });
});

if (phoneExists) {
  return res.status(400).json({ error: "Phone number already registered", field: "phone" });
}

    const hashedPassword = await bcrypt.hash(password, 10);

    let offerLetterPath = null;
    let employeeIdProofPath = null;

    // Check for uploaded files
    if (req.files) {
      if (req.files.offerLetter && req.files.offerLetter.length > 0) {
        offerLetterPath = req.files.offerLetter[0].path;
        console.log("Offer letter path:", offerLetterPath);
      }
      if (req.files.employeeIdProof && req.files.employeeIdProof.length > 0) {
        employeeIdProofPath = req.files.employeeIdProof[0].path;
        console.log("Employee ID path:", employeeIdProofPath);
      }
    }

    // Insert user data into the database with the employee_id_proof_path column
    const query =
      "INSERT INTO users (username, email, name, phone, role, password, student_type, offer_letter_path, employee_id_proof_path, verified, payment_plan, department) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)";
    
    console.log("SQL parameters:", [
      username, email, name, phone, role, hashedPassword, studentType, 
      offerLetterPath, employeeIdProofPath, false, paymentPlan, department
    ]);
    
    db.query(
      query,
      [username, email, name, phone, role, hashedPassword, studentType, offerLetterPath, employeeIdProofPath, false, paymentPlan, department],
      async (err, result) => {
        if (err) {
          console.error("Database error:", err);
          return res.status(400).json({ error: err.message });
        }

        const userId = result.insertId;

        // Handle non-regular students
        if (role === "student" && studentType === "non-regular") {
          transporter.sendMail({
            from: "noreply@SmartStudy.com",
            to: "admin@example.com", // Replace with admin email
            subject: "New Non-Regular Student Registration",
            text: `A new non-regular student (${username}) has registered. Please verify their offer letter and employee ID proof.`,
          });

          return res.status(201).json({ message: "User registered successfully" });
        }

        // Handle regular students (payment required)
        if (role === "student" && studentType === "regular") {
          const paymentAmount = {
            "1_month": 45089, // ₹450.89 in paise
            "3_month": 105066, // ₹1050.66 in paise
            "6_month": 250003, // ₹2500.03 in paise
            "18_month": 650075, // ₹6500.75 in paise
            "24_month": 812808, // ₹8128.08 in paise
          }[paymentPlan];

          if (!paymentAmount) {
            return res.status(400).json({ error: "Invalid payment plan" });
          }

          // Create a Razorpay order
          const order = await razorpay.orders.create({
            amount: paymentAmount,
            currency: "INR",
            receipt: `receipt_${userId}_${Date.now()}`,
          });

          // Return the order ID to the frontend
          return res.status(201).json({
            message: "User registered successfully. Proceed to payment.",
            orderId: order.id,
            userId,
          });
        }

        // For non-student roles (e.g., teacher, admin)
        res.status(201).json({ message: "User registered successfully" });
      }
    );
  } catch (error) {
    console.error("Registration error:", error);
    res.status(500).json({ error: error.message });
  }
};


// const login = async (req, res) => {
//   try {
//     const { username, password } = req.body;

//     const query = "SELECT * FROM users WHERE username = ? OR email = ?";
//     db.query(query, [username, username], async (err, results) => {
//       if (err || results.length === 0) {
//         return res.status(401).json({ error: "Invalid credentials" });
//       }

//       const user = results[0];
//       const validPassword = await bcrypt.compare(password, user.password);

//       if (!validPassword) {
//         return res.status(401).json({ error: "Invalid credentials" });
//       }

//       // Check if the user is a non-regular student and not verified
//       if (user.role === "student" && user.student_type === "non-regular" && !user.verified) {
//         return res.status(403).json({ error: "Your account is not verified by the admin yet." });
//       }

//       // Generate OTP
//       const otp = Math.floor(100000 + Math.random() * 900000).toString();
//       const otpExpiry = new Date(Date.now() + 10 * 60000); // 10 minutes

//       const otpQuery =
//         "INSERT INTO otp_tokens (user_id, otp, expires_at) VALUES (?, ?, ?)";
//       db.query(otpQuery, [user.id, otp, otpExpiry]);

//       // Send OTP email
//       await transporter.sendMail({
//         from: "noreply@joblms.com",
//         to: user.email,
//         subject: "Login OTP",
//         text: `Your OTP for login is: ${otp}`,
//       });

//       const token = jwt.sign({ userId: user.id }, process.env.JWT_SECRET, {
//         expiresIn: "12h",
//       });
//       res.json({ token });
//     });
//   } catch (error) {
//     res.status(500).json({ error: error.message });
//   }
// };
const login = async (req, res) => {
  try {
    const { username, password } = req.body;
    
    // Use prepared statements with explicit column names
    const query = `
      SELECT id, username, email, password, role, student_type, verified, 
      login_attempts, active 
      FROM users 
      WHERE (username = ? OR email = ?) 
      AND active = true 
      AND login_attempts < 5 
      LIMIT 1
    `;
    
    db.execute(query, [username, username], async (err, results) => {
      if (err) {
        console.error('Login query error:', err);
        return res.status(500).json({ error: "Internal server error" });
      }
      
      if (results.length === 0) {
        await updateLoginAttempts(username);
        return res.status(401).json({ error: "Invalid credentials" });
      }

      const user = results[0];
      const validPassword = await bcrypt.compare(password, user.password);

      if (!validPassword) {
        await updateLoginAttempts(username);
        return res.status(401).json({ error: "Invalid credentials" });
      }

      // Check non-regular student verification
      if (user.role === "student" && user.student_type === "non-regular" && !user.verified) {
        return res.status(403).json({ error: "Your account is not verified by the admin yet." });
      }

      // Reset login attempts on successful login
      await resetLoginAttempts(user.id);

      // Generate OTP
      const otp = Math.floor(100000 + Math.random() * 900000).toString();
      const otpExpiry = new Date(Date.now() + 10 * 60000); // 10 minutes

      const otpQuery = "INSERT INTO otp_tokens (user_id, otp, expires_at) VALUES (?, ?, ?)";
      await db.execute(otpQuery, [user.id, otp, otpExpiry]);

      // Send OTP email with enhanced security headers
      await transporter.sendMail({
        from: "noreply@SmartStudy.com",
        to: user.email,
        subject: "Login OTP",
        text: `Your OTP for login is: ${otp}`,
        headers: {
          'X-Priority': 'High',
          'X-MSMail-Priority': 'High',
          'Importance': 'high'
        }
      });

      // Generate JWT token with limited payload
      const token = jwt.sign(
        { 
          userId: user.id,
          role: user.role,
          type: user.student_type 
        }, 
        process.env.JWT_SECRET,
        { 
          expiresIn: "12h",
          algorithm: 'HS256'
        }
      );

      res.json({ 
        token,
        role: user.role,
        requiresOTP: true
      });
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: "Server error" });
  }
};

// Track failed login attempts
const updateLoginAttempts = async (username) => {
  const query = `
    UPDATE users 
    SET login_attempts = login_attempts + 1,
    last_failed_login = CURRENT_TIMESTAMP
    WHERE username = ? OR email = ?
  `;
  return db.execute(query, [username, username]);
};

// Reset login attempts after successful login
const resetLoginAttempts = async (userId) => {
  const query = `
    UPDATE users 
    SET login_attempts = 0,
    last_successful_login = CURRENT_TIMESTAMP
    WHERE id = ?
  `;
  return db.execute(query, [userId]);
};

const verifyOTP = async (req, res) => {
  try {
    const { otp } = req.body;
    const token = req.headers.authorization.split(" ")[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    const query =
      "SELECT * FROM otp_tokens WHERE user_id = ? AND otp = ? AND expires_at > NOW() ORDER BY id DESC LIMIT 1";
    db.query(query, [decoded.userId, otp], (err, results) => {
      if (err || results.length === 0) {
        return res.status(401).json({ error: "Invalid or expired OTP" });
      }

      // Delete used OTP
      db.query("DELETE FROM otp_tokens WHERE id = ?", [results[0].id]);

      res.json({ message: "OTP verified successfully" });
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

const getProfile = async (req, res) => {
  try {
    const userId = req.user.userId;
    const query = "SELECT email FROM users WHERE id = ?";
    db.query(query, [userId], (err, results) => {
      if (err || results.length === 0) {
        return res.status(404).json({ error: "User not found" });
      }
      res.json({ email: results[0].email });
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// module.exports = {
//   register: [upload.single("offerLetter"), register], // Add multer middleware for file upload
//   login,
//   verifyOTP,
//   getProfile,
// };
// Add these functions to your existing authController.js
const forgotPassword = async (req, res) => {
  try {
    const { email } = req.body;

    // Check if user exists
    const query = "SELECT * FROM users WHERE email = ?";
    db.query(query, [email], async (err, results) => {
      if (err) {
        return res.status(500).json({ error: "Database error" });
      }

      if (results.length === 0) {
        // For security reasons, don't reveal that the email doesn't exist
        return res.status(200).json({ message: "If your email is registered, you will receive a password reset link." });
      }

      const user = results[0];
      
      // Generate a reset token
      const resetToken = crypto.randomBytes(32).toString('hex');
      const resetTokenExpiry = new Date(Date.now() + 60 * 60 * 1000); // 1 hour
      
      // Store the token in the database
      const tokenQuery = "INSERT INTO password_reset_tokens (user_id, token, expires_at) VALUES (?, ?, ?)";
      db.query(tokenQuery, [user.id, resetToken, resetTokenExpiry], async (err) => {
        if (err) {
          return res.status(500).json({ error: "Failed to generate reset token" });
        }
        
        // Create reset URL
        const resetUrl = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/reset-password/${resetToken}`;
        
        // Send email with reset link
        await transporter.sendMail({
          from: "noreply@SmartStudy.com",
          to: user.email,
          subject: "Password Reset Request",
          html: `
            <p>You requested a password reset.</p>
            <p>Click <a href="${resetUrl}">here</a> to reset your password.</p>
            <p>If you didn't request this, please ignore this email.</p>
            <p>This link will expire in 1 hour.</p>
          `,
        });
        
        res.status(200).json({ message: "Password reset link sent to your email" });
      });
    });
  } catch (error) {
    console.error("Forgot password error:", error);
    res.status(500).json({ error: "Server error" });
  }
};

const verifyResetToken = async (req, res) => {
  try {
    const { token } = req.params;
    
    // Check if token exists and is not expired
    const query = "SELECT * FROM password_reset_tokens WHERE token = ? AND expires_at > NOW()";
    db.query(query, [token], (err, results) => {
      if (err || results.length === 0) {
        return res.status(400).json({ error: "Invalid or expired token" });
      }
      
      res.status(200).json({ valid: true });
    });
  } catch (error) {
    console.error("Verify reset token error:", error);
    res.status(500).json({ error: "Server error" });
  }
};

const resetPassword = async (req, res) => {
  try {
    const { token, password } = req.body;
    
    // Find the token in the database
    const tokenQuery = "SELECT * FROM password_reset_tokens WHERE token = ? AND expires_at > NOW()";
    db.query(tokenQuery, [token], async (err, results) => {
      if (err || results.length === 0) {
        return res.status(400).json({ error: "Invalid or expired token" });
      }
      
      const userId = results[0].user_id;
      
      // Hash the new password
      const hashedPassword = await bcrypt.hash(password, 10);
      
      // Update the user's password
      const updateQuery = "UPDATE users SET password = ? WHERE id = ?";
      db.query(updateQuery, [hashedPassword, userId], (err) => {
        if (err) {
          return res.status(500).json({ error: "Failed to update password" });
        }
        
        // Delete the used token
        db.query("DELETE FROM password_reset_tokens WHERE token = ?", [token]);
        
        res.status(200).json({ message: "Password reset successful" });
      });
    });
  } catch (error) {
    console.error("Reset password error:", error);
    res.status(500).json({ error: "Server error" });
  }
};
const googleLogin = async (req, res) => {
  try {
    const { email, name } = req.body;
    
    // Check if user exists
    const findUserQuery = "SELECT * FROM users WHERE email = ?";
    db.query(findUserQuery, [email], async (err, results) => {
      if (err) {
        console.error("Database error:", err);
        return res.status(500).json({ error: "Database error" });
      }
      
      let userId;
      
      if (results.length === 0) {
        // User doesn't exist, create a new user
        const username = email.split('@')[0] + Math.floor(Math.random() * 1000);
        const randomPassword = crypto.randomBytes(16).toString('hex');
        const hashedPassword = await bcrypt.hash(randomPassword, 10);
        
        // Include all required fields with default values
        const createUserQuery = 
          "INSERT INTO users (username, email, name, phone, role, password, student_type, offer_letter_path, employee_id_proof_path, verified, payment_plan, department) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)";
        
        db.query(createUserQuery, [
          username,                // username
          email,                   // email
          name,                    // name
          '',                      // phone (empty default)
          'student',               // role
          hashedPassword,          // password
          'regular',               // student_type (default to regular)
          null,                    // offer_letter_path
          null,                    // employee_id_proof_path
          true,                    // verified (set to true for Google users)
          null                     // payment_plan
        ], (err, result) => {
          if (err) {
            console.error("Failed to create user:", err);
            return res.status(500).json({ error: "Failed to create user" });
          }
          
          userId = result.insertId;
          
          // Generate JWT token
          const token = jwt.sign({ userId }, process.env.JWT_SECRET, {
            expiresIn: "12h",
          });
          
          return res.json({ token, isNewUser: true });
        });
      } else {
        // User exists, log them in
        userId = results[0].id;
        
        // Generate JWT token
        const token = jwt.sign({ userId }, process.env.JWT_SECRET, {
          expiresIn: "12h",
        });
        
        res.json({ token, isNewUser: false });
      }
    });
  } catch (error) {
    console.error("Google login error:", error);
    res.status(500).json({ error: "Server error" });
  }
};



// module.exports = {
//   register: [upload.fields([
//     { name: 'offerLetter', maxCount: 1 },
//     { name: 'employeeIdProof', maxCount: 1 }
//   ]), register],
//   login,
//   verifyOTP,
//   getProfile,
  
// };
module.exports = {
  register: [upload.fields([
    { name: 'offerLetter', maxCount: 1 },
    { name: 'employeeIdProof', maxCount: 1 }
  ]), register],
  login,
  verifyOTP,
  getProfile,
  forgotPassword,
  verifyResetToken,
  resetPassword,
  googleLogin
};