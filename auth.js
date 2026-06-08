const jwt = require("jsonwebtoken");

// =========================
// SIGN TOKEN
// =========================
function signToken(payload) {
  if (!process.env.JWT_SECRET) {
    throw new Error("JWT_SECRET missing in .env");
  }

  return jwt.sign(payload, process.env.JWT_SECRET, {
    expiresIn: "7d"
  });
}

// =========================
// TOKEN READER
// =========================
function readToken(req) {
  const header = req.headers.authorization;

  if (header && header.startsWith("Bearer ")) {
    return header.split(" ")[1];
  }

  return null;
}

// =========================
// USER AUTH
// =========================
function requireAuth(req, res, next) {
  try {
    const token = readToken(req);

    if (!token) {
      return res.status(401).json({
        message: "Login required"
      });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    if (!decoded || !decoded.id) {
      return res.status(401).json({
        message: "Invalid session"
      });
    }

    req.user = decoded;
    next();
  } catch (err) {
    console.error("Auth Error:", err.message);

    return res.status(401).json({
      message: "Session expired, login again"
    });
  }
}

// =========================
// ADMIN AUTH
// =========================
function requireAdmin(req, res, next) {
  try {
    const token = readToken(req);

    if (!token) {
      return res.status(401).json({
        message: "Admin login required"
      });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    if (!decoded || decoded.role !== "admin") {
      return res.status(403).json({
        message: "Admin access only"
      });
    }

    req.admin = decoded;
    next();
  } catch (err) {
    return res.status(401).json({
      message: "Invalid admin token"
    });
  }
}

module.exports = {
  signToken,
  requireAuth,
  requireAdmin
};
