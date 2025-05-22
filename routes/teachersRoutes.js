const express = require("express");
const router = express.Router();
const db = require("../config/db"); // Import the MySQL connection

// Fetch all teachers
router.get("/", (req, res) => {
  const query = "SELECT id, name, email, department, user_id, phone, isBlocked FROM users WHERE role = 'teacher'";

  db.query(query, (err, results) => {
    if (err) {
      console.error("Error fetching teachers:", err);
      return res.status(500).json({ error: "Internal server error" });
    }

    res.json(results); // Send the results as JSON
  });
});

// Block/Unblock a teacher
router.put("/:id/block", (req, res) => {
  const { id } = req.params;
  const { isBlocked } = req.body;

  const query = "UPDATE users SET isBlocked = ? WHERE id = ? AND role = 'teacher'";
  const values = [isBlocked, id];

  db.query(query, values, (err, result) => {
    if (err) {
      console.error("Error updating teacher block status:", err);
      return res.status(500).json({ error: "Internal server error" });
    }

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: "Teacher not found" });
    }

    res.json({ message: "Teacher block status updated successfully" });
  });
});

module.exports = router;