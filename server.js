// ==========================================
// 1. INITIALIZATION & IMPORTS
// ==========================================
require('dotenv').config();
const express = require('express');
const path = require('path');
const cors = require('cors');
const fsSync = require('fs'); 
const multer = require('multer');
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

// Internal Hooks (Tumhara chalne wala exact auth middleware aur AI files)
const { requireAuth, signToken } = require('./auth');
const { solveTextDoubt, solveImageDoubt, generateCustomTest } = require('./ai');

const app = express();
app.use(cors());
app.use(express.json());

const uploadDir = path.join(__dirname, 'uploads');
if (!fsSync.existsSync(uploadDir)) fsSync.mkdirSync(uploadDir, { recursive: true });

// ==========================================
// 🔌 MONGOOSE CLOUD DATABASE CONNECTION
// ==========================================
// Live strict Atlas connection URL
const MONGO_URI = process.env.MONGO_URI || "mongodb+srv://mathguru498_db_user:Harshit7880@cluster0.c9q0v1g.mongodb.net/mathsguru?retryWrites=true&w=majority&appName=Cluster0";

mongoose.connect(MONGO_URI)
  .then(() => console.log("🚀 Badhai ho! Maths Guru Backend MongoDB Cloud se connect ho gaya."))
  .catch(err => console.error("❌ MongoDB connection error:", err));

// ==========================================
// 📝 SCHEMAS & MONGOOSE MODELS
// ==========================================
const userSchema = new mongoose.Schema({
    name: { type: String, required: true },
    email: { type: String, required: true, unique: true },
    mobile: { type: String, required: true, unique: true },
    password: { type: String, required: true },
    premiumActive: { type: Boolean, default: false },
    textUsed: { type: Number, default: 0 },
    imageUsed: { type: Number, default: 0 },
    textLimitBonus: { type: Number, default: 0 },
    myReferralCode: { type: String, unique: true },
    referredBy: { type: String, default: null }
}, { timestamps: true });
const User = mongoose.model('User', userSchema);

const doubtSchema = new mongoose.Schema({
    userId: { type: String, required: true },
    type: { type: String, enum: ['text', 'image'], required: true },
    question: { type: String, required: true },
    solution: { type: mongoose.Schema.Types.Mixed, required: true }, 
    imagePath: { type: String, default: null }
}, { timestamps: true });
const Doubt = mongoose.model('Doubt', doubtSchema);

const testSchema = new mongoose.Schema({
    userId: { type: String, required: true },
    classLevel: String,
    chapter: String,
    difficulty: String,
    questionType: String,
    language: String,
    questions: { type: mongoose.Schema.Types.Mixed, required: true }, 
    score: { type: Number, default: 0 },
    timeTaken: { type: String, default: null }
}, { timestamps: true });
const Test = mongoose.model('Test', testSchema);

const upload = multer({ dest: uploadDir });

// Backend mapping compliance data syncing helper
const publicUser = (u) => ({ 
    id: u._id.toString(), 
    name: u.name, 
    email: u.email, 
    premiumActive: u.premiumActive,
    remainingText: (u.premiumActive ? 100 : 10) + (u.textLimitBonus || 0) - (u.textUsed || 0),
    remainingImage: (u.premiumActive ? 100 : 3) - (u.imageUsed || 0)
});

function generateRandomCode(name) {
    const prefix = name ? name.substring(0, 4).toUpperCase().replace(/\s+/g, '') : "MG";
    const rand = Math.floor(1000 + Math.random() * 9000);
    return `${prefix}${rand}`;
}

// ==========================================
// 🔐 REVOLUTIONARY LOGIN & SIGNUP (BCRYPT FIXED)
// ==========================================
app.post("/api/auth/signup", async (req, res) => {
    try {
        const { name, email, mobile, password, referralCode } = req.body;
        
        let existingUser = await User.findOne({ $or: [{ email }, { mobile }] });
        if (existingUser) return res.status(400).json({ message: "Email ya Mobile number pehle se hai bhai!" });

        // Password strict hashing taaki login check bypass na ho
        const hashedPassword = await bcrypt.hash(password, 10);
        let referredByCode = null;
        let selfBonus = 0;

        if (referralCode) {
            const referrer = await User.findOne({ myReferralCode: referralCode.toUpperCase().trim() });
            if (referrer) {
                referredByCode = referrer.myReferralCode;
                selfBonus = 2; // Extra bonus token points
                referrer.textLimitBonus = (referrer.textLimitBonus || 0) + 5;
                await referrer.save();
            }
        }

        const newUser = new User({
            name, email, mobile, password: hashedPassword,
            textLimitBonus: selfBonus,
            myReferralCode: generateRandomCode(name),
            referredBy: referredByCode
        });
        await newUser.save();

        // Exact tumhare purane token structure integration se matching
        const token = signToken({ id: newUser._id.toString() });
        res.json({ token, user: publicUser(newUser) });
    } catch (err) { res.status(500).json({ message: "Signup Crash: " + err.message }); }
});

