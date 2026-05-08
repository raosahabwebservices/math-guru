// =========================
// ADMIN ROUTES
// =========================

// ✅ ADMIN LOGIN ROUTE (Fixed for .env & JSON)
app.post("/api/admin/login", async (req, res) => {
  try {
    const { email, password } = req.body;

    // 1. Pehle .env variables se check karein (Fastest way)
    if (email === process.env.ADMIN_EMAIL && password === process.env.ADMIN_PASSWORD) {
      const token = signToken({ id: "admin-root", role: "admin" });
      return res.json({ 
        token, 
        user: { id: "admin-root", name: "Super Admin", email: process.env.ADMIN_EMAIL, role: "admin" } 
      });
    }

    // 2. Phir admins.json file check karein
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

// =========================
// DOUBT SOLVING ROUTES
// =========================

// ✅ UPDATED TEXT DOUBT ROUTE (With Language Support)
app.post("/api/doubt/text", requireAuth, async (req, res) => {
  try {
    const { question, language } = req.body; 
    const users = await readJson("users");
    const user = users.find(u => u.id === req.user.id);
    if (!user) return res.status(404).json({ message: "User not found" });

    const limits = user.premiumActive ? 100 : 10;
    if ((user.textUsed || 0) >= limits) return res.status(402).json({ message: "Limit reached" });

    // AI solve karega (question + language)
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

// ✅ UPDATED IMAGE DOUBT ROUTE (With Language Support)
app.post("/api/doubt/image", requireAuth, upload.single("image"), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ message: "Image required" });

    const users = await readJson("users");
    const user = users.find(u => u.id === req.user.id);
    if (!user) return res.status(404).json({ message: "User not found" });

    const limits = user.premiumActive ? 100 : 3;
    if ((user.imageUsed || 0) >= limits) return res.status(402).json({ message: "Limit reached" });

    // AI image solve karega (image + language)
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
