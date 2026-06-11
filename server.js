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
const nodemailer = require("nodemailer");

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
const paymentUploadDir = path.join(uploadDir, "payments");

if (!fsSync.existsSync(dataDir)) fsSync.mkdirSync(dataDir, { recursive: true });
if (!fsSync.existsSync(uploadDir)) fsSync.mkdirSync(uploadDir, { recursive: true });
if (!fsSync.existsSync(paymentUploadDir)) fsSync.mkdirSync(paymentUploadDir, { recursive: true });

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
    console.error(`Write JSON Error ${file}:`, err.message);
  }
}

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

function generateOtp() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

function otpExpiryTime() {
  return new Date(Date.now() + 10 * 60 * 1000).toISOString();
}

function isOtpExpired(expiresAt) {
  return new Date(expiresAt).getTime() < Date.now();
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

async function sendEmailOtp(email, otp) {
  if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
    throw new Error("EMAIL_USER or EMAIL_PASS missing");
  }

  const transporter = nodemailer.createTransport({
    service: "gmail",
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS
    }
  });

  await transporter.sendMail({
    from: `"MATHS GURU" <${process.env.EMAIL_USER}>`,
    to: email,
    subject: "Your MATHS GURU Signup OTP",
    html: `
      <div style="font-family:Arial,sans-serif;background:#f4f6f9;padding:20px;">
        <div style="max-width:520px;margin:auto;background:white;border-radius:14px;padding:24px;border:1px solid #e5e7eb;">
          <h2 style="color:#0056b3;margin-top:0;">MATHS GURU Email Verification</h2>
          <p>Your signup OTP is:</p>
          <div style="font-size:34px;font-weight:900;letter-spacing:6px;color:#07152f;background:#eef6ff;padding:16px;border-radius:12px;text-align:center;">
            ${otp}
          </div>
          <p style="color:#555;">This OTP is valid for 10 minutes.</p>
          <p style="color:#777;font-size:13px;">If you did not request this, ignore this email.</p>
        </div>
      </div>
    `
  });
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
};

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

// Send Email OTP for Signup
app.post("/api/auth/send-signup-otp", async (req, res) => {
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

    if (users.find((u) => normalizeEmail(u.email) === email)) {
      return res.status(400).json({
        message: "This email is already registered. Please login."
      });
    }

    if (users.find((u) => normalizeMobile(u.mobile) === mobile)) {
      return res.status(400).json({
        message: "This mobile number is already registered. Please login."
      });
    }

    let otps = await readJson("otps");

    otps = otps.filter((item) => {
      return !(normalizeEmail(item.email) === email || normalizeMobile(item.mobile) === mobile);
    });

    const otp = generateOtp();

    otps.unshift({
      id: Date.now().toString(),
      name,
      email,
      mobile,
      otp,
      purpose: "signup",
      expiresAt: otpExpiryTime(),
      createdAt: new Date().toISOString()
    });

    await writeJson("otps", otps);
    await sendEmailOtp(email, otp);

    res.json({
      message: "OTP sent successfully to your email"
    });

  } catch (err) {
    console.error("Send OTP Error:", err);
    res.status(500).json({
      message: "OTP send failed. Check EMAIL_USER and EMAIL_PASS."
    });
  }
});

