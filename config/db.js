const mysql = require('mysql2');
const dotenv = require('dotenv');

dotenv.config();

const db = mysql.createConnection({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME
});

db.connect((err) => {
  if (err) {
    console.error('Database connection failed:', err);
  } else {
    console.log('Connected to database');
  }
});

module.exports = db;
// const mysql = require("mysql2/promise"); // Use the promise-based API
// const dotenv = require("dotenv");

// dotenv.config();

// // Create a connection pool (recommended for better performance)
// const pool = mysql.createPool({
//   host: process.env.DB_HOST,
//   user: process.env.DB_USER,
//   password: process.env.DB_PASSWORD,
//   database: process.env.DB_NAME,
//   waitForConnections: true,
//   connectionLimit: 10, // Adjust based on your needs
//   queueLimit: 0,
// });

// // Test the connection
// pool
//   .getConnection()
//   .then((connection) => {
//     console.log("Connected to database");
//     connection.release(); // Release the connection back to the pool
//   })
//   .catch((err) => {
//     console.error("Database connection failed:", err);
//   });

// // Export the pool for use in other files
// module.exports = pool;