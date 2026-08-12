import express from "express";
import cors from "cors";
import dotenv from "dotenv";

import {
  checkDatabaseConnection,
  initializeDatabase
} from "./db.js";

import authRoutes from "./routes/auth.js";
import { authenticateToken } from "./middleware/authMiddleware.js";
import { GoogleGenAI } from "@google/genai";

dotenv.config();

const app = express();

const PORT = process.env.PORT || 3000;

// ==================================================
// BASIC AI RATE LIMIT
// ==================================================

// This protects your Gemini quota from excessive requests
// from a single authenticated user.
//
// Note:
// This is an in-memory limiter. It resets if Render restarts
// the backend. Later we can move this to PostgreSQL/Redis.

const aiRequestLog = new Map();

const AI_REQUEST_LIMIT = 10;
const AI_REQUEST_WINDOW = 60 * 60 * 1000; // 1 hour

function checkAIRateLimit(userId) {
  const now = Date.now();

  const existing = aiRequestLog.get(userId);

  if (!existing) {
    aiRequestLog.set(userId, {
      count: 1,
      windowStart: now
    });

    return {
      allowed: true,
      remaining: AI_REQUEST_LIMIT - 1
    };
  }

  const windowExpired =
    now - existing.windowStart >= AI_REQUEST_WINDOW;

  if (windowExpired) {
    aiRequestLog.set(userId, {
      count: 1,
      windowStart: now
    });

    return {
      allowed: true,
      remaining: AI_REQUEST_LIMIT - 1
    };
  }

  if (existing.count >= AI_REQUEST_LIMIT) {
    const retryAfter =
      Math.ceil(
        (AI_REQUEST_WINDOW -
          (now - existing.windowStart)) /
          1000
      );

    return {
      allowed: false,
      remaining: 0,
      retryAfter
    };
  }

  existing.count += 1;

  return {
    allowed: true,
    remaining: AI_REQUEST_LIMIT - existing.count
  };
}

// ==================================================
// CORS
// ==================================================

app.use(
  cors({
    origin: true,
    methods: [
      "GET",
      "POST",
      "PUT",
      "PATCH",
      "DELETE",
      "OPTIONS"
    ],
    allowedHeaders: [
      "Content-Type",
      "Authorization"
    ]
  })
);

// ==================================================
// BODY PARSING
// ==================================================

app.use(
  express.json({
    limit: "10mb"
  })
);

app.use(
  express.urlencoded({
    extended: true
  })
);

// ==================================================
// AUTHENTICATION ROUTES
// ==================================================

app.use("/api/auth", authRoutes);

// ==================================================
// REQUEST LOGGING
// ==================================================

app.use((req, res, next) => {
  console.log(
    `${new Date().toISOString()} ${req.method} ${req.path}`
  );

  next();
});

// ==================================================
// ROOT
// ==================================================

app.get("/", (req, res) => {
  res.json({
    success: true,
    name: "AKAI Backend",
    message: "Welcome to AKAI backend",
    status: "running",
    version: "1.0.0"
  });
});

// ==================================================
// API INFORMATION
// ==================================================

app.get("/api", (req, res) => {
  res.json({
    success: true,
    name: "AKAI API",
    version: "1.0.0",
    status: "online"
  });
});

// ==================================================
// HEALTH CHECK
// ==================================================

app.get("/api/health", (req, res) => {
  res.json({
    success: true,
    status: "healthy",
    service: "akai-backend",
    timestamp: new Date().toISOString()
  });
});

// ==================================================
// AUTH STATUS
// ==================================================

app.get("/api/auth/status", (req, res) => {
  res.json({
    success: true,
    authenticated: false,
    message: "Authentication is handled through JWT."
  });
});

// ==================================================
// AI CHAT
// ==================================================

