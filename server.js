// ==========================================
// 1. INITIALIZATION & IMPORTS
// ==========================================
require("dotenv").config();

const express = require("express");
const path = require("path");
const cors = require("cors");
const fs = require("fs").promises;
const fsSync = require("fs");
const jwt = require("jsonwebtoken");
const multer = require("multer");
const bcrypt = require("bcryptjs");

const {
  solveDoubt,
  generateTest
} = require("./ai");

const app = express();

app.use(cors());
app.use(express.json({ limit: "10mb" }));

const dataDir = path.join(__dirname, "data");
const uploadDir = path.join(__dirname, "uploads");

// Folder auto-create
if (!fsSync.existsSync(dataDir)) fsSync.mkdirSync(dataDir, { recursive: true });
if (!fsSync.existsSync(uploadDir)) fsSync.mkdirSync(uploadDir, { recursive: true });

// ==========================================
// 2. HELPERS
// ==========================================
async function readJson(file) {
  try {
    const filePath = path.join(dataDir, `${file}.json`);

    if (!fsSync.existsSync(filePath)) {
      await fs.writeFile(filePath, "[]");
      return [];
    }

    const data = await fs.readFile(filePath, "utf8");
    if (!data || data.trim() === "") return [];

    return JSON.parse(data);
  } catch (err) {
    console.error(`Error reading ${file}.json:`, err.message);
    return [];
  }
}

async function writeJson(file, data) {
  try {
    const filePath = path.join(dataDir, `${file}.json`);
    await fs.writeFile(filePath, JSON.stringify(data, null, 2));
  } catch (err) {
    console.error(`Error writing ${file}.json:`, err.message);
  }
}

function normalizeEmail(email) {
  return String(email || "").trim().toLowerCase();
}

function normalizeMobile(mobile) {
  let digits = String(mobile || "").replace(/\D/g, "");

  // +91 mobile support
  if (digits.length === 12 && digits.startsWith("91")) {
    digits = digits.slice(2);
  }

  return digits;
}

function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function isValidIndianMobile(mobile) {
  return /^[6-9]\d{9}$/.test(mobile);
}

function isPasswordHash(password) {
  return typeof password === "string" && password.startsWith("$2");
}

function getPlanLimit(user, type) {
  if (type === "text") return user.premiumActive ? 100 : 10;
  if (type === "image") return user.premiumActive ? 100 : 3;
  if (type === "test") return user.premiumActive ? 100 : 5;
  return 0;
}

function signToken(user) {
  if (!process.env.JWT_SECRET) {
    throw new Error("JWT_SECRET missing in .env");
  }

  return jwt.sign(
    {
      id: user.id
    },
    process.env.JWT_SECRET,
    {
      expiresIn: "7d"
    }
  );
}

function publicUser(u) {
  return {
    id: u.id,
    name: u.name,
    email: u.email,
    mobile: u.mobile,
    premiumActive: Boolean(u.premiumActive),
    remainingText: Math.max(0, getPlanLimit(u, "text") - (u.textUsed || 0)),
    remainingImage: Math.max(0, getPlanLimit(u, "image") - (u.imageUsed || 0)),
    remainingTest: Math.max(0, getPlanLimit(u, "test") - (u.testUsed || 0))
  };
}

const requireAuth = (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({
        message: "No token provided"
      });
    }

    const token = authHeader.split(" ")[1];

    jwt.verify(token, process.env.JWT_SECRET, (err, decoded) => {
      if (err) {
        return res.status(403).json({
          message: "Invalid or expired token"
        });
      }

      req.user = decoded;
      next();
    });
  } catch (err) {
    return res.status(500).json({
      message: "Auth error"
    });
  }
};

const upload = multer({
  dest: uploadDir,
  limits: {
    fileSize: 5 * 1024 * 1024 // 5MB
  },
  fileFilter: (req, file, cb) => {
    const allowed = ["image/jpeg", "image/png", "image/webp"];

    if (!allowed.includes(file.mimetype)) {
      return cb(new Error("Only JPG, PNG, WEBP images are allowed"));
    }

    cb(null, true);
  }
});

