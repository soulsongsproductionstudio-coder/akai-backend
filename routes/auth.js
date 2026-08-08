import express from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { query } from "../db.js";
import { authenticateToken } from "../middleware/authMiddleware.js";

const router = express.Router();

// --------------------------------------------------
// SIGN UP
// --------------------------------------------------

router.post("/signup", async (req, res) => {
  try {
    const { name, email, password } = req.body || {};
    // Validate name
    if (!name || typeof name !== "string" || name.trim().length < 2) {
      return res.status(400).json({
        success: false,
        error: "Please enter a valid name."
      });
    }

    // Validate email
    if (!email || typeof email !== "string") {
      return res.status(400).json({
        success: false,
        error: "Email is required."
      });
    }

    const normalizedEmail = email.trim().toLowerCase();

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    if (!emailRegex.test(normalizedEmail)) {
      return res.status(400).json({
        success: false,
        error: "Please enter a valid email address."
      });
    }

    // Validate password
    if (!password || typeof password !== "string" || password.length < 8) {
      return res.status(400).json({
        success: false,
        error: "Password must be at least 8 characters."
      });
    }

    // Check existing user
    const existingUser = await query(
      "SELECT id FROM users WHERE email = $1 LIMIT 1",
      [normalizedEmail]
    );

    if (existingUser.rows.length > 0) {
      return res.status(409).json({
        success: false,
        error: "An account with this email already exists."
      });
    }

    // Hash password
    const passwordHash = await bcrypt.hash(password, 12);

    // Create user
    const result = await query(
      `
      INSERT INTO users (name, email, password_hash)
      VALUES ($1, $2, $3)
      RETURNING id, name, email, created_at
      `,
      [name.trim(), normalizedEmail, passwordHash]
    );

    const user = result.rows[0];

    // JWT secret check
    if (!process.env.JWT_SECRET) {
      console.error("JWT_SECRET is not configured.");

      return res.status(500).json({
        success: false,
        error: "Authentication service is not configured."
      });
    }

    // Generate JWT
    const token = jwt.sign(
      {
        userId: user.id
      },
      process.env.JWT_SECRET,
      {
        expiresIn: "7d"
      }
    );

    return res.status(201).json({
      success: true,
      message: "Account created successfully.",
      user: {
        id: user.id,
        name: user.name,
        email: user.email
      },
      token
    });

  } catch (error) {
    console.error("Signup error:", error);

    return res.status(500).json({
      success: false,
      error: "Unable to create account."
    });
  }
});
// --------------------------------------------------
// LOGIN
// --------------------------------------------------

router.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body || {};

    if (!email || typeof email !== "string") {
      return res.status(400).json({
        success: false,
        error: "Email is required."
      });
    }

    if (!password || typeof password !== "string") {
      return res.status(400).json({
        success: false,
        error: "Password is required."
      });
    }

    const normalizedEmail = email.trim().toLowerCase();

    const result = await query(
      `
      SELECT id, name, email, password_hash
      FROM users
      WHERE email = $1
      LIMIT 1
      `,
      [normalizedEmail]
    );

    if (result.rows.length === 0) {
      return res.status(401).json({
        success: false,
        error: "Invalid email or password."
      });
    }

    const user = result.rows[0];

    const passwordMatch = await bcrypt.compare(
      password,
      user.password_hash
    );

    if (!passwordMatch) {
      return res.status(401).json({
        success: false,
        error: "Invalid email or password."
      });
    }

    if (!process.env.JWT_SECRET) {
      console.error("JWT_SECRET is not configured.");

      return res.status(500).json({
        success: false,
        error: "Authentication service is not configured."
      });
    }

    const token = jwt.sign(
      {
        userId: user.id
      },
      process.env.JWT_SECRET,
      {
        expiresIn: "7d"
      }
    );

    return res.json({
      success: true,
      message: "Login successful.",
      user: {
        id: user.id,
        name: user.name,
        email: user.email
      },
      token
    });

  } catch (error) {
    console.error("Login error:", error);

    return res.status(500).json({
      success: false,
      error: "Unable to login."
    });
  }
});
// --------------------------------------------------
// GET CURRENT USER
// --------------------------------------------------

router.get("/me", authenticateToken, async (req, res) => {
  try {
    const result = await query(
      `
      SELECT id, name, email, created_at
      FROM users
      WHERE id = $1
      LIMIT 1
      `,
      [req.user.userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: "User not found."
      });
    }

    const user = result.rows[0];

    return res.json({
      success: true,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        createdAt: user.created_at
      }
    });

  } catch (error) {
    console.error("Get current user error:", error);

    return res.status(500).json({
      success: false,
      error: "Unable to retrieve user."
    });
  }
});
export default router;