// Signup with Email OTP
app.post("/api/signup", async (req, res) => {
  try {
    let { name, email, mobile, password, otp } = req.body;

    name = String(name || "").trim();
    email = normalizeEmail(email);
    mobile = normalizeMobile(mobile);
    otp = String(otp || "").trim();

    if (!name || !email || !mobile || !password || !otp) {
      return res.status(400).json({
        message: "Name, email, mobile number, password and OTP are required"
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

    if (users.find((u) => normalizeEmail(u.email) === email)) {
      return res.status(400).json({
        message: "This email is already registered. Please login."
      });
    }

    if (users.find((u) => normalizeMobile(u.mobile) === mobile)) {
      return res.status(400).json({
        message: "This mobile number is already registered. Please login."
      });
    }

    const otps = await readJson("otps");

    const otpRecord = otps.find((item) => {
      return (
        normalizeEmail(item.email) === email &&
        normalizeMobile(item.mobile) === mobile &&
        String(item.otp) === otp &&
        item.purpose === "signup"
      );
    });

    if (!otpRecord) {
      return res.status(400).json({
        message: "Invalid OTP"
      });
    }

    if (isOtpExpired(otpRecord.expiresAt)) {
      return res.status(400).json({
        message: "OTP expired. Please request new OTP."
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

    const remainingOtps = otps.filter((item) => {
      return !(normalizeEmail(item.email) === email || normalizeMobile(item.mobile) === mobile);
    });

    await writeJson("users", users);
    await writeJson("otps", remainingOtps);

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

app.post("/api/auth/signup", async (req, res) => {
  req.url = "/api/signup";
  app._router.handle(req, res);
});

// Login
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
      message: "Login Failed"
    });
  }
});

app.post("/api/auth/login", async (req, res) => {
  req.url = "/api/login";
  app._router.handle(req, res);
});

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
// 6. AI DOUBT ROUTES
// ==========================================

app.post("/api/doubt/text", requireAuth, async (req, res) => {
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
});

app.post("/api/doubt/solve", requireAuth, async (req, res) => {
  req.url = "/api/doubt/text";
  app._router.handle(req, res);
});
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
      doubts: doubts.filter((d) => String(d.userId) === String(req.user.id))
    });

  } catch (err) {
    res.status(500).json({
      message: "History Failed"
    });
  }
});

// ==========================================
// 7. AI TEST GENERATOR ROUTES
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
    const user = users.find((u) => String(u.id) === String(req.user.id));

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
      userName: user.name,
      userEmail: user.email,
      ...testData,
      score: null,
      scorePercent: null,
      wrongCount: null,
      attempted: null,
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
      scorePercent,
      attempted,
      totalQuestions,
      wrongCount,
      mcqCount,
      mcqAttempted,
      mcqWrong,
      writtenCount,
      writtenAttempted,
      writtenCorrect,
      answers,
      timeTaken
    } = req.body;

    const tests = await readJson("tests");

    const test = tests.find((t) => {
      return String(t.id) === String(testId) && String(t.userId) === String(req.user.id);
    });

    if (!test) {
      return res.status(404).json({
        message: "Test not found"
      });
    }

    test.score = Number(score || 0);
    test.scorePercent = Number(scorePercent || 0);
    test.attempted = Number(attempted || 0);
    test.totalQuestions = Number(totalQuestions || test.questions?.length || 0);
    test.wrongCount = Number(wrongCount || 0);

    test.mcqCount = Number(mcqCount || 0);
    test.mcqAttempted = Number(mcqAttempted || 0);
    test.mcqWrong = Number(mcqWrong || 0);

    test.writtenCount = Number(writtenCount || 0);
    test.writtenAttempted = Number(writtenAttempted || 0);
    test.writtenCorrect = Number(writtenCorrect || 0);

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
      tests: tests.filter((t) => String(t.userId) === String(req.user.id))
    });

  } catch (err) {
    res.status(500).json({
      message: "Test history failed"
    });
  }
});

// ==========================================
// 8. PAYMENT + CONTACT ROUTES
// ==========================================

app.post("/api/payment/request", requireAuth, paymentUpload.single("screenshot"), async (req, res) => {
  try {
    const { planId, amount, utr } = req.body;

    if (!planId || !amount || !utr) {
      return res.status(400).json({
        message: "Plan, amount and UTR are required"
      });
    }

    if (!req.file) {
      return res.status(400).json({
        message: "Payment screenshot is required"
      });
    }

    const cleanUtr = String(utr || "").trim();

    if (
      cleanUtr.length < 10 ||
      cleanUtr.length > 30 ||
      !/^[a-zA-Z0-9]+$/.test(cleanUtr)
    ) {
      return res.status(400).json({
        message: "Invalid UTR number"
      });
    }

    const payments = await readJson("payments");

    const alreadyExists = payments.find((p) => {
      return String(p.utr || "").toLowerCase() === cleanUtr.toLowerCase();
    });

    if (alreadyExists) {
      return res.status(400).json({
        message: "This UTR is already submitted"
      });
    }

    const payment = {
      id: Date.now().toString(),
      userId: req.user.id,
      userName: req.user.name,
      userEmail: req.user.email,
      planId,
      amount: Number(amount),
      utr: cleanUtr,
      screenshotPath: `/uploads/payments/${req.file.filename}`,
      status: "pending",
      createdAt: new Date().toISOString()
    };

    payments.unshift(payment);

    await writeJson("payments", payments);

    res.json({
      message: "Payment request submitted. Admin approval pending.",
      payment
    });

  } catch (err) {
    console.error("Payment request error:", err);
    res.status(500).json({
      message: "Payment request failed"
    });
  }
});