app.post("/api/auth/login", async (req, res) => {
    try {
        const { identifier, password } = req.body;
        
        // Find user by either email or mobile phone
        const user = await User.findOne({ 
            $or: [{ email: identifier.trim() }, { mobile: identifier.trim() }] 
        });
        if (!user) return res.status(401).json({ message: "Invalid Credentials (User not found)" });

        // Compare current plain input with hashed database password string
        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) return res.status(401).json({ message: "Invalid Credentials (Password mismatch)" });

        const token = signToken({ id: user._id.toString() });
        res.json({ token, user: publicUser(user) });
    } catch (err) { res.status(500).json({ message: "Login Crash: " + err.message }); }
});

app.get("/api/profile", requireAuth, async (req, res) => {
    try {
        const user = await User.findById(req.user.id);
        if (!user) return res.status(404).json({ message: "User not found" });
        res.json({ user: publicUser(user) });
    } catch (err) { res.status(500).json({ message: err.message }); }
});

// ==========================================
// 🧠 ASLI AI DOUBT ROUTES (Direct MongoDB Atlas Sync)
// ==========================================
app.post("/api/doubt/text", requireAuth, async (req, res) => {
    try {
        const { question, language } = req.body;
        const user = await User.findById(req.user.id);
        if (!user) return res.status(404).json({ message: "User missing" });
        
        // Execute real OpenRouter/Gemini function hook from ai.js
        const solution = await solveTextDoubt(question, language || "Hinglish");

        user.textUsed = (user.textUsed || 0) + 1;
        await user.save();

        const doubt = new Doubt({ userId: user._id.toString(), type: "text", question, solution });
        await doubt.save();

        res.json({ doubt, user: publicUser(user) });
    } catch (err) { res.status(500).json({ message: "AI process failed: " + err.message }); }
});

app.post("/api/doubt/image", requireAuth, upload.single('image'), async (req, res) => {
    try {
        if (!req.file) return res.status(400).json({ message: "No image file provided" });
        const { question, language } = req.body;
        
        const user = await User.findById(req.user.id);
        if (!user) return res.status(404).json({ message: "User not found" });

        const solution = await solveImageDoubt(req.file.path, req.file.mimetype, question, language);
        
        user.imageUsed = (user.imageUsed || 0) + 1;
        await user.save();

        const imageRelativePath = `/uploads/${req.file.filename}`;
        const doubt = new Doubt({ userId: user._id.toString(), type: "image", question: question || "Image query", solution, imagePath: imageRelativePath });
        await doubt.save();

        res.json({ doubt, user: publicUser(user) });
    } catch (err) { res.status(500).json({ message: "Image AI crash: " + err.message }); }
});

app.get("/api/doubts/history", requireAuth, async (req, res) => {
    try {
        const doubts = await Doubt.find({ userId: req.user.id }).sort({ createdAt: -1 });
        res.json({ doubts });
    } catch (err) { res.status(500).json({ message: err.message }); }
});

// ==========================================
// ⚡ ASLI AI TEST GENERATOR ROUTES (Makkhan Sync)
// ==========================================
app.post("/api/test/generate", requireAuth, async (req, res) => {
    try {
        const { classLevel, chapter, topic, difficulty, questionType, numQuestions, language } = req.body;
        const finalTopic = topic || chapter || "General Questions";

        // Call AI engine function direct from ai.js
        const generatedQuestions = await generateCustomTest({
            classLevel, chapter, topic: finalTopic, difficulty, questionType, numQuestions, language
        });

        const newTest = new Test({
            userId: req.user.id, classLevel, chapter, difficulty, questionType, language, questions: generatedQuestions
        });
        await newTest.save();

        res.setHeader('Content-Type', 'application/json');
        res.json({ message: "🚀 Test ban gaya.", testId: newTest._id.toString(), questions: generatedQuestions });
    } catch (err) { res.status(500).json({ message: "Test Gen Engine failed: " + err.message }); }
});

app.post("/api/test/submit/:id", requireAuth, async (req, res) => {
    try {
        const { score, timeTaken } = req.body;
        const updatedTest = await Test.findByIdAndUpdate(req.params.id, { score, timeTaken }, { new: true });
        res.json({ message: "🎯 Score saved successfully!", test: updatedTest });
    } catch (err) { res.status(500).json({ message: "Submission crash: " + err.message }); }
});

// ==========================================
// 5. VERCEL SERVERLESS STATIC BYPASS (FIXED)
// ==========================================
app.use('/uploads', express.static(uploadDir));

// ✅ RUNTIME CRASH FIX: Base target fallback string pass check
app.get('/', (req, res) => {
    res.json({ message: "🚀 Maths Guru pure MongoDB Engine is running live on Vercel!" });
});

app.get('/api/*', (req, res) => {
    res.status(404).json({ error: "API Endpoint path not found" });
});

app.get('*', (req, res) => {
    res.status(404).json({ error: "Static asset directory path missing" });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server is LIVE on port ${PORT}`);
});
    
