const express = require("express");
const router = express.Router();
const db = require("../config/db"); // Import the MySQL connection

// Fetch all students
router.get("/", (req, res) => {
  const query = "SELECT id, name, email, department, user_id, phone, isBlocked FROM users WHERE role = 'student'";

  db.query(query, (err, results) => {
    if (err) {
      console.error("Error fetching students:", err);
      return res.status(500).json({ error: "Internal server error" });
    }

    res.json(results); // Send the results as JSON
  });
});

// Block/Unblock a student
router.put("/:id/block", (req, res) => {
  const { id } = req.params;
  const { isBlocked } = req.body;

  const query = "UPDATE users SET isBlocked = ? WHERE id = ? AND role = 'student'";
  const values = [isBlocked, id];

  db.query(query, values, (err, result) => {
    if (err) {
      console.error("Error updating student block status:", err);
      return res.status(500).json({ error: "Internal server error" });
    }

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: "Student not found" });
    }

    res.json({ message: "Student block status updated successfully" });
  });
});

module.exports = router;