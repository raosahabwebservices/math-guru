        // ... baaki saara code upar ka same rahega ...

// ✅ UPDATED TEXT DOUBT ROUTE
app.post("/api/doubt/text", requireAuth, async (req, res) => {
  try {
    // ⚡ Yahan language ko bhi body se nikal liya
    const { question, language } = req.body; 
    const users = await readJson("users");
    const user = users.find(u => u.id === req.user.id);
    if (!user) return res.status(404).json({ message: "User not found" });

    const limits = user.premiumActive ? 100 : 10;
    if ((user.textUsed || 0) >= limits) return res.status(402).json({ message: "Limit reached" });

    // ⚡ AI solve karega (Ab hum question ke saath language bhi bhej rahe hain)
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

// ✅ UPDATED IMAGE DOUBT ROUTE
app.post("/api/doubt/image", requireAuth, upload.single("image"), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ message: "Image required" });

    const users = await readJson("users");
    const user = users.find(u => u.id === req.user.id);
    if (!user) return res.status(404).json({ message: "User not found" });

    const limits = user.premiumActive ? 100 : 3;
    if ((user.imageUsed || 0) >= limits) return res.status(402).json({ message: "Limit reached" });

    // ⚡ Image solve karte waqt bhi language pass ki (req.body se)
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

// ... baaki niche ka code same ...
      