app.post(
  "/api/ai/chat",
  authenticateToken,
  async (req, res) => {
    try {
      // ------------------------------------------------
      // USER MESSAGE
      // ------------------------------------------------

      const { message } = req.body || {};

      if (
        !message ||
        typeof message !== "string"
      ) {
        return res.status(400).json({
          success: false,
          error: "Message is required."
        });
      }

      const trimmedMessage = message.trim();

      if (!trimmedMessage) {
        return res.status(400).json({
          success: false,
          error: "Message cannot be empty."
        });
      }

      // Prevent unnecessarily huge prompts
      if (trimmedMessage.length > 10000) {
        return res.status(413).json({
          success: false,
          error:
            "Message is too long. Please keep your message under 10,000 characters."
        });
      }

      // ------------------------------------------------
      // AUTHENTICATED USER
      // ------------------------------------------------

      const userId = req.user?.userId;

      if (!userId) {
        return res.status(401).json({
          success: false,
          error: "Invalid authentication session."
        });
      }

      // ------------------------------------------------
      // AI RATE LIMIT
      // ------------------------------------------------

      const rateLimit = checkAIRateLimit(
        String(userId)
      );

      if (!rateLimit.allowed) {
        return res.status(429).json({
          success: false,
          error:
            "You have reached AKAI's temporary AI request limit. Please try again later.",
          retryAfter: rateLimit.retryAfter
        });
      }

      // ------------------------------------------------
      // GEMINI API KEY
      // ------------------------------------------------

      if (!process.env.GEMINI_API_KEY) {
        console.error(
          "GEMINI_API_KEY is not configured."
        );

        return res.status(500).json({
          success: false,
          error:
            "AKAI AI is not configured correctly on the server."
        });
      }

      // ------------------------------------------------
      // CREATE GEMINI CLIENT
      // ------------------------------------------------

      const ai = new GoogleGenAI({
        apiKey: process.env.GEMINI_API_KEY
      });

      // ------------------------------------------------
      // ASK GEMINI
      // ------------------------------------------------

      const response =
        await ai.models.generateContent({
          model: "gemini-3.6-flash",

          config: {
            systemInstruction: `
You are AKAI, the intelligent AI assistant of the AKAI platform.

Your name is AKAI.

Do not introduce yourself as Gemini unless the
user specifically asks which underlying AI model
you use.

Personality:
- Helpful
- Friendly
- Professional
- Clear
- Respectful
- Encouraging

You can help users with:
- Learning and education
- Programming
- Software development
- Mathematics
- Physics
- Chemistry
- Science
- Writing
- Communication
- Problem solving
- General knowledge
- Technology
- AI

Always answer the user's question directly.

Use clear explanations.

For educational questions, explain step by step
when appropriate.

If you are unsure about something, be honest.
Do not invent information.

You are an AI assistant, not a human.
`
          },

          contents: trimmedMessage
        });

      // ------------------------------------------------
      // GET AI RESPONSE
      // ------------------------------------------------

      const reply =
        response?.text ||
        "I couldn't generate a response.";

      // ------------------------------------------------
      // SUCCESS
      // ------------------------------------------------

      return res.json({
        success: true,
        reply,
        usage: {
          remainingRequests:
            rateLimit.remaining
        }
      });

    } catch (error) {

      // ------------------------------------------------
      // LOG COMPLETE AI ERROR
      // ------------------------------------------------

      console.error(
        "Gemini API error:",
        error
      );

      // ------------------------------------------------
      // GEMINI QUOTA / RATE LIMIT
      // ------------------------------------------------

      if (
        error?.status === 429 ||
        error?.code === 429
      ) {
        return res.status(429).json({
          success: false,
          error:
            "AKAI AI has temporarily reached its Gemini API usage limit. Please try again later."
        });
      }

      // ------------------------------------------------
      // INVALID API KEY
      // ------------------------------------------------

      if (
        error?.status === 401 ||
        error?.code === 401
      ) {
        return res.status(500).json({
          success: false,
          error:
            "AKAI AI authentication failed. Please check the Gemini API configuration."
        });
      }

      // ------------------------------------------------
      // OTHER AI ERRORS
      // ------------------------------------------------

      return res.status(500).json({
        success: false,
        error:
          "AKAI AI could not generate a response right now. Please try again."
      });
    }
  }
);

// ==================================================
// DATABASE HEALTH
// ==================================================

app.get(
  "/api/database/health",
  async (req, res) => {
    try {
      const result =
        await checkDatabaseConnection();

      res.json({
        success: true,
        database: "connected",
        timestamp: result.current_time
      });

    } catch (error) {

      console.error(
        "Database health check failed:",
        error
      );

      res.status(500).json({
        success: false,
        database: "disconnected"
      });
    }
  }
);

// ==================================================
// 404 HANDLER
// ==================================================

app.use((req, res) => {
  res.status(404).json({
    success: false,
    error: "Endpoint not found."
  });
});

// ==================================================
// GLOBAL ERROR HANDLER
// ==================================================

app.use(
  (err, req, res, next) => {
    console.error(
      "SERVER ERROR:",
      err
    );

    res.status(500).json({
      success: false,
      error: "Internal server error."
    });
  }
);

// ==================================================
// START SERVER
// ==================================================

async function startServer() {
  try {

    await initializeDatabase();

    app.listen(
      PORT,
      "0.0.0.0",
      () => {

        console.log(
          "===================================="
        );

        console.log(
          "        AKAI BACKEND ONLINE"
        );

        console.log(
          "===================================="
        );

        console.log(
          `Port: ${PORT}`
        );

        console.log(
          `Environment: ${
            process.env.NODE_ENV ||
            "development"
          }`
        );

        console.log(
          "Database: Connected"
        );

        console.log(
          "Users table: Ready"
        );

        console.log(
          "AI endpoint: /api/ai/chat"
        );

        console.log(
          "===================================="
        );
      }
    );

  } catch (error) {

    console.error(
      "Failed to initialize database:",
      error
    );

    process.exit(1);
  }
}

startServer();