// ==========================================
// 3. AUTH ROUTES
// ==========================================

// New route
app.post("/api/auth/signup", async (req, res) => {
  try {
    let { name, email, mobile, password } = req.body;

    name = String(name || "").trim();
    email = normalizeEmail(email);
    mobile = normalizeMobile(mobile);

    if (!name || !email || !mobile || !password) {
      return res.status(400).json({
        message: "Name, email, mobile number and password are required"
      });
    }

    if (!isValidEmail(email)) {
      return res.status(400).json({
        message: "Invalid email address"
      });
    }

    if (!isValidIndianMobile(mobile)) {
      return res.status(400).json({
        message: "Invalid mobile number. Enter valid 10 digit Indian mobile number"
      });
    }

    if (String(password).length < 6) {
      return res.status(400).json({
        message: "Password must be at least 6 characters"
      });
    }

    const users = await readJson("users");

    const emailExists = users.find((u) => normalizeEmail(u.email) === email);
    if (emailExists) {
      return res.status(400).json({
        message: "Email already exists"
      });
    }

    const mobileExists = users.find((u) => normalizeMobile(u.mobile) === mobile);
    if (mobileExists) {
      return res.status(400).json({
        message: "Mobile number already exists"
      });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const newUser = {
      id: Date.now().toString(),
      name,
      email,
      mobile,
      password: hashedPassword,
      premiumActive: false,
      textUsed: 0,
      imageUsed: 0,
      testUsed: 0,
      createdAt: new Date().toISOString()
    };

    users.push(newUser);
    await writeJson("users", users);

    return res.status(201).json({
      message: "Signup successful",
      token: signToken(newUser),
      user: publicUser(newUser)
    });
  } catch (err) {
    console.error("Signup error:", err);
    return res.status(500).json({
      message: "Signup failed"
    });
  }
});

// Old route support — frontend break नहीं होगा
app.post("/api/signup", async (req, res) => {
  req.url = "/api/auth/signup";
  app._router.handle(req, res);
});

// New login route
app.post("/api/auth/login", async (req, res) => {
  try {
    const { identifier, email, mobile, password } = req.body;

    const loginId = normalizeEmail(identifier || email || mobile);
    const loginMobile = normalizeMobile(identifier || mobile || email);

    if ((!loginId && !loginMobile) || !password) {
      return res.status(400).json({
        message: "Email/mobile and password are required"
      });
    }

    const users = await readJson("users");

    const user = users.find((u) => {
      const userEmail = normalizeEmail(u.email);
      const userMobile = normalizeMobile(u.mobile);

      return userEmail === loginId || userMobile === loginMobile;
    });

    if (!user) {
      return res.status(401).json({
        message: "Invalid email/mobile or password"
      });
    }

    let passwordOk = false;

    // New hashed password check
    if (isPasswordHash(user.password)) {
      passwordOk = await bcrypt.compare(password, user.password);
    } else {
      // Old plain password migration support
      passwordOk = user.password === password;

      if (passwordOk) {
        user.password = await bcrypt.hash(password, 10);
        await writeJson("users", users);
      }
    }

    if (!passwordOk) {
      return res.status(401).json({
        message: "Invalid email/mobile or password"
      });
    }

    return res.json({
      message: "Login successful",
      token: signToken(user),
      user: publicUser(user)
    });
  } catch (err) {
    console.error("Login error:", err);
    return res.status(500).json({
      message: "Login failed"
    });
  }
});

// Old login route support
app.post("/api/login", async (req, res) => {
  req.url = "/api/auth/login";
  app._router.handle(req, res);
});

app.get("/api/profile", requireAuth, async (req, res) => {
  try {
    const users = await readJson("users");
    const user = users.find((u) => u.id === req.user.id);

    if (!user) {
      return res.status(404).json({
        message: "User not found"
      });
    }

    return res.json({
      user: publicUser(user)
    });
  } catch (err) {
    return res.status(500).json({
      message: "Profile fetch failed"
    });
  }
});

// ==========================================
// 4. DOUBT SOLVER ROUTES
// ==========================================

// New route: text doubt
app.post("/api/doubt/solve", requireAuth, async (req, res) => {
  try {
    const { question, language } = req.body;

    if (!question || String(question).trim().length < 2) {
      return res.status(400).json({
        message: "Question is required"
      });
    }

    const users = await readJson("users");
    const user = users.find((u) => u.id === req.user.id);

    if (!user) {
      return res.status(404).json({
        message: "User not found"
      });
    }

    const textLimit = getPlanLimit(user, "text");
    if ((user.textUsed || 0) >= textLimit) {
      return res.status(403).json({
        message: "Text doubt limit finished. Please upgrade to premium."
      });
    }

    const solution = await solveDoubt({
      question,
      language: language || "Hinglish"
    });

    user.textUsed = (user.textUsed || 0) + 1;

    const doubts = await readJson("doubts");

    const doubt = {
      id: Date.now().toString(),
      userId: user.id,
      type: "text",
      question,
      solution,
      createdAt: new Date().toISOString()
    };

    doubts.unshift(doubt);

    await writeJson("users", users);
    await writeJson("doubts", doubts);

    return res.json({
      message: "Doubt solved successfully",
      doubt,
      user: publicUser(user)
    });
  } catch (err) {
    console.error("Text doubt error:", err);
    return res.status(500).json({
      message: "AI Error: " + err.message
    });
  }
});

// Old text route support
app.post("/api/doubt/text", requireAuth, async (req, res) => {
  req.url = "/api/doubt/solve";
  app._router.handle(req, res);
});

// Image doubt route
app.post("/api/doubt/image", requireAuth, upload.single("image"), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        message: "No image uploaded"
      });
    }

    const { question, language } = req.body;

    const users = await readJson("users");
    const user = users.find((u) => u.id === req.user.id);

    if (!user) {
      return res.status(404).json({
        message: "User not found"
      });
    }

    const imageLimit = getPlanLimit(user, "image");
    if ((user.imageUsed || 0) >= imageLimit) {
      return res.status(403).json({
        message: "Image doubt limit finished. Please upgrade to premium."
      });
    }

    const solution = await solveDoubt({
      question: question || "Solve this maths question from image.",
      language: language || "Hinglish",
      imagePath: req.file.path,
      mimeType: req.file.mimetype
    });

    user.imageUsed = (user.imageUsed || 0) + 1;

    const doubts = await readJson("doubts");

    const doubt = {
      id: Date.now().toString(),
      userId: user.id,
      type: "image",
      question: question || "",
      imagePath: `/uploads/${req.file.filename}`,
      solution,
      createdAt: new Date().toISOString()
    };

    doubts.unshift(doubt);

    await writeJson("users", users);
    await writeJson("doubts", doubts);

    return res.json({
      message: "Image doubt solved successfully",
      doubt,
      user: publicUser(user)
    });
  } catch (err) {
    console.error("Image doubt error:", err);
    return res.status(500).json({
      message: "Image AI Error: " + err.message
    });
  }
});

