const jwt = require("jsonwebtoken");

// =============================================
// 👑 TOKEN GENERATOR (Tumhara Chalne Wala Logic)
// =============================================
function signToken(payload) {
  // Payload mein hum id bhejenge (e.g., { id: user._id.toString() })
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
// ⚡ USER AUTH (FOR STUDENTS - NO CRASH)
// =============================================
function requireAuth(req, res, next) {
  try {
    const token = readToken(req);

    if (!token) {
      return res.status(401).json({ message: "Login required" });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET || "MathsGuruSuperSecretKey123");

    if (!decoded || !decoded.id) {
      return res.status(401).json({ message: "Invalid session" });
    }

    // Exact tumhara structure mapping fallback backends ke liye
    req.user = decoded; 
    next();

  } catch (err) {
    console.error("Auth Error:", err.message);
    return res.status(401).json({ message: "Session expired, login again" });
  }
}

// =========================
// ADMIN AUTH (Safe Fallback)
// =========================
function requireAdmin(req, res, next) {
  try {
    const token = readToken(req);
    if (!token) return res.status(401).json({ message: "Admin login required" });

    const decoded = jwt.verify(token, process.env.JWT_SECRET || "MathsGuruSuperSecretKey123");
    
    // Agar custom token payload me direct rule check pass karna ho
    if (decoded.role !== "admin" && decoded.email !== "mathguru498@gmail.com") {
      return res.status(403).json({ message: "Admin access only" });
    }

    req.admin = decoded;
    next();
  } catch (err) {
    return res.status(401).json({ message: "Invalid admin token" });
  }
}

module.exports = {
  signToken,
  requireAuth,
  requireAdmin
};
