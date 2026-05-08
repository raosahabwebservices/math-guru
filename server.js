require("dotenv").config();
const path = require("path");
const fs = require("fs"); 
const fsp = fs.promises;
const express = require("express");
const cors = require("cors");
const multer = require("multer");
const bcrypt = require("bcryptjs");

// Token aur AI functions import
const { signToken, requireAuth } = require("./auth");
const { solveTextDoubt, solveImageDoubt } = require("./ai");

const app = express();
const PORT = process.env.PORT || 3000;

// =============================
// PATHS & STORAGE
// =============================
const root = __dirname;
const dataDir = path.join(root, "data");
const uploadDir = path.join(root, "uploads");

const files = {
  users: path.join(dataDir, "users.json"),
  doubts: path.join(dataDir, "doubts.json"),
  payments: path.join(dataDir, "payments.json"),
  contacts: path.join(dataDir, "contacts.json"),
  admins: path.join(dataDir, "admins.json"),
};

// =============================
// MULTER CONFIG
// =============================
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => {
    cb(null, `${Date.now()}-${Math.random() * 1e9}${path.extname(file.originalname)}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (!file.mimetype.startsWith("image/")) return cb(new Error("Only images allowed"));
    cb(null, true);
  },
});

// =============================
// MIDDLEWARE (FIXED FOR LOGIN LOOP)
// =============================
app.use(cors({
  origin: "*", 
  methods: ["GET", "POST", "PUT", "DELETE"],
  allowedHeaders: ["Content-Type", "Authorization"]
}));

app.use(express.json({ limit: "1mb" }));
app.use(express.urlencoded({ extended: true }));
app.use("/uploads", express.static(uploadDir));

// =============================
// JSON HELPERS
// =============================
async function readJson(name) {
  try {
    const data = await fsp.readFile(files[name], "utf8");
    return JSON.parse(data || "[]");
  } catch { return []; }
}

async function writeJson(name, value) {
  await fsp.writeFile(files[name], JSON.stringify(value, null, 2));
}

// =============================
// INIT STORAGE
// =============================
async function ensureStore() {
  await fsp.mkdir(dataDir, { recursive: true });
  await fsp.mkdir(uploadDir, { recursive: true });
  for (const file of Object.values(files)) {
    try { await fsp.access(file); } 
    catch { await fsp.writeFile(file, "[]"); }
  }
}

// =============================
// USER HELPERS
// =============================
function publicUser(user) {
  if (!user) return null;
  const limits = user.premiumActive ? { text: 100, image: 100 } : { text: 10, image: 3 };
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    premiumActive: user.premiumActive,
    remainingText: Math.max(0, limits.text - (user.textUsed || 0)),
    remainingImage: Math.max(0, limits.image - (user.imageUsed || 0)),
  };
}

// =============================
// ROUTES
// =============================
app.get("/", (req, res) => res.send("Maths Guru Backend Live 🚀"));

app.post("/api/signup", async (req, res) => {
  try {
    const { name, email, password } = req.body;
    if (!name || !email || !password) return res.status(400).json({ message: "All fields required" });

    const users = await readJson("users");
    if (users.find(u => u.email === email.toLowerCase())) return res.status(409).json({ message: "Email exists" });

    const user = {
      id: `${Date.now()}`,
      name,
      email: email.toLowerCase(),
      passwordHash: await bcrypt.hash(password, 12),
      textUsed: 0,
      imageUsed: 0,
      premiumActive: false,
      createdAt: new Date().toISOString(),
    };

    users.push(user);
    await writeJson("users", users);

    res.json({ token: signToken({ id: user.id }), user: publicUser(user) });
  } catch (err) { res.status(500).json({ message: err.message }); }
});

app.post("/api/login", async (req, res) => {
  try {
    const { email, password } = req.body;
    const users = await readJson("users");
    const user = users.find(u => u.email === String(email || "").toLowerCase());

    if (!user || !(await bcrypt.compare(password || "", user.passwordHash))) {
      return res.status(401).json({ message: "Invalid credentials" });
    }

    res.json({ token: signToken({ id: user.id }), user: publicUser(user) });
  } catch (err) { res.status(500).json({ message: err.message }); }
});

app.post("/api/doubt/text", requireAuth, async (req, res) => {
  try {
    const { question } = req.body;
    const users = await readJson("users");
    const user = users.find(u => u.id === req.user.id);
    if (!user) return res.status(404).json({ message: "User not found" });

    const solution = await solveTextDoubt(question);
    user.textUsed = (user.textUsed || 0) + 1;
    
    await writeJson("users", users);
    res.json({ solution, user: publicUser(user) });
  } catch (err) { res.status(500).json({ message: "AI failed" }); }
});

// =============================
// START
// =============================
ensureStore().then(() => {
  app.listen(PORT, () => console.log(`Maths Guru running on ${PORT}`));
});
