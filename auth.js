const jwt = require("jsonwebtoken");

// =============================================
// 👑 TOKEN GENERATOR (Pure MongoDB JWT Strategy)
// =============================================
function signToken(payload) {
  // Payload mein user._id aur email secure pass hoga
  return jwt.sign(payload, process.env.JWT_SECRET || "MathsGuruSuperSecretKey123", {
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
  return null;
}

// =============================================
// ⚡ USER AUTH (Direct Local MongoDB JWT Match)
// =============================================
function requireAuth(req, res, next) {
  try {
    const token = readToken(req);

    if (!token) {
      return res.status(401).json({ message: "Login required bhai!" });
    }

    // Local Verification Engine using Vercel Config Secret
    const decoded = jwt.verify(token, process.env.JWT_SECRET || "MathsGuruSuperSecretKey123");

    if (!decoded || !decoded.id) {
      return res.status(401).json({ message: "Invalid session array data." });
    }

    // Backend compatibility structure mapping 
    req.user = { id: decoded.id, email: decoded.email };
    next();

  } catch (err) {
    console.error("Auth Error:", err.message);
    return res.status(401).json({ message: "Session expired or invalid, login again." });
  }
}

// =============================================
// 👑 ADMIN AUTH (Email Validation Filter)
// =============================================
function requireAdmin(req, res, next) {
  try {
    const token = readToken(req);
    if (!token) return res.status(401).json({ message: "Admin login required" });

    const decoded = jwt.verify(token, process.env.JWT_SECRET || "MathsGuruSuperSecretKey123");
    
    // Hardcoded safety fallback for admin console validation
    if (decoded.email !== process.env.ADMIN_EMAIL && decoded.email !== "mathguru498@gmail.com") {
      return res.status(403).json({ message: "Admin access only" });
    }

    req.admin = { id: decoded.id, email: decoded.email, role: "admin" };
    next();
  } catch (err) {
    return res.status(401).json({ message: "Invalid or unauthorized admin token" });
  }
}

module.exports = {
  signToken,
  requireAuth,
  requireAdmin
};
