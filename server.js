// ==========================================
// 1. INITIALIZATION & IMPORTS
// ==========================================
require("dotenv").config();

const express = require("express");
const path = require("path");
const cors = require("cors");
const fsSync = require("fs");
const jwt = require("jsonwebtoken");
const multer = require("multer");
const bcrypt = require("bcryptjs");

const {
  solveTextDoubt,
  solveImageDoubt,
  generateMathTest
} = require("./ai");

const { connectDB, readJson, writeJson } = require("./db");

const app = express();

app.use(cors());
app.use(express.json({ limit: "10mb" }));

const PORT = process.env.PORT || 3000;

const uploadDir = path.join(__dirname, "uploads");
const paymentUploadDir = path.join(uploadDir, "payments");

if (!fsSync.existsSync(uploadDir)) {
  fsSync.mkdirSync(uploadDir, { recursive: true });
}

if (!fsSync.existsSync(paymentUploadDir)) {
  fsSync.mkdirSync(paymentUploadDir, { recursive: true });
}

// ==========================================
// 2. HELPERS
// ==========================================

function normalizeEmail(email) {
  return String(email || "").trim().toLowerCase();
}

function normalizeMobile(mobile) {
  let digits = String(mobile || "").replace(/\D/g, "");

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

function isFakeEmail(email) {
  const fakeDomains = [
    "mailinator.com",
    "tempmail.com",
    "10minutemail.com",
    "guerrillamail.com",
    "yopmail.com",
    "fakegmail.com",
    "example.com",
    "test.com"
  ];

  const domain = String(email || "").split("@")[1]?.toLowerCase();
  if (!domain) return true;

  return fakeDomains.includes(domain);
}

function getPlanExpiry(planId) {
  const expiry = new Date();

  if (planId === "starter" || planId === "unlimited") {
    expiry.setMonth(expiry.getMonth() + 1);
  } else if (planId === "popular_3m") {
    expiry.setMonth(expiry.getMonth() + 3);
  } else if (planId === "half_year") {
    expiry.setMonth(expiry.getMonth() + 6);
  } else if (planId === "yearly") {
    expiry.setFullYear(expiry.getFullYear() + 1);
  } else {
    return null;
  }

  return expiry.toISOString();
}

function isPremiumValid(user) {
  if (!user || !user.premiumActive) return false;
  if (!user.planId || user.planId === "free") return false;

  if (user.planExpiry) {
    const expired = new Date(user.planExpiry).getTime() < Date.now();
    if (expired) return false;
  }

  return true;
}

function textLimit(user) {
  const extra = Number(user.extraText || 0);

  if (!isPremiumValid(user)) return 10 + extra;

  if (user.planId === "unlimited") return 999999 + extra;
  if (user.planId === "yearly") return 1500 + extra;
  if (user.planId === "half_year") return 700 + extra;
  if (user.planId === "popular_3m") return 300 + extra;
  if (user.planId === "starter") return 100 + extra;

  return 10 + extra;
}

function imageLimit(user) {
  const extra = Number(user.extraImage || 0);

  if (!isPremiumValid(user)) return 3 + extra;

  if (user.planId === "unlimited") return 999999 + extra;
  if (user.planId === "yearly") return 400 + extra;
  if (user.planId === "half_year") return 150 + extra;
  if (user.planId === "popular_3m") return 75 + extra;
  if (user.planId === "starter") return 20 + extra;

  return 3 + extra;
}

function testLimit(user) {
  const extra = Number(user.extraTests || 0);

  if (!isPremiumValid(user)) return 3 + extra;

  if (user.planId === "unlimited") return 999999 + extra;
  if (user.planId === "yearly") return 250 + extra;
  if (user.planId === "half_year") return 100 + extra;
  if (user.planId === "popular_3m") return 40 + extra;
  if (user.planId === "starter") return 15 + extra;

  return 3 + extra;
}

const publicUser = (u) => ({
  id: u.id,
  name: u.name,
  email: u.email,
  mobile: u.mobile || "",

  planId: isPremiumValid(u) ? u.planId || "free" : "free",
  planExpiry: u.planExpiry || null,
  paymentStatus: u.paymentStatus || "free",
  premiumActive: isPremiumValid(u),

  textUsed: u.textUsed || 0,
  imageUsed: u.imageUsed || 0,
  testUsed: u.testUsed || 0,

  textLeft: Math.max(0, textLimit(u) - (u.textUsed || 0)),
  imageLeft: Math.max(0, imageLimit(u) - (u.imageUsed || 0)),
  testLeft: Math.max(0, testLimit(u) - (u.testUsed || 0)),

  remainingText: Math.max(0, textLimit(u) - (u.textUsed || 0)),
  remainingImage: Math.max(0, imageLimit(u) - (u.imageUsed || 0)),
  remainingTest: Math.max(0, testLimit(u) - (u.testUsed || 0))
});

function safeAdminUser(user) {
  const copy = { ...user };
  delete copy.password;

  copy.premiumActive = isPremiumValid(user);
  copy.textLeft = Math.max(0, textLimit(user) - (user.textUsed || 0));
  copy.imageLeft = Math.max(0, imageLimit(user) - (user.imageUsed || 0));
  copy.testLeft = Math.max(0, testLimit(user) - (user.testUsed || 0));

  return copy;
}

// ==========================================
// 3. AUTH MIDDLEWARE
// ==========================================

const requireAuth = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({
        message: "No token provided"
      });
    }

    const token = authHeader.split(" ")[1];

    let decoded;

    try {
      decoded = jwt.verify(token, process.env.JWT_SECRET || "secret123");
    } catch (err) {
      return res.status(403).json({
        message: "Invalid token. Please login again."
      });
    }

    const users = await readJson("users");
    const user = users.find((u) => String(u.id) === String(decoded.id));

    if (!user) {
      return res.status(404).json({
        message: "User not found. Please logout and login again."
      });
    }

    if (user.status === "blocked") {
      return res.status(403).json({
        message: "Your account is blocked. Contact admin."
      });
    }

    req.user = user;
    next();
  } catch (err) {
    console.error("Auth error:", err);
    res.status(500).json({
      message: "Authentication failed"
    });
  }
};

