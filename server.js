// ==========================================
// 1. MIDDLEWARES (Sabse upar rakhein)
// ==========================================
const path = require('path');
require('dotenv').config(); // Sabse pehle env load karein

app.use(cors());
app.use(express.json());

// ==========================================
// 2. ADMIN ROUTES
// ==========================================

// ✅ ADMIN LOGIN: Pehle .env check karega, fir admins.json
app.post("/api/admin/login", async (req, res) => {
  try {
    const { email, password } = req.body;

    // 1. Check from .env
    if (email === process.env.ADMIN_EMAIL && password === process.env.ADMIN_PASSWORD) {
      const token = signToken({ id: "admin-root", role: "admin" });
      return res.json({ 
        token, 
        user: { id: "admin-root", name: "Super Admin", email: process.env.ADMIN_EMAIL, role: "admin" } 
      });
    }

    // 2. Check from admins.json
    const admins = await readJson("admins");
    const admin = admins.find(a => a.email === email && a.password === password);

    if (!admin) {
      return res.status(401).json({ message: "Opps! Galat credentials hain." });
    }

    const token = signToken({ id: admin.id, role: 'admin' });
    res.json({ 
      token, 
      user: { id: admin.id, name: admin.name, email: admin.email, role: 'admin' } 
    });

  } catch (err) {
    console.error("Admin Login Error:", err);
    res.status(500).json({ message: "Admin Login Failed" });
  }
});

// ==========================================
// 3. DOUBT SOLVING ROUTES
// ==========================================

// ✅ TEXT DOUBT (With Language Support)
app.post("/api/doubt/text", requireAuth, async (req, res) => {
  try {
    const { question, language } = req.body; 
    const users = await readJson("users");
    const user = users.find(u => u.id === req.user.id);
    if (!user) return res.status(404).json({ message: "User not found" });

    const limits = user.premiumActive ? 100 : 10;
    if ((user.textUsed || 0) >= limits) return res.status(402).json({ message: "Limit reached" });

    const solution = await solveTextDoubt(question, language || "Hinglish");
    
    user.textUsed = (user.textUsed || 0) + 1;
    const doubts = await readJson("doubts");
    const doubt = {
        id: generateId(),
        userId: user.id,
        type: "text",
        question,
        solution,
        createdAt: new Date().toISOString()
    };
    doubts.unshift(doubt);
    
    await writeJson("users", users);
    await writeJson("doubts", doubts);
    res.json({ doubt, user: publicUser(user) });
  } catch (err) { 
    console.error(err);
    res.status(500).json({ message: "AI failed" }); 
  }
});

// ✅ IMAGE DOUBT (With Language Support)
app.post("/api/doubt/image", requireAuth, upload.single("image"), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ message: "Image required" });

    const users = await readJson("users");
    const user = users.find(u => u.id === req.user.id);
    if (!user) return res.status(404).json({ message: "User not found" });

    const limits = user.premiumActive ? 100 : 3;
    if ((user.imageUsed || 0) >= limits) return res.status(402).json({ message: "Limit reached" });

    const solution = await solveImageDoubt(
      path.join(uploadDir, req.file.filename),
      req.file.mimetype,
      req.body.question || "",
      req.body.language || "Hinglish" 
    );

    user.imageUsed = (user.imageUsed || 0) + 1;
    const doubts = await readJson("doubts");
    const doubt = {
        id: generateId(),
        userId: user.id,
        type: "image",
        imagePath: `/uploads/${req.file.filename}`,
        solution,
        createdAt: new Date().toISOString()
    };
    doubts.unshift(doubt);

    await writeJson("users", users);
    await writeJson("doubts", doubts);
    res.json({ doubt, user: publicUser(user) });
  } catch (err) { 
    console.error(err);
    res.status(500).json({ message: "AI failed" }); 
  }
});

// ==========================================
// 4. STATIC FILES & FALLBACK (Sabse Niche)
// ==========================================
app.use(express.static(path.join(__dirname, 'public')));
app.use('/uploads', express.static(uploadDir));

// Render/SPA support: Agar koi route na mile toh index bhej do
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});
