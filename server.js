// ==========================================
// 1. INITIALIZATION & IMPORTS
// ==========================================
require('dotenv').config();
const express = require('express');
const path = require('path');
const cors = require('cors');
const fs = require('fs').promises; // JSON files read karne ke liye
const jwt = require('jsonwebtoken'); // Token ke liye
const multer = require('multer'); // Image upload ke liye

const app = express();
app.use(cors());
app.use(express.json());

// Path setup
const dataDir = path.join(__dirname, 'data');
const uploadDir = path.join(__dirname, 'uploads');

// ==========================================
// 2. HELPERS (Ye missing hone se crash hota hai)
// ==========================================

// JSON Read/Write Helpers
async function readJson(file) {
    try {
        const data = await fs.readFile(path.join(dataDir, `${file}.json`), 'utf8');
        return JSON.parse(data);
    } catch { return []; }
}

async function writeJson(file, data) {
    await fs.writeFile(path.join(dataDir, `${file}.json`), JSON.stringify(data, null, 2));
}

// Auth Helpers
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

// Multer Config for Images
const storage = multer.diskStorage({
    destination: uploadDir,
    filename: (req, file, cb) => cb(null, Date.now() + path.extname(file.originalname))
});
const upload = multer({ storage });

// Dummy AI Functions (Apne asli functions se badal lena)
const solveTextDoubt = async (q, lang) => `AI Solution in ${lang} for: ${q}`;
const solveImageDoubt = async (path, type, q, lang) => `AI Image Solution in ${lang}`;
const publicUser = (u) => ({ id: u.id, name: u.name, email: u.email, premiumActive: u.premiumActive });
const generateId = () => Math.random().toString(36).substr(2, 9);

// ==========================================
// 3. ROUTES (Admin & Doubt)
// ==========================================

app.post("/api/admin/login", async (req, res) => {
    try {
        const { email, password } = req.body;
        if (email === process.env.ADMIN_EMAIL && password === process.env.ADMIN_PASSWORD) {
            const token = signToken({ id: "admin-root", role: "admin" });
            return res.json({ token, user: { id: "admin-root", name: "Super Admin", role: "admin" } });
        }
        const admins = await readJson("admins");
        const admin = admins.find(a => a.email === email && a.password === password);
        if (!admin) return res.status(401).json({ message: "Galat credentials!" });
        const token = signToken({ id: admin.id, role: 'admin' });
        res.json({ token, user: publicUser(admin) });
    } catch (err) { res.status(500).json({ message: "Login Failed" }); }
});

app.post("/api/doubt/text", requireAuth, async (req, res) => {
    try {
        const { question, language } = req.body;
        const users = await readJson("users");
        const user = users.find(u => u.id === req.user.id);
        if (!user) return res.status(404).json({ message: "User not found" });

        const solution = await solveTextDoubt(question, language || "Hinglish");
        user.textUsed = (user.textUsed || 0) + 1;
        
        await writeJson("users", users);
        res.json({ solution, user: publicUser(user) });
  } catch (err) { res.status(500).json({ message: "AI failed" }); }
});

// ==========================================
// 4. STATIC & FALLBACK (Render Fix)
// ==========================================
app.use(express.static(path.join(__dirname, 'public')));
app.use('/uploads', express.static(uploadDir));

app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// 🔥 LISTEN
const PORT = process.env.PORT || 3000;
app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server is LIVE on port ${PORT}`);
});