app.get("/api/doubts/history", requireAuth, async (req, res) => {
  try {
    const doubts = await readJson("doubts");

    return res.json({
      doubts: doubts.filter((d) => d.userId === req.user.id)
    });
  } catch (err) {
    return res.status(500).json({
      message: "History fetch failed"
    });
  }
});

// ==========================================
// 5. TEST GENERATOR ROUTES
// ==========================================

app.post("/api/test/generate", requireAuth, async (req, res) => {
  try {
    const {
      classLevel,
      subject,
      chapter,
      topic,
      difficulty,
      numQuestions,
      questionType,
      language
    } = req.body;

    const finalClass = Number(classLevel);
    const finalSubject = String(subject || "Mathematics").trim();
    const finalTopic = String(topic || chapter || "").trim();
    const finalDifficulty = String(difficulty || "Medium").trim();
    const finalQuestionType = String(questionType || "Mixed").trim();
    const finalLanguage = String(language || "Hinglish").trim();
    const finalNumQuestions = Number(numQuestions);

    if (!finalClass || finalClass < 1 || finalClass > 12) {
      return res.status(400).json({
        message: "Class must be between 1 and 12"
      });
    }

    if (!finalTopic) {
      return res.status(400).json({
        message: "Chapter/topic is required"
      });
    }

    if (!["Easy", "Medium", "Hard"].includes(finalDifficulty)) {
      return res.status(400).json({
        message: "Difficulty must be Easy, Medium or Hard"
      });
    }

    if (!finalNumQuestions || finalNumQuestions < 1 || finalNumQuestions > 20) {
      return res.status(400).json({
        message: "Number of questions must be between 1 and 20"
      });
    }

    const users = await readJson("users");
    const user = users.find((u) => u.id === req.user.id);

    if (!user) {
      return res.status(404).json({
        message: "User not found"
      });
    }

    const testLimit = getPlanLimit(user, "test");
    if ((user.testUsed || 0) >= testLimit) {
      return res.status(403).json({
        message: "Test generation limit finished. Please upgrade to premium."
      });
    }

    const aiTest = await generateTest({
      classLevel: finalClass,
      subject: finalSubject,
      topic: finalTopic,
      difficulty: finalDifficulty,
      numQuestions: finalNumQuestions,
      questionType: finalQuestionType,
      language: finalLanguage
    });

    const tests = await readJson("tests");

    const testRecord = {
      id: Date.now().toString(),
      userId: user.id,
      ...aiTest,
      score: null,
      timeTaken: null,
      createdAt: new Date().toISOString()
    };

    tests.unshift(testRecord);

    user.testUsed = (user.testUsed || 0) + 1;

    await writeJson("tests", tests);
    await writeJson("users", users);

    return res.json({
      message: "Test generated successfully",
      testId: testRecord.id,

      // Frontend compatibility
      title: testRecord.title,
      classLevel: testRecord.classLevel,
      subject: testRecord.subject,
      topic: testRecord.topic,
      difficulty: testRecord.difficulty,
      marksPerQuestion: testRecord.marksPerQuestion,
      totalMarks: testRecord.totalMarks,
      questions: testRecord.questions,
      answerKey: testRecord.answerKey,

      user: publicUser(user)
    });
  } catch (err) {
    console.error("Test generate error:", err);
    return res.status(500).json({
      message: "Test generation failed: " + err.message
    });
  }
});

