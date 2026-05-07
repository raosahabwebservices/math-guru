require("dotenv").config(); // Yeh line theek ki hai (small 'r')

const path = require("path");
const fs = require("fs").promises;
const express = require("express");
const cors = require("cors");
const multer = require("multer");
const bcrypt = require("bcryptjs");
const { signToken, requireAuth, requireAdmin } = require("./auth");
const { solveTextDoubt, solveImageDoubt } = require("./ai");

const app = express();
const PORT = process.env.PORT || 3000;

// --- FOLDER PATHS ---
const root = __dirname; 
const dataDir = path.join(root, "data");
const uploadDir = path.join(root, "uploads");

const files = {
  users: path.join(dataDir, "users.json"),
  doubts: path.join(dataDir, "doubts.json"),
  payments: path.join(dataDir, "payments.json"),
  contacts: path.join(dataDir, "contacts.json"),
  admins: path.join(dataDir, "admins.json")
};

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => cb(null, `${Date.now()}-${Math.round(Math.random() * 1e9)}${path.extname(file.originalname)}`)
});

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (!file.mimetype.startsWith("image/")) return cb(new Error("Only image uploads are allowed"));
    cb(null, true);
  }
});

// --- CORS POLICY ---
app.use((req, res, next) => {
  res.header("Access-Control-Allow-Origin", "*"); 
  res.header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
  res.header("Access-Control-Allow-Headers", "Content-Type, Authorization");
  if (req.method === "OPTIONS") {
    return res.sendStatus(200);
  }
  next();
});

app.use(express.json({ limit: "1mb" }));
app.use(express.urlencoded({ extended: true }));
app.use("/uploads", express.static(uploadDir));

async function ensureStore() {
  await fs.mkdir(dataDir, { recursive: true });
  await fs.mkdir(uploadDir, { recursive: true });
  for (const file of Object.values(files)) {
    try { await fs.access(file); } catch { await fs.writeFile(file, "[]\n"); }
  }
  const admins = await readJson("admins");
  if (!admins.length) {
    admins.push({
      id: id(),
      email: process.env.ADMIN_EMAIL || "admin@mathsguru.local",
      passwordHash: await bcrypt.hash(process.env.ADMIN_PASSWORD || "Admin@12345", 12),
      createdAt: new Date().toISOString()
    });
    await writeJson("admins", admins);
  }
}

async function readJson(name) {
  return JSON.parse(await fs.readFile(files[name], "utf8") || "[]");
}

async function writeJson(name, value) {
  await fs.writeFile(files[name], JSON.stringify(value, null, 2));
}

function id() {
  return `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 10)}`;
}

function publicUser(user) {
  if (!user || !user.id) return null;
  const { passwordHash, ...safe } = user;
  const limits = getLimits(user);
  return { ...safe, remainingText: Math.max(0, limits.text - user.textUsed), remainingImage: Math.max(0, limits.image - user.imageUsed) };
}

function getLimits(user) {
  return user.premiumActive ? { text: 100, image: 100 } : { text: 10, image: 3 };
}

function validateEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(email || "").trim().toLowerCase());
}

async function findCurrentUser(req) {
  const users = await readJson("users");
  return { users, user: users.find((u) => u.id === req.user.id) };
}

// --- ROUTES ---

app.get("/", (req, res) => {
  res.send("Maths Guru Backend is Live on Render!");
});

app.post("/api/signup", async (req, res, next) => {
  try {
    const name = String(req.body.name || "").trim();
    const email = String(req.body.email || "").trim().toLowerCase();
    const password = String(req.body.password || "");
    if (name.length < 2) return res.status(400).json({ message: "Name is required" });
    if (!validateEmail(email)) return res.status(400).json({ message: "Valid email required" });
    if (password.length < 6) return res.status(400).json({ message: "Password must be at least 6 characters" });
    const users = await readJson("users");
    if (users.some((u) => u.email === email)) return res.status(409).json({ message: "Email already registered" });
    const user = { id: id(), name, email, passwordHash: await bcrypt.hash(password, 12), planType: "free", textUsed: 0, imageUsed: 0, premiumActive: false, createdAt: new Date().toISOString() };
    users.push(user);
    await writeJson("users", users);
    res.json({ token: signToken({ id: user.id, role: "student" }), user: publicUser(user) });
  } catch (error) { next(error); }
});