function requireAdmin(req, res, next) {
  try {
    const authHeader = req.headers.authorization || "";

    if (!authHeader.startsWith("Bearer ")) {
      return res.status(401).json({
        message: "Admin login required"
      });
    }

    const token = authHeader.replace("Bearer ", "");
    const decoded = jwt.verify(token, process.env.JWT_SECRET || "secret123");

    if (decoded.role !== "admin") {
      return res.status(403).json({
        message: "Admin access only"
      });
    }

    req.admin = decoded;
    next();
  } catch (err) {
    return res.status(401).json({
      message: "Invalid or expired admin token"
    });
  }
}

// ==========================================
// 4. MULTER UPLOADS
// ==========================================

const upload = multer({
  dest: uploadDir,
  limits: {
    fileSize: 5 * 1024 * 1024
  }
});

const paymentUpload = multer({
  dest: paymentUploadDir,
  limits: {
    fileSize: 5 * 1024 * 1024
  },
  fileFilter: (req, file, cb) => {
    const allowed = ["image/jpeg", "image/png", "image/webp"];

    if (!allowed.includes(file.mimetype)) {
      return cb(new Error("Only JPG, PNG, WEBP screenshot allowed"));
    }

    cb(null, true);
  }
});

// ==========================================
// 5. AUTH ROUTES
// ==========================================