app.post("/api/test/submit/:testId", requireAuth, async (req, res) => {
  try {
    const { testId } = req.params;
    const { score, timeTaken } = req.body;

    const tests = await readJson("tests");

    const test = tests.find((t) => t.id === testId && t.userId === req.user.id);

    if (!test) {
      return res.status(404).json({
        message: "Test not found"
      });
    }

    test.score = score;
    test.timeTaken = timeTaken;
    test.submittedAt = new Date().toISOString();

    await writeJson("tests", tests);

    return res.json({
      message: "Test submitted successfully",
      test
    });
  } catch (err) {
    console.error("Test submit error:", err);
    return res.status(500).json({
      message: "Test submit failed"
    });
  }
});

app.get("/api/test/history", requireAuth, async (req, res) => {
  try {
    const tests = await readJson("tests");

    return res.json({
      tests: tests.filter((t) => t.userId === req.user.id)
    });
  } catch (err) {
    return res.status(500).json({
      message: "Test history fetch failed"
    });
  }
});

// ==========================================
// 6. STATIC FILES & FALLBACK
// ==========================================
app.use("/uploads", express.static(uploadDir));
app.use(express.static(__dirname));

app.get("*", (req, res) => {
  res.sendFile(path.join(__dirname, "index.html"));
});

// ==========================================
// 7. SERVER START
// ==========================================
const PORT = process.env.PORT || 3000;

app.listen(PORT, "0.0.0.0", () => {
  console.log(`Math Guru server is live on port ${PORT}`);
});
