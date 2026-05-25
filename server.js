// ==========================================
// 1. INITIALIZATION & IMPORTS
// ==========================================
require('dotenv').config();
const express = require('express');
const path = require('path');
const cors = require('cors');
const fsSync = require('fs'); 
const jwt = require('jsonwebtoken');
const multer = require('multer');
const mongoose = require('mongoose'); // ✅ MONGOOSE CONNECTED

// ✅ ASLI AI IMPORT (ai.js ko link kiya)
const { solveTextDoubt, solveImageDoubt } = require('./ai');

const app = express();
app.use(cors());
app.use(express.json());

const uploadDir = path.join(__dirname, 'uploads');
if (!fsSync.existsSync(uploadDir)) fsSync.mkdirSync(uploadDir, { recursive: true });

// ==========================================
// 1B. MONGODB DATABASE CONNECTION
// ==========================================
const mongoURI = process.env.MONGO_URI || "mongodb+srv://mathguru498_db_user:Harshit7880@cluster0.c9q0v1g.mongodb.net/mathsguru?retryWrites=true&w=majority&appName=Cluster0";

mongoose.connect(mongoURI)
  .then(() => console.log("🚀 Badhai ho! Maths Guru DB successfully connect ho gaya."))
  .catch(err => console.error("❌ Database connection fail:", err));

// ==========================================
// 1C. MONGODB SCHEMAS & MODELS (Dhancha) - FIXED!
// ==========================================
const userSchema = new mongoose.Schema({
    name: String,
    email: { type: String, unique: true, required: true },
    password: String, 
    premiumActive: { type: Boolean, default: false },
    textUsed: { type: Number, default: 0 },
    imageUsed: { type: Number, default: 0 },
    createdAt: { type: Date, default: Date.now }
});
const User = mongoose.model('User', userSchema);

const doubtSchema = new mongoose.Schema({
    userId: String,
    type: String,
    question: String,
    solution: mongoose.Schema.Types.Mixed, // ✅ String hata kar MIXED kar diya hai!
    imagePath: String,
    createdAt: { type: Date, default: Date.now }
});
const Doubt = mongoose.model('Doubt', doubtSchema);

const Payment = mongoose.model('Payment', new mongoose.Schema({ data: Object }, { strict: false }));
const Contact = mongoose.model('Contact', new mongoose.Schema({ data: Object }, { strict: false }));


// ==========================================
// 2. HELPERS
// ==========================================
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
    id: u._id.toString(), name: u.name, email: u.email, premiumActive: u.premiumActive,
    remainingText: (u.premiumActive ? 100 : 10) - (u.textUsed || 0),
    remainingImage: (u.premiumActive ? 100 : 3) - (u.imageUsed || 0)
});

// ==========================================
// 3. AUTH ROUTES
// ==========================================
app.post("/api/signup", async (req, res) => {
    try {
        const { name, email, password } = req.body;
        const existingUser = await User.findOne({ email });
        if (existingUser) return res.status(400).json({ message: "Email already exists" });
        
        const newUser = new User({ name, email, password, premiumActive: false, textUsed: 0, imageUsed: 0 });
        await newUser.save();
        
        res.json({ token: signToken({ id: newUser._id.toString() }), user: publicUser(newUser) });
    } catch (err) { res.status(500).json({ message: "Signup Failed" }); }
});

app.post("/api/login", async (req, res) => {
    try {
        const { email, password } = req.body;
        const user = await User.findOne({ email, password });
        if (!user) return res.status(401).json({ message: "Invalid Credentials" });
        res.json({ token: signToken({ id: user._id.toString() }), user: publicUser(user) });
    } catch (err) { res.status(500).json({ message: "Login Failed" }); }
});

app.get("/api/profile", requireAuth, async (req, res) => {
    try {
        const user = await User.findById(req.user.id);
        if (!user) return res.status(404).json({ message: "User not found" });
        res.json({ user: publicUser(user) });
    } catch (err) { res.status(500).json({ message: "Profile Error" }); }
});

// ==========================================
// 4. ASLI AI DOUBT ROUTES
// ==========================================
app.post("/api/doubt/text", requireAuth, async (req, res) => {
    try {
        const { question, language } = req.body;
        const user = await User.findById(req.user.id);
        if (!user) return res.status(404).json({ message: "User not found" });
        
        const solution = await solveTextDoubt(question, language || "Hinglish");

        user.textUsed = (user.textUsed || 0) + 1;
        await user.save();

        const doubt = new Doubt({ userId: user._id.toString(), type: "text", question, solution });
        await doubt.save();

        const mappedDoubt = { id: doubt._id.toString(), userId: doubt.userId, type: doubt.type, question, solution, createdAt: doubt.createdAt };
        res.json({ doubt: mappedDoubt, user: publicUser(user) });
    } catch (err) { res.status(500).json({ message: "AI Error: " + err.message }); }
});

