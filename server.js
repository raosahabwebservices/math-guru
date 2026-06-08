// ==========================================
// 1. INITIALIZATION & IMPORTS
// ==========================================
require('dotenv').config();
const express = require('express');
const path = require('path');
const cors = require('cors');
const fs = require('fs').promises;
const fsSync = require('fs'); 
const jwt = require('jsonwebtoken');
const multer = require('multer');

// ✅ ASLI AI IMPORT (Doubt aur Test Generator teeno link ho gaye)
const { solveTextDoubt, solveImageDoubt, generateCustomTest } = require('./ai');

const app = express();
app.use(cors());
app.use(express.json());

const dataDir = path.join(__dirname, 'data');

// 👑 CRITICAL VERCEL FIX: Local root par uploads block kar di
const uploadDir = path.join('/tmp', 'uploads');

if (!fsSync.existsSync(dataDir)) fsSync.mkdirSync(dataDir, { recursive: true });
if (!fsSync.existsSync(uploadDir)) fsSync.mkdirSync(uploadDir, { recursive: true });

// ==========================================
// 2. HELPERS
// ==========================================
async function readJson(file) {
    try {
        const filePath = path.join(dataDir, `${file}.json`);
        const data = await fs.readFile(filePath, 'utf8');
        if (!data || data.trim() === "") return [];
        return JSON.parse(data);
    } catch (err) { return []; }
}

async function writeJson(file, data) {
    try {
        const filePath = path.join(dataDir, `${file}.json`);
        await fs.writeFile(filePath, JSON.stringify(data, null, 2));
    } catch (err) { console.error(`Error writing ${file}:`, err); }
}

const signToken = (user) => jwt.sign(user, process.env.JWT_SECRET || 'secret123', { expiresIn: '7d' });

const requireAuth = (req, res, next) => {
    const authHeader = req.headers.authorization;
    if (!authHeader) return res.status(401).json({ message: "No token provided" });
    const token = authHeader.split(' ')[1];
    jwt.verify(token, process.env.JWT_SECRET || 'secret123', (err, user) => {
        if (err) return res.status(403).json({ message: "Invalid token" });
        req.user = user;
        next();
    });
};

const upload = multer({ dest: uploadDir });

const publicUser = (u) => ({ 
    id: u.id, name: u.name, email: u.email, premiumActive: u.premiumActive,
    remainingText: (u.premiumActive ? 100 : 10) - (u.textUsed || 0),
    remainingImage: (u.premiumActive ? 100 : 3) - (u.imageUsed || 0)
});

// ==========================================
// 3. AUTH ROUTES
// ==========================================
app.post("/api/signup", async (req, res) => {
    try {
        const { name, email, password } = req.body;
        const users = await readJson("users");
        if (users.find(u => u.email === email)) return res.status(400).json({ message: "Email already exists" });
        const newUser = { id: Date.now().toString(), name, email, password, premiumActive: false, textUsed: 0, imageUsed: 0 };
        users.push(newUser);
        await writeJson("users", users);
        res.json({ token: signToken({ id: newUser.id }), user: publicUser(newUser) });
    } catch (err) { res.status(500).json({ message: "Signup Failed" }); }
});

app.post("/api/login", async (req, res) => {
    try {
        const { email, password } = req.body;
        const users = await readJson("users");
        const user = users.find(u => u.email === email && u.password === password);
        if (!user) return res.status(401).json({ message: "Invalid Credentials" });
        res.json({ token: signToken({ id: user.id }), user: publicUser(user) });
    } catch (err) { res.status(500).json({ message: "Login Failed" }); }
});

app.get("/api/profile", requireAuth, async (req, res) => {
    const users = await readJson("users");
    const user = users.find(u => u.id === req.user.id);
    res.json({ user: publicUser(user) });
});