app.post("/api/login", async (req, res, next) => {
  try {
    const email = String(req.body.email || "").trim().toLowerCase();
    const users = await readJson("users");
    const user = users.find((u) => u.email === email);
    if (!user || !(await bcrypt.compare(String(req.body.password || ""), user.passwordHash))) return res.status(401).json({ message: "Invalid email or password" });
    res.json({ token: signToken({ id: user.id, role: "student" }), user: publicUser(user) });
  } catch (error) { next(error); }
});

app.post("/api/logout", (req, res) => res.json({ message: "Logged out" }));

app.get("/api/profile", requireAuth, async (req, res, next) => {
  try {
    const { user } = await findCurrentUser(req);
    if (!user) return res.status(404).json({ message: "User not found" });
    res.json({ user: publicUser(user) });
  } catch (error) { next(error); }
});

app.post("/api/doubt/text", requireAuth, async (req, res, next) => {
  try {
    const question = String(req.body.question || "").trim();
    if (question.length < 3) return res.status(400).json({ message: "Please enter your maths question" });
    const { users, user } = await findCurrentUser(req);
    const limits = getLimits(user);
    if (user.textUsed >= limits.text) return res.status(402).json({ message: "Text doubt limit reached. Please upgrade." });
    const solution = await solveTextDoubt(question);
    user.textUsed += 1;
    const doubts = await readJson("doubts");
    const doubt = { id: id(), userId: user.id, type: "text", question, imagePath: "", solutionHindi: solution.solutionHindi, solutionEnglish: solution.solutionEnglish, formulaUsed: solution.formulaUsed, solution, createdAt: new Date().toISOString() };
    doubts.unshift(doubt);
    await writeJson("users", users);
    await writeJson("doubts", doubts);
    res.json({ doubt, user: publicUser(user) });
  } catch (error) { next(error); }
});

app.post("/api/doubt/image", requireAuth, upload.single("image"), async (req, res, next) => {
  try {
    if (!req.file) return res.status(400).json({ message: "Image is required" });
    const { users, user } = await findCurrentUser(req);
    const limits = getLimits(user);
    if (user.imageUsed >= limits.image) return res.status(402).json({ message: "Image doubt limit reached. Please upgrade." });
    const question = String(req.body.question || "").trim();
    const imagePath = `/uploads/${req.file.filename}`;
    const solution = await solveImageDoubt(path.join(uploadDir, req.file.filename), req.file.mimetype, question);
    user.imageUsed += 1;
    const doubts = await readJson("doubts");
    const doubt = { id: id(), userId: user.id, type: "image", question, imagePath, solutionHindi: solution.solutionHindi, solutionEnglish: solution.solutionEnglish, formulaUsed: solution.formulaUsed, solution, createdAt: new Date().toISOString() };
    doubts.unshift(doubt);
    await writeJson("users", users);
    await writeJson("doubts", doubts);
    res.json({ doubt, user: publicUser(user) });
  } catch (error) { next(error); }
});

app.get("/api/doubts/history", requireAuth, async (req, res, next) => {
  try {
    const doubts = await readJson("doubts");
    res.json({ doubts: doubts.filter((d) => d.userId === req.user.id) });
  } catch (error) { next(error); }
});