app.post("/api/doubt/image", requireAuth, upload.single('image'), async (req, res) => {
    try {
        if (!req.file) return res.status(400).json({ message: "No image uploaded" });
        
        const { question, language } = req.body;
        const user = await User.findById(req.user.id);
        if (!user) return res.status(404).json({ message: "User not found" });

        const solution = await solveImageDoubt(req.file.path, req.file.mimetype, question, language);

        user.imageUsed = (user.imageUsed || 0) + 1;
        await user.save();

        const doubt = new Doubt({ userId: user._id.toString(), type: "image", imagePath: `/uploads/${req.file.filename}`, solution });
        await doubt.save();

        const mappedDoubt = { id: doubt._id.toString(), userId: doubt.userId, type: doubt.type, imagePath: doubt.imagePath, solution, createdAt: doubt.createdAt };
        res.json({ doubt: mappedDoubt, user: publicUser(user) });
    } catch (err) { res.status(500).json({ message: "Image AI Error" }); }
});

app.get("/api/doubts/history", requireAuth, async (req, res) => {
    try {
        const doubts = await Doubt.find({ userId: req.user.id }).sort({ createdAt: -1 });
        const mappedDoubts = doubts.map(d => ({
            id: d._id.toString(), userId: d.userId, type: d.type, question: d.question, solution: d.solution, imagePath: d.imagePath, createdAt: d.createdAt
        }));
        res.json({ doubts: mappedDoubts });
    } catch (err) { res.status(500).json({ message: "History Error" }); }
});

// ==========================================
// 5. ADMIN API ROUTES
// ==========================================
app.post("/api/admin/login", async (req, res) => {
    try {
        const { email, password } = req.body;
        if (email === process.env.ADMIN_EMAIL && password === process.env.ADMIN_PASSWORD) {
            const token = signToken({ id: "admin-root", role: "admin" });
            return res.json({ token, user: { id: "admin-root", name: "Super Admin", role: "admin" } });
        }
        res.status(401).json({ message: "Invalid Admin Credentials" });
    } catch (err) { res.status(500).json({ message: "Login Failed" }); }
});

app.get("/api/admin/dashboard", requireAuth, async (req, res) => {
    try {
        const totalUsers = await User.countDocuments();
        const totalDoubts = await Doubt.countDocuments();
        const premiumUsers = await User.countDocuments({ premiumActive: true });
        
        const users = await User.find().limit(50).sort({ createdAt: -1 });
        const doubts = await Doubt.find().limit(10).sort({ createdAt: -1 });
        
        const mappedUsers = users.map(u => ({
            id: u._id.toString(), name: u.name, email: u.email, premiumActive: u.premiumActive, textUsed: u.textUsed, imageUsed: u.imageUsed
        }));
        const mappedDoubts = doubts.map(d => ({
            id: d._id.toString(), userId: d.userId, type: d.type, question: d.question, solution: d.solution, imagePath: d.imagePath, createdAt: d.createdAt
        }));

        res.json({
            stats: { totalUsers, totalDoubts, premiumUsers },
            users: mappedUsers,
            recentDoubts: mappedDoubts
        });
    } catch (err) { res.status(500).json({ message: "Dashboard Error" }); }
});

app.post("/api/admin/activate/:id", requireAuth, async (req, res) => {
    try {
        const updatedUser = await User.findByIdAndUpdate(req.params.id, { premiumActive: true }, { new: true });
        if (updatedUser) return res.json({ message: "User activated successfully!" });
        res.status(404).json({ message: "User nahi mila" });
    } catch (e) { res.status(500).json({ message: "Server error" }); }
});

app.get("/api/admin/payments", requireAuth, async (req, res) => {
    try {
        const payments = await Payment.find();
        res.json({ payments: payments || [] });
    } catch (err) { res.status(500).json({ message: "Payments Error" }); }
});

app.get("/api/admin/contacts", requireAuth, async (req, res) => {
    try {
        const contacts = await Contact.find();
        res.json({ contacts: contacts || [] });
    } catch (err) { res.status(500).json({ message: "Contacts Error" }); }
});

// ==========================================
// 6. STATIC FILES & FALLBACK (SABSE NICHE)
// ==========================================
app.use(express.static(__dirname)); 
app.use('/uploads', express.static(uploadDir));

app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// Server Listen
const PORT = process.env.PORT || 3000;
app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server is LIVE on port ${PORT}`);
});
               