// ==========================================
// 4. ASLI AI DOUBT ROUTES
// ==========================================
app.post("/api/doubt/text", requireAuth, async (req, res) => {
    try {
        const { question, language } = req.body;
        const users = await readJson("users");
        const user = users.find(u => u.id === req.user.id);
        
        const solution = await solveTextDoubt(question, language || "Hinglish");

        user.textUsed = (user.textUsed || 0) + 1;
        const doubts = await readJson("doubts");
        const doubt = { id: Date.now().toString(), userId: user.id, type: "text", question, solution, createdAt: new Date() };
        doubts.unshift(doubt);

        await writeJson("users", users);
        await writeJson("doubts", doubts);
        res.json({ doubt, user: publicUser(user) });
    } catch (err) { res.status(500).json({ message: "AI Error: " + err.message }); }
});

app.post("/api/doubt/image", requireAuth, upload.single('image'), async (req, res) => {
    try {
        if (!req.file) return res.status(400).json({ message: "No image uploaded" });
        
        const { question, language } = req.body;
        const users = await readJson("users");
        const user = users.find(u => u.id === req.user.id);

        const solution = await solveImageDoubt(req.file.path, req.file.mimetype, question, language);

        user.imageUsed = (user.imageUsed || 0) + 1;
        const doubts = await readJson("doubts");
        const doubt = { 
            id: Date.now().toString(), 
            userId: user.id, 
            type: "image", 
            imagePath: `/uploads/${req.file.filename}`, 
            solution, 
            createdAt: new Date() 
        };

        doubts.unshift(doubt);
        await writeJson("users", users);
        await writeJson("doubts", doubts);
        res.json({ doubt, user: publicUser(user) });
    } catch (err) { res.status(500).json({ message: "Image AI Error" }); }
});

app.get("/api/doubts/history", requireAuth, async (req, res) => {
    const doubts = await readJson("doubts");
    res.json({ doubts: doubts.filter(d => d.userId === req.user.id) });
});

// ==========================================
// ⚡ NEW: APNA TEST BANAO ROUTES (AI Test Engine)
// ==========================================
app.post("/api/test/generate", requireAuth, async (req, res) => {
    try {
        const { classLevel, chapter, topic, difficulty, questionType, numQuestions, language } = req.body;
        const finalTopic = topic || chapter || "General Practice Questions";

        // Real OpenRouter AI Custom Test Prompt Trigger
        const generatedQuestions = await generateCustomTest({
            classLevel, chapter, topic: finalTopic, difficulty, questionType, numQuestions, language
        });

        const tests = await readJson("tests");
        const newTest = {
            id: Date.now().toString(),
            userId: req.user.id,
            classLevel,
            chapter,
            difficulty,
            questionType,
            language,
            questions: generatedQuestions,
            score: null,
            timeTaken: null,
            createdAt: new Date()
        };
        
        tests.unshift(newTest);
        await writeJson("tests", tests);

        res.json({ message: "🚀 Test successfully created!", testId: newTest.id, questions: generatedQuestions });
    } catch (err) { 
        console.error(err);
        res.status(500).json({ message: "Test Generation Engine failed: " + err.message }); 
    }
});

app.post("/api/test/submit/:id", requireAuth, async (req, res) => {
    try {
        const { score, timeTaken } = req.body;
        const tests = await readJson("tests");
        const test = tests.find(t => t.id === req.params.id);
        
        if (!test) return res.status(404).json({ message: "Test paper not found!" });

        test.score = score;
        test.timeTaken = timeTaken;
        
        await writeJson("tests", tests);
        res.json({ message: "🎯 Score card updated successfully!", test });
    } catch (err) { res.status(500).json({ message: "Submission failed" }); }
});

// ==========================================
// 5. STATIC FILES & FALLBACK
// ==========================================
app.use('/uploads', express.static(uploadDir));

app.get('/', (req, res) => {
    res.json({ message: "🚀 Maths Guru Original Engine with Test Generator is active on Vercel!" });
});

app.get('*', (req, res) => {
    res.status(404).json({ error: "Route not found" });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server is LIVE on port ${PORT}`);
});
  
