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

export async function initializeDatabase() {
  // Enable UUID generation
  await pool.query(`
    CREATE EXTENSION IF NOT EXISTS pgcrypto;
  `);

  // --------------------------------------------------
  // USERS
  // --------------------------------------------------

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

  // --------------------------------------------------
  // CONVERSATIONS
  // --------------------------------------------------

  await pool.query(`
    CREATE TABLE IF NOT EXISTS conversations (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

      user_id UUID NOT NULL
        REFERENCES users(id)
        ON DELETE CASCADE,

      title VARCHAR(200)
        DEFAULT 'New conversation',

      created_at TIMESTAMP WITH TIME ZONE
        DEFAULT CURRENT_TIMESTAMP,

      updated_at TIMESTAMP WITH TIME ZONE
        DEFAULT CURRENT_TIMESTAMP
    );
  `);

  // --------------------------------------------------
  // MESSAGES
  // --------------------------------------------------

  await pool.query(`
    CREATE TABLE IF NOT EXISTS messages (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

      conversation_id UUID NOT NULL
        REFERENCES conversations(id)
        ON DELETE CASCADE,

      role VARCHAR(20) NOT NULL
        CHECK (role IN ('user', 'assistant')),

      content TEXT NOT NULL,

      created_at TIMESTAMP WITH TIME ZONE
        DEFAULT CURRENT_TIMESTAMP
    );
  `);

  // --------------------------------------------------
  // INDEXES
  // --------------------------------------------------

  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_conversations_user_id
    ON conversations(user_id);
  `);

  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_conversations_updated_at
    ON conversations(updated_at DESC);
  `);

  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_messages_conversation_id
    ON messages(conversation_id);
  `);

  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_messages_created_at
    ON messages(created_at);
  `);

  console.log("Users table is ready.");
  console.log("Conversations table is ready.");
  console.log("Messages table is ready.");
}

export async function checkDatabaseConnection() {
  const result = await pool.query("SELECT NOW() AS current_time");
  return result.rows[0];
}

// --------------------------------------------------
// Initialize database
// --------------------------------------------------