app.post("/api/contact", async (req, res) => {
  try {
    const { name, email, mobile, message } = req.body;

    if (!name || !message) {
      return res.status(400).json({
        message: "Name and message are required"
      });
    }

    const contacts = await readJson("contacts");

    const contact = {
      id: Date.now().toString(),
      name: String(name || "").trim(),
      email: normalizeEmail(email),
      mobile: normalizeMobile(mobile),
      message: String(message || "").trim(),
      createdAt: new Date().toISOString()
    };

    contacts.unshift(contact);

    await writeJson("contacts", contacts);

    res.json({
      message: "Message submitted successfully",
      contact
    });

  } catch (err) {
    console.error("Contact error:", err);
    res.status(500).json({
      message: "Contact submit failed"
    });
  }
});

// ==========================================
// 9. ADMIN ROUTES
// ==========================================

const ADMIN_EMAIL = process.env.ADMIN_EMAIL || "admin@mathsguru.com";
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "admin123";

app.post("/api/admin/login", async (req, res) => {
  try {
    const email = normalizeEmail(req.body.email);
    const password = String(req.body.password || "");

    if (email !== normalizeEmail(ADMIN_EMAIL) || password !== ADMIN_PASSWORD) {
      return res.status(401).json({
        message: "Invalid admin email or password"
      });
    }

    const token = signToken({
      role: "admin",
      email: ADMIN_EMAIL
    });

    res.json({
      message: "Admin login successful",
      token,
      admin: {
        email: ADMIN_EMAIL,
        role: "admin"
      }
    });

  } catch (err) {
    console.error("Admin login error:", err);
    res.status(500).json({
      message: "Admin login failed"
    });
  }
});

app.get("/api/admin/dashboard", requireAdmin, async (req, res) => {
  try {
    const users = await readJson("users");
    const payments = await readJson("payments");
    const doubts = await readJson("doubts");
    const tests = await readJson("tests");
    const contacts = await readJson("contacts");

    const safeUsers = users.map(safeAdminUser);
    const premiumUsers = users.filter((u) => isPremiumValid(u)).length;

    const pendingPayments = payments.filter((p) => {
      return (p.status || "pending") === "pending";
    }).length;

    res.json({
      totalUsers: users.length,
      pendingPayments,
      premiumUsers,
      totalDoubts: doubts.length,
      stats: {
        totalUsers: users.length,
        pendingPayments,
        premiumUsers,
        totalDoubts: doubts.length,
        totalPayments: payments.length,
        totalTests: tests.length,
        totalContacts: contacts.length
      },
      users: safeUsers,
      payments,
      doubts: doubts.slice(0, 100),
      recentDoubts: doubts.slice(0, 100),
      tests: tests.slice(0, 100),
      contacts: contacts.slice(0, 100)
    });

  } catch (err) {
    console.error("Admin dashboard error:", err);
    res.status(500).json({
      message: "Admin dashboard failed"
    });
  }
});

app.post("/api/admin/payments/:paymentId/approve", requireAdmin, async (req, res) => {
  try {
    const { paymentId } = req.params;
    const { adminNote } = req.body;

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
        message: "User not found for this payment"
      });
    }

    payment.status = "approved";
    payment.adminNote = adminNote || "";
    payment.approvedAt = new Date().toISOString();

    user.planId = payment.planId || "popular_3m";
    user.premiumActive = true;
    user.paymentStatus = "approved";
    user.lastPaymentId = payment.id;
    user.planExpiry = getPlanExpiry(user.planId);
    user.updatedAt = new Date().toISOString();

    await writeJson("payments", payments);
    await writeJson("users", users);

    res.json({
      message: "Payment approved and premium activated",
      payment,
      user: safeAdminUser(user)
    });

  } catch (err) {
    console.error("Payment approve error:", err);
    res.status(500).json({
      message: "Payment approve failed"
    });
  }
});

