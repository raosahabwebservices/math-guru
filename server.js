// ==========================================
// 1. INITIALIZATION & IMPORTS
// ==========================================
require('dotenv').config();
const express = require('express');
const path = require('path');
const cors = require('cors');
const fs = require('fs').promises;
const jwt = require('jsonwebtoken');
const multer = require('multer');

const app = express();
app.use(cors());
app.use(express.json());

const dataDir = path.join(__dirname, 'data');
const uploadDir = path.join(__dirname, 'uploads');

// ==========================================
// 2. HELPERS
// ==========================================
async function readJson(file) {
    try {
        const data = await fs.readFile(path.join(dataDir, `${file}.json`), 'utf8');
        return JSON.parse(data);
    } catch { return []; }
}

async function writeJson(file, data) {
    await fs.writeFile(path.join(dataDir, `${file}.json`), JSON.stringify(data, null, 2));
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
const solveTextDoubt = async (q, lang) => `AI Solution in ${lang} for: ${q}`;
const publicUser = (u) => ({ id: u.id, name: u.name, email: u.email, premiumActive: u.premiumActive, textUsed: u.textUsed, imageUsed: u.imageUsed });

// ==========================================
// 3. ADMIN ROUTES (Dashboard Fix Included)
// ==========================================

// ✅ ADMIN LOGIN
app.post("/api/admin/login", async (req, res) => {
    try {
        const { email, password } = req.body;
        if (email === process.env.ADMIN_EMAIL && password === process.env.ADMIN_PASSWORD) {
            // Role admin dena bahut zaroori hai Dashboard access ke liye
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

// ✅ ADMIN DASHBOARD DATA (Iske bina loop chalega)
app.get("/api/admin/dashboard", requireAuth, async (req, res) => {
    try {
        const users = await readJson("users");
        const doubts = await readJson("doubts");
        res.json({
            stats: {
                totalUsers: users.length,
                totalDoubts: doubts.length,
                premiumUsers: users.filter(u => u.premiumActive).length
            },
            users: users.slice(0, 50),
            recentDoubts: doubts.slice(0, 10)
        });
    } catch (err) { res.status(500).json({ message: "Stats load failed" }); }
});

// ✅ ADMIN PAYMENTS (Fix for dashboard loading)
app.get("/api/admin/payments", requireAuth, async (req, res) => {
    const payments = await readJson("payments");
    res.json({ payments: payments || [] });
});

// ✅ ADMIN CONTACTS (Fix for dashboard loading)
app.get("/api/admin/contacts", requireAuth, async (req, res) => {
    const contacts = await readJson("contacts");
    res.json({ contacts: contacts || [] });
});

// ==========================================
// 4. STUDENT DOUBT ROUTES
// ==========================================

app.post("/api/doubt/text", requireAuth, async (req, res) => {
    try {
        const { question, language } = req.body;
        const users = await readJson("users");
        const user = users.find(u => u.id === req.user.id);
        if (!user) return res.status(404).json({ message: "User not found" });

        const solution = await solveTextDoubt(question, language || "Hinglish");
        user.textUsed = (user.textUsed || 0) + 1;
        
        const doubts = await readJson("doubts");
        doubts.unshift({ id: Date.now().toString(), userId: user.id, type: "text", question, solution, createdAt: new Date() });

        await writeJson("users", users);
        await writeJson("doubts", doubts);
        res.json({ solution, user: publicUser(user) });
    } catch (err) { res.status(500).json({ message: "AI failed" }); }
});

// ==========================================
// 5. STATIC & FALLBACK
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
