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

// ✅ ASLI AI IMPORT (ai.js ko link kiya)
const { solveTextDoubt, solveImageDoubt } = require('./ai');

const app = express();
app.use(cors());
app.use(express.json());

const dataDir = path.join(__dirname, 'data');
const uploadDir = path.join(__dirname, 'uploads');

// Render fix for folders
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

// ✅ TEXT DOUBT (OpenRouter GPT-4o-mini connect kiya)
app.post("/api/doubt/text", requireAuth, async (req, res) => {
    try {
        const { question, language } = req.body;
        const users = await readJson("users");
        const user = users.find(u => u.id === req.user.id);
        
        // Asli AI Call
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

// ✅ IMAGE DOUBT (404 Fix aur AI Connect)
app.post("/api/doubt/image", requireAuth, upload.single('image'), async (req, res) => {
    try {
        if (!req.file) return res.status(400).json({ message: "No image uploaded" });
        
        const { question, language } = req.body;
        const users = await readJson("users");
        const user = users.find(u => u.id === req.user.id);

        // Asli AI Call (Image wala)
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
// 5. STATIC FILES & FALLBACK
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
   // ==========================================
// ADMIN API ROUTES (Keep these ABOVE app.get('*'))
// ==========================================

// 1. Admin Login
app.post("/api/admin/login", async (req, res) => {
    try {
        const { email, password } = req.body;
        if (email === process.env.ADMIN_EMAIL && password === process.env.ADMIN_PASSWORD) {
            const token = signToken({ id: "admin-root", role: "admin" });
            return res.json({ token, user: { id: "admin-root", name: "Super Admin", role: "admin" } });
        }
        res.status(401).json({ message: "Galat Admin Credentials!" });
    } catch (err) { res.status(500).json({ message: "Login Failed" }); }
});

// 2. Admin Dashboard Stats
app.get("/api/admin/dashboard", requireAuth, async (req, res) => {
    const users = await readJson("users");
    const doubts = await readJson("doubts");
    res.json({
        stats: { totalUsers: users.length, totalDoubts: doubts.length, premiumUsers: users.filter(u => u.premiumActive).length },
        users: users.slice(0, 50),
        recentDoubts: doubts.slice(0, 10)
    });
});

// 3. Admin Payments (Table fix)
app.get("/api/admin/payments", requireAuth, async (req, res) => {
    const payments = await readJson("payments");
    res.json({ payments: payments || [] });
});

// 4. Admin Contacts
app.get("/api/admin/contacts", requireAuth, async (req, res) => {
    const contacts = await readJson("contacts");
    res.json({ contacts: contacts || [] });
});

// 5. Payment Approve/Reject (Important for Table Actions)
app.put("/api/admin/payment/:id", requireAuth, async (req, res) => {
    const { action, userId } = req.body;
    const payments = await readJson("payments");
    const users = await readJson("users");
    
    const idx = payments.findIndex(p => p.id === req.params.id);
    if (idx !== -1) {
        payments[idx].status = action === 'approve' ? 'approved' : 'rejected';
        if (action === 'approve') {
            const uIdx = users.findIndex(u => u.id === userId);
            if (uIdx !== -1) users[uIdx].premiumActive = true;
        }
        await writeJson("payments", payments);
        await writeJson("users", users);
        return res.json({ message: "Updated" });
    }
    res.status(404).json({ message: "Not found" });
});

