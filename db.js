import pg from "pg";
import dotenv from "dotenv";

dotenv.config();

const { Pool } = pg;

if (!process.env.DATABASE_URL) {
  console.error("DATABASE_URL is not configured.");
  process.exit(1);
}

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false
  },
  max: 10,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 10000
});

pool.on("error", (error) => {
  console.error("Unexpected PostgreSQL pool error:", error);
});

// --------------------------------------------------
// Database query helper
// --------------------------------------------------

export async function query(text, params) {
  return pool.query(text, params);
}

// --------------------------------------------------
// Database connection test
// --------------------------------------------------

export async function checkDatabaseConnection() {
  const result = await pool.query("SELECT NOW() AS current_time");
  return result.rows[0];
}

// --------------------------------------------------
// Initialize database
// --------------------------------------------------

export async function initializeDatabase() {
  // Enable UUID generation
  await pool.query(`
    CREATE EXTENSION IF NOT EXISTS pgcrypto;
  `);

  // Create users table
  await pool.query(`
    CREATE TABLE IF NOT EXISTS users (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

      name VARCHAR(100) NOT NULL,

      email VARCHAR(255) UNIQUE NOT NULL,

      password_hash TEXT NOT NULL,

      created_at TIMESTAMP WITH TIME ZONE
        DEFAULT CURRENT_TIMESTAMP,

      updated_at TIMESTAMP WITH TIME ZONE
        DEFAULT CURRENT_TIMESTAMP
    );
  `);

  console.log("Users table is ready.");
}

export default pool;