async function signupHandler(req, res) {
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

    if (name.length < 2) {
      return res.status(400).json({
        message: "Please enter valid name"
      });
    }

    if (!isValidEmail(email)) {
      return res.status(400).json({
        message: "Invalid email address"
      });
    }

    if (isFakeEmail(email)) {
      return res.status(400).json({
        message: "Fake or temporary email is not allowed"
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

    const emailExists = users.find((u) => normalizeEmail(u.email) === email);

    if (emailExists) {
      return res.status(400).json({
        message: "This email is already registered. Please login."
      });
    }

    const mobileExists = users.find((u) => normalizeMobile(u.mobile) === mobile);

    if (mobileExists) {
      return res.status(400).json({
        message: "This mobile number is already registered. Please login."
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
      planId: "free",
      planExpiry: null,
      paymentStatus: "free",

      extraText: 0,
      extraImage: 0,
      extraTests: 0,

      status: "active",

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
      message: "Signup Failed: " + err.message
    });
  }
}

app.post("/api/signup", signupHandler);
app.post("/api/auth/signup", signupHandler);
// ==========================================
// 6. LOGIN + PROFILE ROUTES
// ==========================================

async function loginHandler(req, res) {
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

    if (user.status === "blocked") {
      return res.status(403).json({
        message: "Your account is blocked. Contact admin."
      });
    }

    let passwordMatch = false;

    if (isHashedPassword(user.password)) {
      passwordMatch = await bcrypt.compare(password, user.password);
    } else {
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
      message: "Login Failed: " + err.message
    });
  }
}

app.post("/api/login", loginHandler);
app.post("/api/auth/login", loginHandler);

app.get("/api/profile", requireAuth, async (req, res) => {
  try {
    res.json({
      user: publicUser(req.user)
    });
  } catch (err) {
    res.status(500).json({
      message: "Profile Failed"
    });
  }
});

// ==========================================
// 7. AI DOUBT ROUTES
// ==========================================

async function textDoubtHandler(req, res) {
  try {
    const { question, language } = req.body;

    if (!question || String(question).trim().length < 2) {
      return res.status(400).json({
        message: "Question is required"
      });
    }

    const users = await readJson("users");
    const user = users.find((u) => String(u.id) === String(req.user.id));

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
      userName: user.name,
      userEmail: user.email,
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
}

app.post("/api/doubt/text", requireAuth, textDoubtHandler);
app.post("/api/doubt/solve", requireAuth, textDoubtHandler);

app.post("/api/doubt/image", requireAuth, upload.single("image"), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        message: "No image uploaded"
      });
    }

    const { question, language } = req.body;

    const users = await readJson("users");
    const user = users.find((u) => String(u.id) === String(req.user.id));

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
      userName: user.name,
      userEmail: user.email,
      type: "image",
      question: question || "Image doubt",
      imagePath: `/uploads/${path.basename(req.file.path)}`,
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

    const myDoubts = doubts.filter((d) => {
      return String(d.userId) === String(req.user.id);
    });

    res.json({
      doubts: myDoubts
    });
  } catch (err) {
    console.error("Doubt History Error:", err);
    res.status(500).json({
      message: "History Failed: " + err.message
    });
  }
});

// ==========================================
// 8. TEST GENERATOR ROUTES
// ==========================================

app.post("/api/test/generate", requireAuth, async (req, res) => {
  try {
    const {
      classLevel,
      subject,
      chapter,
      topic,
      difficulty,
      questionType,
      numQuestions,
      language
    } = req.body;

    const finalClass = String(classLevel || "").trim();
    const finalSubject = String(subject || "Maths").trim();
    const finalChapter = String(chapter || topic || "").trim();
    const finalDifficulty = String(difficulty || "Easy").trim();
    const finalQuestionType = String(questionType || "Mixed").trim();
    const finalLanguage = String(language || "Hinglish").trim();
    const finalNumQuestions = Number(numQuestions || 5);

    if (!finalClass || !finalChapter) {
      return res.status(400).json({
        message: "Class and chapter/topic are required"
      });
    }

    if (finalNumQuestions < 1 || finalNumQuestions > 50) {
      return res.status(400).json({
        message: "Number of questions must be between 1 and 50"
      });
    }

    const users = await readJson("users");
    const user = users.find((u) => String(u.id) === String(req.user.id));

    if (!user) {
      return res.status(404).json({
        message: "User not found"
      });
    }

    if ((user.testUsed || 0) >= testLimit(user)) {
      return res.status(403).json({
        message: "Test generator limit finished. Please upgrade to premium."
      });
    }

    const test = await generateMathTest({
      classLevel: finalClass,
      subject: finalSubject,
      chapter: finalChapter,
      topic: finalChapter,
      difficulty: finalDifficulty,
      questionType: finalQuestionType,
      numQuestions: finalNumQuestions,
      language: finalLanguage
    });

    user.testUsed = (user.testUsed || 0) + 1;

    const tests = await readJson("tests");

    const questionCount =
      test?.questions?.length ||
      test?.test?.questions?.length ||
      finalNumQuestions;

    const testRecord = {
      id: Date.now().toString(),
      userId: user.id,
      userName: user.name,
      userEmail: user.email,
      classLevel: finalClass,
      subject: finalSubject,
      chapter: finalChapter,
      topic: finalChapter,
      difficulty: finalDifficulty,
      questionType: finalQuestionType,
      numQuestions: finalNumQuestions,
      language: finalLanguage,
      test,
      score: 0,
      scorePercent: 0,
      attempted: 0,
      totalQuestions: questionCount,
      wrongCount: 0,
      status: "generated",
      createdAt: new Date().toISOString()
    };

    tests.unshift(testRecord);

    await writeJson("users", users);
    await writeJson("tests", tests);

    res.json({
      message: "Test generated successfully",
      test: testRecord,
      user: publicUser(user)
    });
  } catch (err) {
    console.error("Test Generate Error:", err);
    res.status(500).json({
      message: "Test Generate Failed: " + err.message
    });
  }
});
app.post("/api/test/submit/:testId", requireAuth, async (req, res) => {
  try {
    const { testId } = req.params;

    const {
      score = 0,
      scorePercent = 0,
      attempted = 0,
      totalQuestions = 0,
      wrongCount = 0,
      mcqCount = 0,
      mcqAttempted = 0,
      mcqWrong = 0,
      writtenCount = 0,
      writtenAttempted = 0,
      writtenCorrect = 0,
      answers = {},
      timeTaken = ""
    } = req.body || {};

    const tests = await readJson("tests");

    const index = tests.findIndex((t) => {
      return (
        String(t.id) === String(testId) &&
        String(t.userId) === String(req.user.id)
      );
    });

    if (index === -1) {
      return res.status(404).json({
        message: "Test not found"
      });
    }

    const questionCount =
      Number(totalQuestions) ||
      tests[index]?.test?.questions?.length ||
      tests[index]?.questions?.length ||
      0;

    tests[index] = {
      ...tests[index],

      score: Number(score) || 0,
      scorePercent: Number(scorePercent) || 0,
      attempted: Number(attempted) || 0,
      totalQuestions: questionCount,
      wrongCount: Number(wrongCount) || 0,

      mcqCount: Number(mcqCount) || 0,
      mcqAttempted: Number(mcqAttempted) || 0,
      mcqWrong: Number(mcqWrong) || 0,

      writtenCount: Number(writtenCount) || 0,
      writtenAttempted: Number(writtenAttempted) || 0,
      writtenCorrect: Number(writtenCorrect) || 0,

      answers: answers || {},
      timeTaken: String(timeTaken || ""),
      submittedAt: new Date().toISOString(),
      status: "submitted"
    };

    await writeJson("tests", tests);

    const submissions = await readJson("testSubmissions");

    const submission = {
      id: Date.now().toString(),
      testId,
      userId: req.user.id,
      userName: req.user.name,
      userEmail: req.user.email,
      score: Number(score) || 0,
      scorePercent: Number(scorePercent) || 0,
      attempted: Number(attempted) || 0,
      totalQuestions: questionCount,
      wrongCount: Number(wrongCount) || 0,
      answers: answers || {},
      timeTaken: String(timeTaken || ""),
      createdAt: new Date().toISOString()
    };

    submissions.unshift(submission);
    await writeJson("testSubmissions", submissions);

    res.json({
      message: "Test submitted successfully",
      test: tests[index],
      submission
    });
  } catch (err) {
    console.error("Test Submit Error:", err);
    res.status(500).json({
      message: "Test Submit Failed: " + err.message
    });
  }
});