app.post("/api/payment", requireAuth, upload.single("screenshot"), async (req, res, next) => {
  try {
    const utr = String(req.body.utr || "").trim();
    if (utr.length < 6) return res.status(400).json({ message: "Enter a valid UTR number" });
    const payments = await readJson("payments");
    const payment = { id: id(), userId: req.user.id, amount: 99, utr, screenshot: req.file ? `/uploads/${req.file.filename}` : "", status: "pending", createdAt: new Date().toISOString() };
    payments.unshift(payment);
    await writeJson("payments", payments);
    res.json({ payment, message: "Payment request submitted. Admin approval pending." });
  } catch (error) { next(error); }
});

app.post("/api/contact", async (req, res, next) => {
  try {
    const name = String(req.body.name || "").trim();
    const email = String(req.body.email || "").trim().toLowerCase();
    const message = String(req.body.message || "").trim();
    if (name.length < 2 || !validateEmail(email) || message.length < 5) return res.status(400).json({ message: "Please fill all contact fields correctly" });
    const contacts = await readJson("contacts");
    contacts.unshift({ id: id(), name, email, message, createdAt: new Date().toISOString() });
    await writeJson("contacts", contacts);
    res.json({ message: "Message saved. We will contact you soon." });
  } catch (error) { next(error); }
});

app.post("/api/admin/login", async (req, res, next) => {
  try {
    const admins = await readJson("admins");
    const admin = admins.find((a) => a.email === String(req.body.email || "").trim().toLowerCase());
    if (!admin || !(await bcrypt.compare(String(req.body.password || ""), admin.passwordHash))) return res.status(401).json({ message: "Invalid admin credentials" });
    res.json({ token: signToken({ id: admin.id, role: "admin" }) });
  } catch (error) { next(error); }
});

app.get("/api/admin/dashboard", requireAdmin, async (req, res, next) => {
  try {
    const [users, payments, contacts, doubts] = await Promise.all([readJson("users"), readJson("payments"), readJson("contacts"), readJson("doubts")]);
    res.json({
      stats: { totalUsers: users.length, freeUsers: users.filter((u) => !u.premiumActive).length, premiumUsers: users.filter((u) => u.premiumActive).length, pendingPayments: payments.filter((p) => p.status === "pending").length, contactMessages: contacts.length },
      users: users.map(publicUser),
      recentDoubts: doubts.slice(0, 25)
    });
  } catch (error) { next(error); }
});

app.get("/api/admin/payments", requireAdmin, async (req, res, next) => {
  try {
    const [payments, users] = await Promise.all([readJson("payments"), readJson("users")]);
    res.json({ payments: payments.map((p) => ({ ...p, user: publicUser(users.find((u) => u.id === p.userId) || {}) })) });
  } catch (error) { next(error); }
});

app.put("/api/admin/payment/:id", requireAdmin, async (req, res, next) => {
  try {
    const action = String(req.body.action || "");
    if (!["approve", "reject", "activate"].includes(action)) return res.status(400).json({ message: "Invalid action" });
    const payments = await readJson("payments");
    const users = await readJson("users");
    const payment = payments.find((p) => p.id === req.params.id);
    if (!payment && action !== "activate") return res.status(404).json({ message: "Payment not found" });
    const targetUserId = payment?.userId || req.body.userId;
    const user = users.find((u) => u.id === targetUserId);
    if (!user) return res.status(404).json({ message: "User not found" });
    if (action === "approve" || action === "activate") {
      user.planType = "premium";
      user.premiumActive = true;
      user.textUsed = 0;
      user.imageUsed = 0;
      if (payment) payment.status = "approved";
    }
    if (action === "reject" && payment) payment.status = "rejected";
    await writeJson("users", users);
    await writeJson("payments", payments);
    res.json({ message: "Updated successfully", user: publicUser(user), payment });
  } catch (error) { next(error); }
});

app.use((error, req, res, next) => {
  console.error(error);
  res.status(error.status || 500).json({ message: error.message || "Server error" });
});

ensureStore().then(() => app.listen(PORT, "0.0.0.0", () => console.log(`MATHS GURU running on port ${PORT}`)));
      
