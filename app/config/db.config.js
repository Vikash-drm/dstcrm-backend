const mysql = require('mysql2');

const dbConfig = {
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 3306,
  user: process.env.DB_USER ||  'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_DATABASE || 'dstcrm',
  multipleStatements: true,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
};

const db = mysql.createPool(dbConfig).promise();

db.query('SELECT 1')
.then(() => {
  console.log('Database connected on app');
})
.catch((err) => {
  console.error('Database connection failed', err);
});

module.exports = db;