app.get("/api/test/history", requireAuth, async (req, res) => {
  try {
    const tests = await readJson("tests");

    const myTests = tests
      .filter((t) => String(t.userId) === String(req.user.id))
      .sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));

    res.json({
      tests: myTests
    });
  } catch (err) {
    console.error("Test History Error:", err);
    res.status(500).json({
      message: "Test History Failed: " + err.message
    });
  }
});

// ==========================================
// 9. PAYMENT ROUTES
// ==========================================

app.post("/api/payment/request", requireAuth, paymentUpload.single("screenshot"), async (req, res) => {
  try {
    const { planId, amount, utr, note } = req.body;

    if (!planId || !amount) {
      return res.status(400).json({
        message: "Plan and amount are required"
      });
    }

    if (!req.file) {
      return res.status(400).json({
        message: "Payment screenshot is required"
      });
    }

    const cleanUtr = String(utr || "").trim();

    if (!cleanUtr || cleanUtr.length < 10) {
      return res.status(400).json({
        message: "Valid UTR number is required"
      });
    }

    const payments = await readJson("payments");

    const duplicateUtr = payments.find((p) => {
      return String(p.utr || "").trim().toLowerCase() === cleanUtr.toLowerCase();
    });

    if (duplicateUtr) {
      return res.status(400).json({
        message: "This UTR is already submitted"
      });
    }

    const payment = {
      id: Date.now().toString(),
      userId: req.user.id,
      userName: req.user.name,
      userEmail: req.user.email,
      userMobile: req.user.mobile || "",
      planId,
      amount: Number(amount) || 0,
      utr: cleanUtr,
      note: String(note || ""),
      screenshotPath: `/uploads/payments/${path.basename(req.file.path)}`,
      status: "pending",
      createdAt: new Date().toISOString()
    };

    payments.unshift(payment);
    await writeJson("payments", payments);

    const users = await readJson("users");
    const user = users.find((u) => String(u.id) === String(req.user.id));

    if (user) {
      user.paymentStatus = "pending";
      user.pendingPlanId = planId;
      await writeJson("users", users);
    }

    res.json({
      message: "Payment request submitted successfully. Admin approval pending.",
      payment,
      user: user ? publicUser(user) : publicUser(req.user)
    });
  } catch (err) {
    console.error("Payment Request Error:", err);
    res.status(500).json({
      message: "Payment request failed: " + err.message
    });
  }
});

