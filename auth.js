const jwt = require("jsonwebtoken");

function signToken(payload) {
  return jwt.sign(payload, process.env.JWT_SECRET, {
    expiresIn: "7d"
  });
}

// =========================
// TOKEN READER (SAFE)
// =========================
function readToken(req) {
  const header = req.headers.authorization;

  if (header && header.startsWith("Bearer ")) {
    return header.split(" ")[1];
  }

  return req.cookies?.token || null;
}

// =========================
// USER AUTH
// =========================
function requireAuth(req, res, next) {
  try {
    const token = readToken(req);

    if (!token) {
      return res.status(401).json({ message: "Login required" });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    if (!decoded || !decoded.id) {
      return res.status(401).json({ message: "Invalid token payload" });
    }

    req.user = decoded;

    // SAFE CHECK
    if (decoded.role && decoded.role !== "student") {
      return res.status(403).json({ message: "Student access only" });
    }

    next();

  } catch (err) {
    return res.status(401).json({ message: "Invalid or expired token" });
  }
}

// =========================
// ADMIN AUTH
// =========================
function requireAdmin(req, res, next) {
  try {
    const token = readToken(req);

    if (!token) {
      return res.status(401).json({ message: "Admin login required" });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    req.admin = decoded;

    if (decoded.role !== "admin") {
      return res.status(403).json({ message: "Admin access only" });
    }

    next();

  } catch (err) {
    return res.status(401).json({ message: "Invalid or expired admin token" });
  }
}

module.exports = {
  signToken,
  requireAuth,
  requireAdmin
};