app.post("/api/admin/payments/:paymentId/reject", requireAdmin, async (req, res) => {
  try {
    const { paymentId } = req.params;
    const { adminNote } = req.body;

    const payments = await readJson("payments");
    const payment = payments.find((p) => String(p.id) === String(paymentId));

    if (!payment) {
      return res.status(404).json({
        message: "Payment not found"
      });
    }

    payment.status = "rejected";
    payment.adminNote = adminNote || "";
    payment.rejectedAt = new Date().toISOString();

    await writeJson("payments", payments);

    res.json({
      message: "Payment rejected",
      payment
    });

  } catch (err) {
    console.error("Payment reject error:", err);
    res.status(500).json({
      message: "Payment reject failed"
    });
  }
});

app.put("/api/admin/users/:userId", requireAdmin, async (req, res) => {
  try {
    const { userId } = req.params;

    const users = await readJson("users");
    const user = users.find((u) => String(u.id) === String(userId));

    if (!user) {
      return res.status(404).json({
        message: "User not found"
      });
    }

    const {
      name,
      email,
      mobile,
      className,
      planId,
      planExpiry,
      extraText,
      extraImage,
      extraTests,
      status,
      adminNote
    } = req.body;

    user.name = name || user.name;
    user.email = email ? normalizeEmail(email) : user.email;
    user.mobile = mobile ? normalizeMobile(mobile) : user.mobile;
    user.className = className || user.className || "";

    user.planId = planId || "free";
    user.planExpiry = planExpiry || null;
    user.premiumActive = user.planId !== "free";
    user.paymentStatus = user.planId !== "free" ? "manual_admin" : "free";

    user.extraText = Number(extraText || 0);
    user.extraImage = Number(extraImage || 0);
    user.extraTests = Number(extraTests || 0);

    user.status = status || "active";
    user.adminNote = adminNote || "";
    user.updatedAt = new Date().toISOString();

    await writeJson("users", users);

    res.json({
      message: "User updated successfully",
      user: safeAdminUser(user)
    });

  } catch (err) {
    console.error("Admin user update error:", err);
    res.status(500).json({
      message: "User update failed"
    });
  }
});

app.post("/api/admin/users/:userId/activate", requireAdmin, async (req, res) => {
  try {
    const { userId } = req.params;
    const { planId } = req.body;

    const users = await readJson("users");
    const user = users.find((u) => String(u.id) === String(userId));

    if (!user) {
      return res.status(404).json({
        message: "User not found"
      });
    }

    const finalPlan = planId || "popular_3m";

    user.planId = finalPlan;
    user.premiumActive = true;
    user.paymentStatus = "manual_admin";
    user.planExpiry = getPlanExpiry(finalPlan);
    user.updatedAt = new Date().toISOString();

    await writeJson("users", users);

    res.json({
      message: "Premium activated manually",
      user: safeAdminUser(user)
    });

  } catch (err) {
    console.error("Manual activate error:", err);
    res.status(500).json({
      message: "Manual activation failed"
    });
  }
});

app.post("/api/admin/users/:userId/reset-usage", requireAdmin, async (req, res) => {
  try {
    const { userId } = req.params;

    const users = await readJson("users");
    const user = users.find((u) => String(u.id) === String(userId));

    if (!user) {
      return res.status(404).json({
        message: "User not found"
      });
    }

    user.textUsed = 0;
    user.imageUsed = 0;
    user.testUsed = 0;
    user.updatedAt = new Date().toISOString();

    await writeJson("users", users);

    res.json({
      message: "Usage reset successfully",
      user: safeAdminUser(user)
    });

  } catch (err) {
    console.error("Reset usage error:", err);
    res.status(500).json({
      message: "Usage reset failed"
    });
  }
});

app.delete("/api/admin/users/:userId", requireAdmin, async (req, res) => {
  try {
    const { userId } = req.params;

    let users = await readJson("users");

    const exists = users.find((u) => String(u.id) === String(userId));

    if (!exists) {
      return res.status(404).json({
        message: "User not found"
      });
    }

    users = users.filter((u) => String(u.id) !== String(userId));

    await writeJson("users", users);

    res.json({
      message: "User deleted successfully"
    });

  } catch (err) {
    console.error("Delete user error:", err);
    res.status(500).json({
      message: "User delete failed"
    });
  }
});

// ==========================================
// 10. STATIC FILES & FALLBACK
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
