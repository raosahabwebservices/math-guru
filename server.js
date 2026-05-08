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
// UTIL: ID GENERATOR
// =============================
function generateId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
}

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
// MIDDLEWARE
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
      id: generateId(),
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

app.get("/api/profile", requireAuth, async (req, res) => {
  try {
    const users = await readJson("users");
    const user = users.find(u => u.id === req.user.id);
    if (!user) return res.status(404).json({ message: "Not found" });
    res.json({ user: publicUser(user) });
  } catch (err) { res.status(500).json({ message: err.message }); }
});

// ✅ FIXED TEXT DOUBT ROUTE
app.post("/api/doubt/text", requireAuth, async (req, res) => {
  try {
    const { question } = req.body;
    const users = await readJson("users");
    const user = users.find(u => u.id === req.user.id);
    if (!user) return res.status(404).json({ message: "User not found" });

    const limits = user.premiumActive ? 100 : 10;
    if ((user.textUsed || 0) >= limits) return res.status(402).json({ message: "Limit reached" });

    // AI solve karega (Returns Object now)
    const solution = await solveTextDoubt(question);
    user.textUsed = (user.textUsed || 0) + 1;

    // Doubts list mein save karna
    const doubts = await readJson("doubts");
    const doubt = {
        id: generateId(),
        userId: user.id,
        type: "text",
        question,
        solution, // Full object save hoga
        createdAt: new Date().toISOString()
    };
    doubts.unshift(doubt);
    
    await writeJson("users", users);
    await writeJson("doubts", doubts);

    res.json({ doubt, user: publicUser(user) });
  } catch (err) { 
    console.error(err);
    res.status(500).json({ message: "AI failed" }); 
  }
});

// ✅ FIXED IMAGE DOUBT ROUTE
app.post("/api/doubt/image", requireAuth, upload.single("image"), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ message: "Image required" });

    const users = await readJson("users");
    const user = users.find(u => u.id === req.user.id);
    if (!user) return res.status(404).json({ message: "User not found" });

    const limits = user.premiumActive ? 100 : 3;
    if ((user.imageUsed || 0) >= limits) return res.status(402).json({ message: "Limit reached" });

    // AI solve karega (Returns Object now)
    const solution = await solveImageDoubt(
      path.join(uploadDir, req.file.filename),
      req.file.mimetype,
      req.body.question || ""
    );

    user.imageUsed = (user.imageUsed || 0) + 1;

    const doubts = await readJson("doubts");
    const doubt = {
        id: generateId(),
        userId: user.id,
        type: "image",
        imagePath: `/uploads/${req.file.filename}`,
        solution, // Full object save hoga
        createdAt: new Date().toISOString()
    };
    doubts.unshift(doubt);

    await writeJson("users", users);
    await writeJson("doubts", doubts);

    res.json({ doubt, user: publicUser(user) });
  } catch (err) { 
    console.error(err);
    res.status(500).json({ message: "AI failed" }); 
  }
});

// =============================
// START
// =============================
ensureStore().then(() => {
  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Maths Guru running on ${PORT}`);
  });
});
      
