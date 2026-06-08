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

// ✅ Same ai.js se doubt + test generator dono
const {
  solveTextDoubt,
  solveImageDoubt,
  generateMathTest
} = require("./ai");

const app = express();

app.use(cors());
app.use(express.json({ limit: "10mb" }));

const dataDir = path.join(__dirname, "data");
const uploadDir = path.join(__dirname, "uploads");

// Render folders fix
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
    console.error(`Read JSON Error ${file}:`, err.message);
    return [];
  }
}

async function writeJson(file, data) {
  try {
    const filePath = path.join(dataDir, `${file}.json`);
    await fs.writeFile(filePath, JSON.stringify(data, null, 2));
  } catch (err) {
    console.error(`Error writing ${file}:`, err.message);
  }
}

function normalizeEmail(email) {
  return String(email || "").trim().toLowerCase();
}

function normalizeMobile(mobile) {
  let digits = String(mobile || "").replace(/\D/g, "");

  // +91 support
  if (digits.length === 12 && digits.startsWith("91")) {
    digits = digits.slice(2);
  }

  return digits;
}

function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function isValidMobile(mobile) {
  return /^[6-9]\d{9}$/.test(mobile);
}

function isHashedPassword(password) {
  return typeof password === "string" && password.startsWith("$2");
}

function signToken(payload) {
  return jwt.sign(payload, process.env.JWT_SECRET || "secret123", {
    expiresIn: "7d"
  });
}

function textLimit(user) {
  return user.premiumActive ? 100 : 10;
}

function imageLimit(user) {
  return user.premiumActive ? 100 : 3;
}

function testLimit(user) {
  return user.premiumActive ? 100 : 5;
}

const publicUser = (u) => ({
  id: u.id,
  name: u.name,
  email: u.email,
  mobile: u.mobile || "",
  premiumActive: Boolean(u.premiumActive),
  remainingText: Math.max(0, textLimit(u) - (u.textUsed || 0)),
  remainingImage: Math.max(0, imageLimit(u) - (u.imageUsed || 0)),
  remainingTest: Math.max(0, testLimit(u) - (u.testUsed || 0))
});

const requireAuth = (req, res, next) => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({
      message: "No token provided"
    });
  }

  const token = authHeader.split(" ")[1];

  jwt.verify(token, process.env.JWT_SECRET || "secret123", (err, user) => {
    if (err) {
      return res.status(403).json({
        message: "Invalid token"
      });
    }

    req.user = user;
    next();
  });
};

const upload = multer({
  dest: uploadDir,
  limits: {
    fileSize: 5 * 1024 * 1024
  }
});

// ==========================================
// 3. AUTH ROUTES
// ==========================================

// ✅ Signup: name + email + mobile + password
app.post("/api/signup", async (req, res) => {
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

    if (!isValidMobile(mobile)) {
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

    if (users.find((u) => normalizeEmail(u.email) === email)) {
      return res.status(400).json({
        message: "Email already exists"
      });
    }

    if (users.find((u) => normalizeMobile(u.mobile) === mobile)) {
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

    res.json({
      message: "Signup successful",
      token: signToken({ id: newUser.id }),
      user: publicUser(newUser)
    });
  } catch (err) {
    console.error("Signup Error:", err);
    res.status(500).json({
      message: "Signup Failed"
    });
  }
});

// Optional new route support
app.post("/api/auth/signup", async (req, res) => {
  req.url = "/api/signup";
  app._router.handle(req, res);
});

// ✅ Login: email/mobile + password
app.post("/api/login", async (req, res) => {
  try {
    const { email, mobile, identifier, password } = req.body;

    const loginValue = String(identifier || email || mobile || "").trim();
    const loginEmail = normalizeEmail(loginValue);
    const loginMobile = normalizeMobile(loginValue);

    if (!loginValue || !password) {
      return res.status(400).json({
        message: "Email/mobile and password are required"
      });
    }

    const users = await readJson("users");

    const user = users.find((u) => {
      return (
        normalizeEmail(u.email) === loginEmail ||
        normalizeMobile(u.mobile) === loginMobile
      );
    });

    if (!user) {
      return res.status(401).json({
        message: "Invalid Credentials"
      });
    }

    let passwordMatch = false;

    // ✅ New hashed password check
    if (isHashedPassword(user.password)) {
      passwordMatch = await bcrypt.compare(password, user.password);
    } else {
      // ✅ Old plain password support + auto migration
      passwordMatch = user.password === password;

      if (passwordMatch) {
        user.password = await bcrypt.hash(password, 10);
        await writeJson("users", users);
      }
    }

    if (!passwordMatch) {
      return res.status(401).json({
        message: "Invalid Credentials"
      });
    }

    res.json({
      message: "Login successful",
      token: signToken({ id: user.id }),
      user: publicUser(user)
    });
  } catch (err) {
    console.error("Login Error:", err);
    res.status(500).json({
      message: "Login Failed"
    });
  }
});

// Optional new route support
app.post("/api/auth/login", async (req, res) => {
  req.url = "/api/login";
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

    res.json({
      user: publicUser(user)
    });
  } catch (err) {
    res.status(500).json({
      message: "Profile Failed"
    });
  }
});

// ==========================================
// 4. AI DOUBT ROUTES
// ==========================================

