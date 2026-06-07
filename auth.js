const { createClient } = require('@supabase/supabase-js');

// Supabase Connection parameters setup
const SUPABASE_URL = "https://twukpvtqwuhbubtcnwdt.supabase.co";
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || "Sb_publishable_NXG8cBn1aQja3pdWJDGxXg_MnDyixL6";

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

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
// ⚡ USER AUTH (✅ FIXED: Direct Supabase Verification)
// =============================================
async function requireAuth(req, res, next) {
  try {
    const token = readToken(req);

    if (!token) {
      return res.status(401).json({ message: "Login required bhai!" });
    }

    // 👑 CRITICAL FIX: Local jwt.verify mita kar direct Supabase Cloud Validation pipeline hit karo
    const { data: { user }, error } = await supabase.auth.getUser(token);

    if (error || !user) {
      return res.status(401).json({ message: "Invalid or expired session. Login again." });
    }

    // Server object me data assign karo backward routing compatibility ke liye
    req.user = { id: user.id, email: user.email };
    next();

  } catch (err) {
    console.error("Auth Error:", err.message);
    return res.status(401).json({ message: "Session verification failed" });
  }
}

// =========================
// ADMIN AUTH (Safe Fallback)
// =========================
async function requireAdmin(req, res, next) {
  try {
    const token = readToken(req);
    if (!token) return res.status(401).json({ message: "Admin login required" });

    const { data: { user }, error } = await supabase.auth.getUser(token);
    if (error || !user) return res.status(401).json({ message: "Invalid admin token" });

    // Admin email validation guard logic
    if (user.email !== process.env.ADMIN_EMAIL && user.email !== "mathguru498@gmail.com") {
      return res.status(403).json({ message: "Admin access only" });
    }

    req.admin = { id: user.id, email: user.email, role: "admin" };
    next();
  } catch (err) {
    return res.status(401).json({ message: "Admin validation crash" });
  }
}

// Dummy backward placeholder compatibility filter ke liye
function signToken(payload) {
  return "supabase-managed-session";
}

module.exports = {
  signToken,
  requireAuth,
  requireAdmin
};
