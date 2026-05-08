require("dotenv").config();

const path = require("path");
const fs = require("fs"); // ✅ FIX: NOT fs.promises directly everywhere
const fsp = fs.promises;

const express = require("express");
const cors = require("cors");
const multer = require("multer");
const bcrypt = require("bcryptjs");

const { signToken, requireAuth } = require("./auth");
const { solveTextDoubt, solveImageDoubt } = require("./ai");

const app = express();
const PORT = process.env.PORT || 3000;

// =============================
// PATHS
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
// UTIL: ID
// =============================
function id() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
}

// =============================
// MULTER
// =============================
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => {
    cb(
      null,
      `${Date.now()}-${Math.random() * 1e9}${path.extname(file.originalname)}`
    );
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (!file.mimetype.startsWith("image/")) {
      return cb(new Error("Only images allowed"));
    }
    cb(null, true);
  },
});

// =============================
// MIDDLEWARE
// =============================
app.use(cors());
app.use(express.json({ limit: "1mb" }));
app.use(express.urlencoded({ extended: true }));
app.use("/uploads", express.static(uploadDir));

// =============================
// SAFE JSON HELPERS (FIXED)
// =============================
async function readJson(name) {
  try {
    const data = await fsp.readFile(files[name], "utf8");
    return JSON.parse(data || "[]");
  } catch {
    return [];
  }
}

async function writeJson(name, value) {
  await fsp.writeFile(files[name], JSON.stringify(value, null, 2));
}

// =============================
// INIT STORAGE (SAFE)
// =============================
async function ensureStore() {
  await fsp.mkdir(dataDir, { recursive: true });
  await fsp.mkdir(uploadDir, { recursive: true });

  for (const file of Object.values(files)) {
    try {
      await fsp.access(file);
    } catch {
      await fsp.writeFile(file, "[]");
    }
  }

  const admins = await readJson("admins");

  if (!admins.length) {
    admins.push({
      id: id(),
      email: process.env.ADMIN_EMAIL || "admin@mathsguru.local",
      passwordHash: await bcrypt.hash(
        process.env.ADMIN_PASSWORD || "Admin@12345",
        12
      ),
      createdAt: new Date().toISOString(),
    });

    await writeJson("admins", admins);
  }
}

// =============================
// USER HELPERS
// =============================
function publicUser(user) {
  if (!user) return null;

  const limits = user.premiumActive
    ? { text: 100, image: 100 }
    : { text: 10, image: 3 };

  return {
    ...user,
    passwordHash: undefined,
    remainingText: Math.max(0, limits.text - (user.textUsed || 0)),
    remainingImage: Math.max(0, limits.image - (user.imageUsed || 0)),
  };
}

function getLimits(user) {
  return user.premiumActive
    ? { text: 100, image: 100 }
    : { text: 10, image: 3 };
}

// =============================
// EMAIL VALIDATION
// =============================
function validateEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(
    String(email || "").toLowerCase()
  );
}

// =============================
// FIND USER
// =============================
async function findCurrentUser(req) {
  const users = await readJson("users");
  const user = users.find((u) => u.id === req.user.id);
  return { users, user };
}

// =============================
// ROUTES
// =============================
app.get("/", (req, res) => {
  res.send("Maths Guru Backend Live 🚀");
});

// ---------- SIGNUP ----------
app.post("/api/signup", async (req, res) => {
  try {
    const { name, email, password } = req.body;

    if (!name || name.length < 2)
      return res.status(400).json({ message: "Name required" });

    if (!validateEmail(email))
      return res.status(400).json({ message: "Valid email required" });

    if (!password || password.length < 6)
      return res.status(400).json({ message: "Weak password" });

    const users = await readJson("users");

    if (users.find((u) => u.email === email.toLowerCase()))
      return res.status(409).json({ message: "Email exists" });

    const user = {
      id: id(),
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

    res.json({
      token: signToken({ id: user.id }),
      user: publicUser(user),
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// ---------- LOGIN ----------
app.post("/api/login", async (req, res) => {
  try {
    const { email, password } = req.body;

    const users = await readJson("users");

    const user = users.find(
      (u) => u.email === String(email || "").toLowerCase()
    );

    if (!user || !(await bcrypt.compare(password || "", user.passwordHash))) {
      return res.status(401).json({ message: "Invalid credentials" });
    }

    res.json({
      token: signToken({ id: user.id }),
      user: publicUser(user),
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// ---------- TEXT DOUBT ----------
app.post("/api/doubt/text", requireAuth, async (req, res) => {
  try {
    const question = String(req.body.question || "").trim();

    const { users, user } = await findCurrentUser(req);
    if (!user) return res.status(404).json({ message: "User not found" });

    const limits = getLimits(user);

    if ((user.textUsed || 0) >= limits.text)
      return res.status(402).json({ message: "Limit reached" });

    const solution = await solveTextDoubt(question);

    user.textUsed++;

    const doubts = await readJson("doubts");

    const doubt = {
      id: id(),
      userId: user.id,
      question,
      solution,
      type: "text",
    };

    doubts.unshift(doubt);

    await writeJson("users", users);
    await writeJson("doubts", doubts);

    res.json({ doubt, user: publicUser(user) });
  } catch (err) {
    res.status(500).json({ message: "AI failed" });
  }
});

// ---------- IMAGE DOUBT ----------
app.post(
  "/api/doubt/image",
  requireAuth,
  upload.single("image"),
  async (req, res) => {
    try {
      if (!req.file)
        return res.status(400).json({ message: "Image required" });

      const { users, user } = await findCurrentUser(req);
      const limits = getLimits(user);

      if ((user.imageUsed || 0) >= limits.image)
        return res.status(402).json({ message: "Limit reached" });

      const solution = await solveImageDoubt(
        path.join(uploadDir, req.file.filename),
        req.file.mimetype,
        req.body.question || ""
      );

      user.imageUsed++;

      const doubts = await readJson("doubts");

      const doubt = {
        id: id(),
        userId: user.id,
        imagePath: `/uploads/${req.file.filename}`,
        solution,
        type: "image",
      };

      doubts.unshift(doubt);

      await writeJson("users", users);
      await writeJson("doubts", doubts);

      res.json({ doubt, user: publicUser(user) });
    } catch (err) {
      res.status(500).json({ message: "AI failed" });
    }
  }
);

// =============================
// START SERVER
// =============================
ensureStore().then(() => {
  app.listen(PORT, () => {
    console.log(`Maths Guru running on ${PORT}`);
  });
});
