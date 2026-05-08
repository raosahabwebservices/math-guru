const jwt = require("jsonwebtoken"); // 'c' chhota kar diya

function signToken(payload) {
  // Payload mein hum sirf id bhej rahe hain, role ki zaroorat nahi agar default student hai
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
  // Agar cookies use nahi kar rahe toh sirf header kafi hai
  return null;
}

// =========================
// USER AUTH (FOR STUDENTS)
// =========================
function requireAuth(req, res, next) {
  try {
    const token = readToken(req);

    if (!token) {
      return res.status(401).json({ message: "Login required" });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    if (!decoded || !decoded.id) {
      return res.status(401).json({ message: "Invalid session" });
    }

    // Role check hata diya kyunki signup mein humne role set nahi kiya tha
    req.user = decoded;
    next();

  } catch (err) {
    console.error("Auth Error:", err.message);
    return res.status(401).json({ message: "Session expired, login again" });
  }
}

// =========================
// ADMIN AUTH
// =========================
function requireAdmin(req, res, next) {
  try {
    const token = readToken(req);
    if (!token) return res.status(401).json({ message: "Admin login required" });

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    if (decoded.role !== "admin") {
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
