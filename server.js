import express from "express";
import cors from "cors";
import dotenv from "dotenv";

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

app.post("/api/chat", (req, res) => {
  const { message } = req.body;

  if (!message || typeof message !== "string") {
    return res.status(400).json({
      success: false,
      error: "Message is required."
    });
  }

  res.json({
    success: true,
    reply: "AKAI backend received your message. Real AI integration will be connected later.",
    received: message
  });
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

app.listen(PORT, "0.0.0.0", () => {
  console.log("====================================");
  console.log("        AKAI BACKEND ONLINE");
  console.log("====================================");
  console.log(`Port: ${PORT}`);
  console.log(`Environment: ${process.env.NODE_ENV || "development"}`);
  console.log("====================================");
});