require("dotenv").config();

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
  admins: path.join(dataDir, "admins.json")
};

// =============================
// MULTER
// =============================
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => {
    cb(
      null,
      `${Date.now()}-${Math.round(Math.random() * 1e9)}${path.extname(file.originalname)}`
    );
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (!file.mimetype.startsWith("image/")) {
      return cb(new Error("Only images allowed"));
    }
    cb(null, true);
  }
});

// =============================
// MIDDLEWARE
// =============================
app.use(cors());
app.use(express.json({ limit: "1mb" }));
app.use(express.urlencoded({ extended: true }));
app.use("/uploads", express.static(uploadDir));

// =============================
// INIT STORAGE
// =============================
async function ensureStore() {
  await fs.mkdir(dataDir, { recursive: true });
  await fs.mkdir(uploadDir, { recursive: true });

  for (const file of Object.values(files)) {
    try {
      await fs.access(file);
    } catch {
      await fs.writeFile(file, "[]");
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
      createdAt: new Date().toISOString()
    });

    await writeJson("admins", admins);
  }
}

// =============================
// JSON HELPERS
// =============================
async function readJson(name) {
  return JSON.parse(await fs.readFile(files[name], "utf8") || "[]");
}

async function writeJson(name, value) {
  await fs.writeFile(files[name], JSON.stringify(value, null, 2));
}

function id() {
  return `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 10)}`;
}

// =============================
// USER HELPERS
// =============================
function publicUser(user) {
  if (!user) return null;

  const { passwordHash, ...safe } = user;

  const limits = user.premiumActive
    ? { text: 100, image: 100 }
    : { text: 10, image: 3 };

  return {
    ...safe,
    remainingText: Math.max(0, limits.text - user.textUsed),
    remainingImage: Math.max(0, limits.image - user.imageUsed)
  };
}

function getLimits(user) {
  return user.premiumActive
    ? { text: 100, image: 100 }
    : { text: 10, image: 3 };
}

// =============================
// VALIDATION
// =============================
function validateEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(
    String(email || "").trim().toLowerCase()
  );
}

// =============================
// USER FINDER
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
app.post("/api/signup", async (req, res, next) => {
  try {
    const { name, email, password } = req.body;

    if (!name || name.length < 2)
      return res.status(400).json({ message: "Name required" });

    if (!validateEmail(email))
      return res.status(400).json({ message: "Valid email required" });

    if (!password || password.length < 6)
      return res.status(400).json({ message: "Weak password" });

    const users = await readJson("users");

    if (users.some((u) => u.email === email.toLowerCase()))
      return res.status(409).json({ message: "Email exists" });

    const user = {
      id: id(),
      name,
      email: email.toLowerCase(),
      passwordHash: await bcrypt.hash(password, 12),
      textUsed: 0,
      imageUsed: 0,
      premiumActive: false,
      createdAt: new Date().toISOString()
    };

    users.push(user);
    await writeJson("users", users);

    res.json({
      token: signToken({ id: user.id, role: "student" }),
      user: publicUser(user)
    });
  } catch (err) {
    next(err);
  }
});

// ---------- LOGIN ----------
app.post("/api/login", async (req, res, next) => {
  try {
    const { email, password } = req.body;

    const users = await readJson("users");

    const user = users.find(
      (u) => u.email === String(email || "").toLowerCase()
    );

    if (
      !user ||
      !(await bcrypt.compare(password || "", user.passwordHash))
    ) {
      return res.status(401).json({ message: "Invalid credentials" });
    }

    res.json({
      token: signToken({ id: user.id, role: "student" }),
      user: publicUser(user)
    });
  } catch (err) {
    next(err);
  }
});

// ---------- PROFILE ----------
app.get("/api/profile", requireAuth, async (req, res, next) => {
  try {
    const { user } = await findCurrentUser(req);
    if (!user) return res.status(404).json({ message: "Not found" });

    res.json({ user: publicUser(user) });
  } catch (err) {
    next(err);
  }
});

// =============================
// TEXT DOUBT (SAFE)
// =============================
app.post("/api/doubt/text", requireAuth, async (req, res, next) => {
  try {
    const question = String(req.body.question || "").trim();

    if (question.length < 2)
      return res.status(400).json({ message: "Invalid question" });

    const { users, user } = await findCurrentUser(req);
    const limits = getLimits(user);

    if (user.textUsed >= limits.text)
      return res.status(402).json({ message: "Limit reached" });

    let solution;

    try {
      solution = await solveTextDoubt(question);
    } catch (e) {
      return res.status(500).json({ message: "AI failed" });
    }

    user.textUsed++;

    const doubts = await readJson("doubts");

    const doubt = {
      id: id(),
      userId: user.id,
      type: "text",
      question,
      solution
    };

    doubts.unshift(doubt);

    await writeJson("users", users);
    await writeJson("doubts", doubts);

    res.json({ doubt, user: publicUser(user) });
  } catch (err) {
    next(err);
  }
});

// =============================
// IMAGE DOUBT (SAFE)
// =============================
app.post(
  "/api/doubt/image",
  requireAuth,
  upload.single("image"),
  async (req, res, next) => {
    try {
      if (!req.file)
        return res.status(400).json({ message: "Image required" });

      const { users, user } = await findCurrentUser(req);
      const limits = getLimits(user);

      if (user.imageUsed >= limits.image)
        return res.status(402).json({ message: "Limit reached" });

      let solution;

      try {
        solution = await solveImageDoubt(
          path.join(uploadDir, req.file.filename),
          req.file.mimetype,
          req.body.question || ""
        );
      } catch {
        return res.status(500).json({ message: "AI failed" });
      }

      user.imageUsed++;

      const doubts = await readJson("doubts");

      const doubt = {
        id: id(),
        userId: user.id,
        type: "image",
        imagePath: `/uploads/${req.file.filename}`,
        solution
      };

      doubts.unshift(doubt);

      await writeJson("users", users);
      await writeJson("doubts", doubts);

      res.json({ doubt, user: publicUser(user) });
    } catch (err) {
      next(err);
    }
  }
);

// =============================
// ERROR HANDLER
// =============================
app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ message: err.message || "Server error" });
});

// =============================
// START
// =============================
ensureStore().then(() => {
  app.listen(PORT, "0.0.0.0", () => {
    console.log(`MATHS GURU running on ${PORT}`);
  });
});
