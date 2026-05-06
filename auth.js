const jwt = require("jsonwebtoken");

function signToken(payload) {
  return jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: "7d" });
}

function readToken(req) {
  const header = req.headers.authorization || "";
  if (header.startsWith("Bearer ")) return header.slice(7);
  return req.cookies?.token || null;
}

function requireAuth(req, res, next) {
  try {
    const token = readToken(req);
    if (!token) return res.status(401).json({ message: "Login required" });
    req.user = jwt.verify(token, process.env.JWT_SECRET);
    if (req.user.role !== "student") return res.status(403).json({ message: "Student access only" });
    next();
  } catch (error) {
    return res.status(401).json({ message: "Invalid or expired token" });
  }
}

function requireAdmin(req, res, next) {
  try {
    const token = readToken(req);
    if (!token) return res.status(401).json({ message: "Admin login required" });
    req.admin = jwt.verify(token, process.env.JWT_SECRET);
    if (req.admin.role !== "admin") return res.status(403).json({ message: "Admin access only" });
    next();
  } catch (error) {
    return res.status(401).json({ message: "Invalid or expired admin token" });
  }
}

module.exports = { signToken, requireAuth, requireAdmin };