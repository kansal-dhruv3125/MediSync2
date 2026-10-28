const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const User = require("../models/User");

const BCRYPT_ROUNDS = 10;
const TOKEN_EXPIRY = "7d";
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const USERNAME_PATTERN = /^[a-z0-9_]+$/;

function normalizeEmail(rawEmail) {
  return String(rawEmail || "").trim().toLowerCase();
}

function createToken(user) {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    const err = new Error("JWT_SECRET is not configured on the server.");
    err.status = 500;
    throw err;
  }
  return jwt.sign({ id: user._id.toString() }, secret, { expiresIn: TOKEN_EXPIRY });
}

// Consistent response shape for authenticated users
function publicUser(user) {
  return {
    id: user._id.toString(),
    username: user.username,
    email: user.email,
    createdAt: user.createdAt,
  };
}

async function signup(req, res, next) {
  try {
    const { username, email, password } = req.body || {};

    // --- Validation ---
    const errors = [];
    const normalizedUsername = String(username || "").trim().toLowerCase();
    const normalizedEmail = normalizeEmail(email);

    if (!normalizedUsername) {
      errors.push("Username is required.");
    } else {
      if (normalizedUsername.length < 3 || normalizedUsername.length > 30) {
        errors.push("Username must be 3-30 characters.");
      }
      if (!USERNAME_PATTERN.test(normalizedUsername)) {
        errors.push("Username may only contain letters, numbers and underscores.");
      }
    }

    if (!normalizedEmail) {
      errors.push("Email is required.");
    } else if (!EMAIL_PATTERN.test(normalizedEmail)) {
      errors.push("Please provide a valid email address.");
    }

    if (!password) {
      errors.push("Password is required.");
    } else if (String(password).length < 6) {
      errors.push("Password must be at least 6 characters.");
    }

    if (errors.length > 0) {
      return res.status(400).json({ success: false, message: "Validation failed.", errors });
    }

    // --- Duplicate checks (username and email treated independently) ---
    const duplicate = await User.findOne({
      $or: [{ username: normalizedUsername }, { email: normalizedEmail }],
    }).collation({ locale: "en", strength: 2 });

    if (duplicate) {
      const conflict =
        duplicate.username === normalizedUsername
          ? "This username is already taken."
          : "This email is already registered.";
      return res.status(409).json({ success: false, message: conflict });
    }

    // --- Create user (never store plaintext passwords) ---
    const passwordHash = await bcrypt.hash(String(password), BCRYPT_ROUNDS);
    const user = await User.create({
      username: normalizedUsername,
      email: normalizedEmail,
      passwordHash,
    });

    const token = createToken(user);

    return res.status(201).json({
      success: true,
      message: "Account created successfully.",
      data: { user: publicUser(user), token },
    });
  } catch (err) {
    return next(err);
  }
}

async function login(req, res, next) {
  try {
    const { identifier, username, email, password } = req.body || {};

    if (!identifier && !username && !email) {
      return res.status(400).json({
        success: false,
        message: "Validation failed.",
        errors: ["Username or email is required."],
      });
    }
    if (!password) {
      return res.status(400).json({
        success: false,
        message: "Validation failed.",
        errors: ["Password is required."],
      });
    }

    // Accept either the username or the email as the login identifier
    const identifierValue = String(identifier || username || email).trim().toLowerCase();

    const user = await User.findOne({
      $or: [{ username: identifierValue }, { email: identifierValue }],
    }).collation({ locale: "en", strength: 2 }).select("+passwordHash");

    // Same generic error for unknown users and wrong passwords
    if (!user) {
      return res.status(401).json({
        success: false,
        message: "Incorrect username/email or password.",
      });
    }

    const passwordMatches = await bcrypt.compare(String(password), user.passwordHash);
    if (!passwordMatches) {
      return res.status(401).json({
        success: false,
        message: "Incorrect username/email or password.",
      });
    }

    const token = createToken(user);

    return res.status(200).json({
      success: true,
      message: "Logged in successfully.",
      data: { user: publicUser(user), token },
    });
  } catch (err) {
    return next(err);
  }
}

/**
 * GET /api/auth/me — protected; requires a valid JWT.
 */
async function me(req, res, next) {
  try {
    const user = await User.findById(req.user.id);
    if (!user) {
      // Token is valid but the account no longer exists
      return res.status(401).json({
        success: false,
        message: "Account not found for this session. Please log in again.",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Authenticated user.",
      data: { user: publicUser(user) },
    });
  } catch (err) {
    return next(err);
  }
}

module.exports = { signup, login, me };