// ==========================================
// 10. ADMIN ROUTES
// ==========================================

app.post("/api/admin/login", async (req, res) => {
  try {
    const { password } = req.body;

    const adminPassword = process.env.ADMIN_PASSWORD || "admin123";

    if (String(password || "") !== String(adminPassword)) {
      return res.status(401).json({
        message: "Invalid admin password"
      });
    }

    const token = signToken({
      id: "admin",
      role: "admin"
    });

    res.json({
      message: "Admin login successful",
      token
    });
  } catch (err) {
    res.status(500).json({
      message: "Admin login failed"
    });
  }
});

app.get("/api/admin/dashboard", requireAdmin, async (req, res) => {
  try {
    const users = await readJson("users");
    const doubts = await readJson("doubts");
    const tests = await readJson("tests");
    const payments = await readJson("payments");

    res.json({
      users: users.map(safeAdminUser),
      doubts,
      tests,
      payments,
      stats: {
        totalUsers: users.length,
        totalDoubts: doubts.length,
        totalTests: tests.length,
        pendingPayments: payments.filter((p) => p.status === "pending").length
      }
    });
  } catch (err) {
    console.error("Admin Dashboard Error:", err);
    res.status(500).json({
      message: "Admin dashboard failed: " + err.message
    });
  }
});

app.post("/api/admin/payment/:paymentId/approve", requireAdmin, async (req, res) => {
  try {
    const { paymentId } = req.params;

    const payments = await readJson("payments");
    const users = await readJson("users");

    const payment = payments.find((p) => String(p.id) === String(paymentId));

    if (!payment) {
      return res.status(404).json({
        message: "Payment not found"
      });
    }

    const user = users.find((u) => String(u.id) === String(payment.userId));

    if (!user) {
      return res.status(404).json({
        message: "User not found"
      });
    }

    payment.status = "approved";
    payment.approvedAt = new Date().toISOString();

    user.premiumActive = true;
    user.planId = payment.planId;
    user.planExpiry = getPlanExpiry(payment.planId);
    user.paymentStatus = "approved";
    user.pendingPlanId = "";

    await writeJson("payments", payments);
    await writeJson("users", users);

    res.json({
      message: "Payment approved successfully",
      payment,
      user: safeAdminUser(user)
    });
  } catch (err) {
    console.error("Approve Payment Error:", err);
    res.status(500).json({
      message: "Approve payment failed: " + err.message
    });
  }
});

app.post("/api/admin/payment/:paymentId/reject", requireAdmin, async (req, res) => {
  try {
    const { paymentId } = req.params;

    const payments = await readJson("payments");
    const users = await readJson("users");

    const payment = payments.find((p) => String(p.id) === String(paymentId));

    if (!payment) {
      return res.status(404).json({
        message: "Payment not found"
      });
    }

    payment.status = "rejected";
    payment.rejectedAt = new Date().toISOString();

    const user = users.find((u) => String(u.id) === String(payment.userId));

    if (user) {
      user.paymentStatus = "rejected";
      user.pendingPlanId = "";
    }

    await writeJson("payments", payments);
    await writeJson("users", users);

    res.json({
      message: "Payment rejected successfully",
      payment
    });
  } catch (err) {
    console.error("Reject Payment Error:", err);
    res.status(500).json({
      message: "Reject payment failed: " + err.message
    });
  }
});

// ==========================================
// 11. STATIC FILES + START SERVER
// ==========================================

app.use("/uploads", express.static(uploadDir));
app.use(express.static(path.join(__dirname, "public")));
app.use(express.static(__dirname));

app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "index.html"));
});

app.use((req, res) => {
  res.status(404).json({
    message: "Route not found"
  });
});

connectDB()
  .then(() => {
    app.listen(PORT, () => {
      console.log("MongoDB connected and server running on port " + PORT);
    });
  })
  .catch((err) => {
    console.error("MongoDB connection failed:", err.message);
    process.exit(1);
  });
        
