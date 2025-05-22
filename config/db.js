// const mysql = require('mysql2');
// const dotenv = require('dotenv');

// dotenv.config();

// const db = mysql.createConnection({
//   host: process.env.DB_HOST,
//   user: process.env.DB_USER,
//   password: process.env.DB_PASSWORD,
//   database: process.env.DB_NAME
// });

// db.connect((err) => {
//   if (err) {
//     console.error('Database connection failed:', err);
//   } else {
//     console.log('Connected to database');
//   }
// });

// module.exports = db;
const mysql = require('mysql2');
const dotenv = require('dotenv');
const util = require('util');

dotenv.config();

// Create connection with retry logic
const createDbConnection = () => {
  console.log('Attempting to connect to database...');
  
  const db = mysql.createConnection({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    port: process.env.DB_PORT || 3306,
    connectTimeout: 60000 // Increase timeout to 60 seconds
  });

  // Promisify db.query
  db.query = util.promisify(db.query).bind(db);
  
  db.connect((err) => {
    if (err) {
      console.error('Database connection failed:', err);
      // Don't retry on authentication errors
      if (err.code === 'ER_ACCESS_DENIED_ERROR') {
        console.error('Database authentication failed. Check credentials.');
      } else {
        console.log('Will retry connection in 5 seconds...');
        setTimeout(createDbConnection, 5000);
      }
    } else {
      console.log('Connected to database successfully');
    }
  });

  // Handle disconnects
  db.on('error', (err) => {
    console.error('Database error:', err);
    if (err.code === 'PROTOCOL_CONNECTION_LOST') {
      console.log('Database connection lost. Reconnecting...');
      createDbConnection();
    } else {
      throw err;
    }
  });

  return db;
};

const db = createDbConnection();

module.exports = db;
