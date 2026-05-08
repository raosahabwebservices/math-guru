// ==========================================
// 1. INITIALIZATION & IMPORTS
// ==========================================
require('dotenv').config();
const express = require('express');
const path = require('path');
const cors = require('cors');
const fs = require('fs').promises;
const fsSync = require('fs'); // Directory check ke liye
const jwt = require('jsonwebtoken');
const multer = require('multer');

const app = express();
app.use(cors());
app.use(express.json());

const dataDir = path.join(__dirname, 'data');
const uploadDir = path.join(__dirname, 'uploads');

// 🔥 RENDER FIX: Agar folders missing hain toh auto-create karega
if (!fsSync.existsSync(dataDir)) fsSync.mkdirSync(dataDir, { recursive: true });
if (!fsSync.existsSync(uploadDir)) fsSync.mkdirSync(uploadDir, { recursive: true });

// ==========================================
// 2. HELPERS (Database & Auth)
// ==========================================

// ✅ SAFE READ: Khali file hone par crash nahi hoga
async function readJson(file) {
    try {
        const filePath = path.join(dataDir, `${file}.json`);
        const data = await fs.readFile(filePath, 'utf8');
        if (!data || data.trim() === "") return [];
        return JSON.parse(data);
    } catch (err) {
        return []; 
    }
}

// ✅ SAFE WRITE: Data sunder tarike se save karega
async function writeJson(file, data) {
    try {
        const filePath = path.join(dataDir, `${file}.json`);
        await fs.writeFile(filePath, JSON.stringify(data, null, 2));
    } catch (err) {
        console.error(`Error writing ${file}:`, err);
    }
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
    id: u.id, 
    name: u.name, 
    email: u.email, 
    premiumActive: u.premiumActive,
    remainingText: (u.premiumActive ? 100 : 10) - (u.textUsed || 0),
    remainingImage: (u.premiumActive ? 100 : 3) - (u.imageUsed || 0)
});

// ==========================================
// 3. AUTH ROUTES (Signup & Login)
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
    if (!user) return res.status(404).json({ message: "User not found" });
    res.json({ user: publicUser(user) });
});

// ==========================================
// 4. ADMIN & DOUBT ROUTES
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
        res.json({ token, user: { id: admin.id, name: admin.name, role: 'admin' } });
    } catch (err) { res.status(500).json({ message: "Login Failed" }); }
});

app.get("/api/admin/dashboard", requireAuth, async (req, res) => {
    try {
        const users = await readJson("users");
        const doubts = await readJson("doubts");
        res.json({
            stats: { totalUsers: users.length, totalDoubts: doubts.length, premiumUsers: users.filter(u => u.premiumActive).length },
            users: users.slice(0, 50),
            recentDoubts: doubts.slice(0, 10)
        });
    } catch (err) { res.status(500).json({ message: "Stats load failed" }); }
});

app.get("/api/doubts/history", requireAuth, async (req, res) => {
    const doubts = await readJson("doubts");
    res.json({ doubts: doubts.filter(d => d.userId === req.user.id) });
});

app.post("/api/doubt/text", requireAuth, async (req, res) => {
    try {
        const { question } = req.body;
        const users = await readJson("users");
        const user = users.find(u => u.id === req.user.id);
        
        const solution = {
            understanding: "I have analyzed your math question.",
            formula: "Basic Arithmetic",
            solution: "1 + 1 = 2",
            finalAnswer: "2",
            hindi: "Iska jawab 2 hai.",
            english: "The answer is 2."
        };

        user.textUsed = (user.textUsed || 0) + 1;
        const doubts = await readJson("doubts");
        const doubt = { id: Date.now().toString(), userId: user.id, type: "text", question, solution, createdAt: new Date() };
        doubts.unshift(doubt);

        await writeJson("users", users);
        await writeJson("doubts", doubts);
        res.json({ doubt, user: publicUser(user) });
    } catch (err) { res.status(500).json({ message: "AI failed" }); }
});

// ==========================================
// 5. STATIC FILES & FALLBACK (Root Fix)
// ==========================================
app.use(express.static(__dirname)); 
app.use('/uploads', express.static(uploadDir));

app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server is LIVE on port ${PORT}`);
});
