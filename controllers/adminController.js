const path = require("path"); // Import the path module
const fs = require("fs"); // Import the fs module
const db = require("../config/db");

// Fetch pending verifications
const getPendingVerifications = async (req, res) => {
  try {
    const query = `
      SELECT id, name, email, phone, offer_letter_path, employee_id_proof_path 
      FROM users 
      WHERE role = 'student' AND student_type = 'non-regular' AND verified = FALSE
    `;
    db.query(query, (err, results) => {
      if (err) {
        return res.status(500).json({ error: err.message });
      }
      res.status(200).json(results);
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};
const downloadEmployeeProof = async (req, res) => {
  try {
    const { studentId } = req.params;
    
    // Fetch the student's employee ID proof path from the database
    const query = "SELECT employee_id_proof_path FROM users WHERE id = ?";
    
    db.query(query, [studentId], (err, results) => {
      if (err) {
        console.error("Database error:", err);
        return res.status(500).json({ error: "Database error" });
      }
      
      if (results.length === 0) {
        return res.status(404).json({ error: "Student not found" });
      }
      
      let employeeProofPath = results[0].employee_id_proof_path;
      
      if (!employeeProofPath) {
        return res.status(404).json({ error: "Employee ID proof path is missing" });
      }
      
      // Remove any leading slash to avoid path resolution issues
      employeeProofPath = employeeProofPath.replace(/^\/+/, '');
      
      // Try multiple possible locations for the file
      const possiblePaths = [
        // Option 1: Relative to project root
        path.join(__dirname, '..', '..', employeeProofPath),
        
        // Option 2: Directly in uploads folder at project root
        path.join(__dirname, '..', '..', 'uploads', path.basename(employeeProofPath)),
        
        // Option 3: In a public directory
        path.join(__dirname, '..', '..', 'public', employeeProofPath),
        
        // Option 4: Absolute path as stored
        employeeProofPath
      ];
      
      console.log("Database path:", employeeProofPath);
      console.log("Checking these possible file locations:");
      possiblePaths.forEach(p => console.log(" - " + p));
      
      // Check each possible path
      let fileFound = false;
      
      for (const filePath of possiblePaths) {
        if (fs.existsSync(filePath)) {
          console.log("File found at:", filePath);
          fileFound = true;
          
          // Set headers to force download
          res.setHeader("Content-Disposition", `attachment; filename=${path.basename(filePath)}`);
          
          // Determine content type based on file extension
          const ext = path.extname(filePath).toLowerCase();
          let contentType = "application/octet-stream"; // Default
          
          if (ext === '.pdf') {
            contentType = "application/pdf";
          } else if (['.jpg', '.jpeg', '.png'].includes(ext)) {
            contentType = `image/${ext.substring(1)}`;
          }
          
          res.setHeader("Content-Type", contentType);
          
          // Stream the file to the client
          const fileStream = fs.createReadStream(filePath);
          
          fileStream.on('error', (err) => {
            console.error("File stream error:", err);
            if (!res.headersSent) {
              return res.status(500).json({ error: "Error reading file" });
            }
          });
          
          fileStream.pipe(res);
          break;
        }
      }
      
      if (!fileFound) {
        console.error("File not found in any of the checked locations");
        return res.status(404).json({ error: "Employee ID proof not found" });
      }
    });
  } catch (error) {
    console.error("Unexpected error:", error);
    res.status(500).json({ error: error.message });
  }
};

// Verify a non-regular student
const verifyStudent = async (req, res) => {
  try {
    const { studentId } = req.params;
    const query = `
      UPDATE users 
      SET verified = TRUE 
      WHERE id = ? AND role = 'student' AND student_type = 'non-regular'
    `;
    db.query(query, [studentId], (err, result) => {
      if (err) {
        return res.status(500).json({ error: err.message });
      }
      if (result.affectedRows === 0) {
        return res.status(404).json({ error: "Student not found or already verified" });
      }
      res.status(200).json({ message: "Student verified successfully" });
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Fetch admin profile data with pending verification count
const getAdminProfile = async (req, res) => {
    try {
      const userId = req.user.userId; // Ensure this is correctly passed
  
      const query = `
        SELECT u.*, 
               COALESCE((SELECT COUNT(*) 
                FROM users 
                WHERE role = 'student' 
                AND student_type = 'non-regular' 
                AND verified = FALSE), 0) AS pendingVerifications
        FROM users u
        WHERE u.id = ?
      `;
  
      db.query(query, [userId], (err, results) => {
        if (err || results.length === 0) {
          return res.status(404).json({ error: "User not found" });
        }
        res.json(results[0]);
      });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  };
  

// Download offer letter
// const downloadOfferLetter = async (req, res) => {
//     try {
//       const { studentId } = req.params;
  
//       // Fetch the student's offer letter path from the database
//       const query = "SELECT offer_letter_path FROM users WHERE id = ?";
//       db.query(query, [studentId], (err, results) => {
//         if (err || results.length === 0) {
//           return res.status(404).json({ error: "Student not found" });
//         }
  
//         let offerLetterPath = results[0].offer_letter_path;
//         if (!offerLetterPath) {
//           return res.status(404).json({ error: "Offer letter path is missing" });
//         }
  
//         // Normalize path handling
//         let filePath;
//         if (path.isAbsolute(offerLetterPath)) {
//           filePath = offerLetterPath; // Use as-is if it's already absolute
//         } else {
//           filePath = path.join(__dirname, "..", offerLetterPath); // Convert to absolute if relative
//         }
  
//         console.log("Resolved File Path:", filePath); // Debugging
  
//         // Check if the file exists
//         if (!fs.existsSync(filePath)) {
//           console.error("File not found:", filePath);
//           return res.status(404).json({ error: "Offer letter not found" });
//         }
  
//         // Set headers to force download
//         res.setHeader("Content-Disposition", `attachment; filename=${path.basename(filePath)}`);
//         res.setHeader("Content-Type", "application/pdf");
  
//         // Stream the file to the client
//         const fileStream = fs.createReadStream(filePath);
//         fileStream.pipe(res);
//       });
//     } catch (error) {
//       res.status(500).json({ error: error.message });
//     }
//   };
  
const downloadOfferLetter = async (req, res) => {
  try {
    const { studentId } = req.params;
    
    // Fetch the student's offer letter path from the database
    const query = "SELECT offer_letter_path FROM users WHERE id = ?";
    
    db.query(query, [studentId], (err, results) => {
      if (err) {
        console.error("Database error:", err);
        return res.status(500).json({ error: "Database error" });
      }
      
      if (results.length === 0) {
        return res.status(404).json({ error: "Student not found" });
      }
      
      let offerLetterPath = results[0].offer_letter_path;
      
      if (!offerLetterPath) {
        return res.status(404).json({ error: "Offer letter path is missing" });
      }
      
      // Remove any leading slash to avoid path resolution issues
      offerLetterPath = offerLetterPath.replace(/^\/+/, '');
      
      // Try multiple possible locations for the file
      const possiblePaths = [
        // Option 1: Relative to project root
        path.join(__dirname, '..', '..', offerLetterPath),
        
        // Option 2: Directly in uploads folder at project root
        path.join(__dirname, '..', '..', 'uploads', path.basename(offerLetterPath)),
        
        // Option 3: In a public directory
        path.join(__dirname, '..', '..', 'public', offerLetterPath),
        
        // Option 4: Absolute path as stored
        offerLetterPath
      ];
      
      console.log("Database path:", offerLetterPath);
      console.log("Checking these possible file locations:");
      possiblePaths.forEach(p => console.log(" - " + p));
      
      // Check each possible path
      let fileFound = false;
      
      for (const filePath of possiblePaths) {
        if (fs.existsSync(filePath)) {
          console.log("File found at:", filePath);
          fileFound = true;
          
          // Set headers to force download
          res.setHeader("Content-Disposition", `attachment; filename=${path.basename(filePath)}`);
          
          // Determine content type based on file extension
          const ext = path.extname(filePath).toLowerCase();
          let contentType = "application/octet-stream"; // Default
          
          if (ext === '.pdf') {
            contentType = "application/pdf";
          } else if (['.jpg', '.jpeg', '.png'].includes(ext)) {
            contentType = `image/${ext.substring(1)}`;
          }
          
          res.setHeader("Content-Type", contentType);
          
          // Stream the file to the client
          const fileStream = fs.createReadStream(filePath);
          
          fileStream.on('error', (err) => {
            console.error("File stream error:", err);
            if (!res.headersSent) {
              return res.status(500).json({ error: "Error reading file" });
            }
          });
          
          fileStream.pipe(res);
          break;
        }
      }
      
      if (!fileFound) {
        console.error("File not found in any of the checked locations");
        return res.status(404).json({ error: "Offer letter not found" });
      }
    });
  } catch (error) {
    console.error("Unexpected error:", error);
    res.status(500).json({ error: error.message });
  }
};


module.exports = {
  getPendingVerifications,
  verifyStudent,
  getAdminProfile,
  downloadOfferLetter,
  downloadEmployeeProof,
};