// ✅ Text Doubt
app.post("/api/doubt/text", requireAuth, async (req, res) => {
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

    if ((user.textUsed || 0) >= textLimit(user)) {
      return res.status(403).json({
        message: "Text doubt limit finished. Please upgrade to premium."
      });
    }

    const solution = await solveTextDoubt(question, language || "Hinglish");

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

    res.json({
      message: "Doubt solved successfully",
      doubt,
      user: publicUser(user)
    });
  } catch (err) {
    console.error("Text Doubt Error:", err);
    res.status(500).json({
      message: "AI Error: " + err.message
    });
  }
});

// ✅ New route support
app.post("/api/doubt/solve", requireAuth, async (req, res) => {
  req.url = "/api/doubt/text";
  app._router.handle(req, res);
});

// ✅ Image Doubt
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

    if ((user.imageUsed || 0) >= imageLimit(user)) {
      return res.status(403).json({
        message: "Image doubt limit finished. Please upgrade to premium."
      });
    }

    const solution = await solveImageDoubt(
      req.file.path,
      req.file.mimetype,
      question || "Solve this maths question from image.",
      language || "Hinglish"
    );

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

    res.json({
      message: "Image doubt solved successfully",
      doubt,
      user: publicUser(user)
    });
  } catch (err) {
    console.error("Image Doubt Error:", err);
    res.status(500).json({
      message: "Image AI Error: " + err.message
    });
  }
});

app.get("/api/doubts/history", requireAuth, async (req, res) => {
  try {
    const doubts = await readJson("doubts");

    res.json({
      doubts: doubts.filter((d) => d.userId === req.user.id)
    });
  } catch (err) {
    res.status(500).json({
      message: "History Failed"
    });
  }
});

// ==========================================
// 5. AI TEST GENERATOR ROUTES
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
    const finalSubject = subject || "Mathematics";
    const finalTopic = String(topic || chapter || "").trim();
    const finalDifficulty = difficulty || "Medium";
    const finalNumQuestions = Number(numQuestions || 5);
    const finalQuestionType = questionType || "Mixed";
    const finalLanguage = language || "Hinglish";

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

    if ((user.testUsed || 0) >= testLimit(user)) {
      return res.status(403).json({
        message: "Test generation limit finished. Please upgrade to premium."
      });
    }

    const testData = await generateMathTest({
      classLevel: finalClass,
      subject: finalSubject,
      topic: finalTopic,
      difficulty: finalDifficulty,
      numQuestions: finalNumQuestions,
      questionType: finalQuestionType,
      language: finalLanguage
    });

    const tests = await readJson("tests");

    const test = {
      id: Date.now().toString(),
      userId: user.id,
      ...testData,
      score: null,
      timeTaken: null,
      createdAt: new Date().toISOString()
    };

    tests.unshift(test);

    user.testUsed = (user.testUsed || 0) + 1;

    await writeJson("tests", tests);
    await writeJson("users", users);

    res.json({
      message: "Test generated successfully",
      testId: test.id,
      title: test.title,
      classLevel: test.classLevel,
      subject: test.subject,
      topic: test.topic,
      difficulty: test.difficulty,
      marksPerQuestion: test.marksPerQuestion,
      totalMarks: test.totalMarks,
      questions: test.questions,
      answerKey: test.answerKey,
      user: publicUser(user)
    });
  } catch (err) {
    console.error("Test Generator Error:", err);
    res.status(500).json({
      message: "Test generation failed: " + err.message
    });
  }
});

app.post("/api/test/submit/:testId", requireAuth, async (req, res) => {
  try {
    const { testId } = req.params;

    const {
      score,
      attempted,
      totalQuestions,
      mcqCount,
      mcqAttempted,
      writtenCount,
      writtenAttempted,
      answers,
      timeTaken
    } = req.body;

    const tests = await readJson("tests");

    const test = tests.find((t) => t.id === testId && t.userId === req.user.id);

    if (!test) {
      return res.status(404).json({
        message: "Test not found"
      });
    }

    test.score = Number(score || 0);
    test.attempted = Number(attempted || 0);
    test.totalQuestions = Number(totalQuestions || test.questions?.length || 0);

    test.mcqCount = Number(mcqCount || 0);
    test.mcqAttempted = Number(mcqAttempted || 0);

    test.writtenCount = Number(writtenCount || 0);
    test.writtenAttempted = Number(writtenAttempted || 0);

    test.answers = answers || {};
    test.timeTaken = timeTaken || "00:00";
    test.submittedAt = new Date().toISOString();

    await writeJson("tests", tests);

    res.json({
      message: "Test submitted successfully",
      test
    });
  } catch (err) {
    console.error("Test submit error:", err);

    res.status(500).json({
      message: "Test submit failed"
    });
  }
});

app.get("/api/test/history", requireAuth, async (req, res) => {
  try {
    const tests = await readJson("tests");

    res.json({
      tests: tests.filter((t) => t.userId === req.user.id)
    });
  } catch (err) {
    res.status(500).json({
      message: "Test history failed"
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

const PORT = process.env.PORT || 3000;

app.listen(PORT, "0.0.0.0", () => {
  console.log(`Server is LIVE on port ${PORT}`);
});
