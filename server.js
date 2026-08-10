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

// --------------------------------------------------
// CORS
// --------------------------------------------------

app.use(
  cors({
    origin: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"]
  })
);

// --------------------------------------------------
// Middleware
// --------------------------------------------------

app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true }));
// --------------------------------------------------
// Authentication routes
// --------------------------------------------------

app.use("/api/auth", authRoutes);
// --------------------------------------------------
// Basic request logging
// --------------------------------------------------

app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} ${req.method} ${req.path}`);
  next();
});

// --------------------------------------------------
// Root
// --------------------------------------------------

app.get("/", (req, res) => {
  res.json({
    success: true,
    name: "AKAI Backend",
    message: "Welcome to AKAI backend",
    status: "running",
    version: "1.0.0"
  });
});

// --------------------------------------------------
// API information
// --------------------------------------------------

app.get("/api", (req, res) => {
  res.json({
    success: true,
    name: "AKAI API",
    version: "1.0.0",
    status: "online"
  });
});

// --------------------------------------------------
// Health check
// --------------------------------------------------

app.get("/api/health", (req, res) => {
  res.json({
    success: true,
    status: "healthy",
    service: "akai-backend",
    timestamp: new Date().toISOString()
  });
});

// --------------------------------------------------
// Authentication placeholder
// --------------------------------------------------

app.get("/api/auth/status", (req, res) => {
  res.json({
    success: true,
    authenticated: false,
    message: "Authentication system will be connected in Phase 4."
  });
});

// --------------------------------------------------
// Chat placeholder
// --------------------------------------------------

app.post("/api/chat", authenticateToken, async (req, res) => {
  try {
    const { message } = req.body || {};

    if (!message || typeof message !== "string") {
      return res.status(400).json({
        success: false,
        error: "Message is required."
      });
    }

    if (!process.env.GEMINI_API_KEY) {
      console.error("GEMINI_API_KEY is not configured.");

      return res.status(500).json({
        success: false,
        error: "AI service is not configured."
      });
    }

    const ai = new GoogleGenAI({
      apiKey: process.env.GEMINI_API_KEY
    });

    const response = await ai.models.generateContent({
      model: "gemini-3.6-flash",
      contents: message
    });

    return res.json({
      success: true,
      reply: response.text || "I couldn't generate a response."
    });

  } catch (error) {
    console.error("Gemini API error:", error);

    return res.status(500).json({
      success: false,
      error: "Unable to generate AI response."
    });
  }
});

// --------------------------------------------------
// Database health check
// --------------------------------------------------

app.get("/api/database/health", async (req, res) => {
  try {
    const result = await checkDatabaseConnection();

    res.json({
      success: true,
      database: "connected",
      timestamp: result.current_time
    });
  } catch (error) {
    console.error("Database health check failed:", error);

    res.status(500).json({
      success: false,
      database: "disconnected"
    });
  }
});

// --------------------------------------------------
// 404 handler
// --------------------------------------------------

app.use((req, res) => {
  res.status(404).json({
    success: false,
    error: "Endpoint not found."
  });
});

// --------------------------------------------------
// Error handler
// --------------------------------------------------

app.use((err, req, res, next) => {
  console.error("SERVER ERROR:", err);

  res.status(500).json({
    success: false,
    error: "Internal server error."
  });
});

// --------------------------------------------------
// Start server
// --------------------------------------------------

async function startServer() {
  try {
    await initializeDatabase();

    app.listen(PORT, "0.0.0.0", () => {
      console.log("====================================");
      console.log("        AKAI BACKEND ONLINE");
      console.log("====================================");
      console.log(`Port: ${PORT}`);
      console.log(`Environment: ${process.env.NODE_ENV || "development"}`);
      console.log("Database: Connected");
      console.log("Users table: Ready");
      console.log("====================================");
    });
  } catch (error) {
    console.error("Failed to initialize database:", error);
    process.exit(1);
  }
}

startServer();