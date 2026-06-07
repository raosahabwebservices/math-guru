// ==========================================
// 1. INITIALIZATION & IMPORTS
// ==========================================
require('dotenv').config();
const express = require('express');
const path = require('path');
const cors = require('cors');
const fsSync = require('fs'); 
const multer = require('multer');
const { createClient } = require('@supabase/supabase-js');

// ✅ ASLI AI IMPORT (Tumhari purani local ai.js file)
const { solveTextDoubt, solveImageDoubt, generateCustomTest } = require('./ai');

const app = express();
app.use(cors());
app.use(express.json());

const uploadDir = path.join(__dirname, 'uploads');
if (!fsSync.existsSync(uploadDir)) fsSync.mkdirSync(uploadDir, { recursive: true });

// ==========================================
// 2. SUPABASE CLOUD CONNECTION
// ==========================================
const SUPABASE_URL = "https://twukpvtqwuhbubtcnwdt.supabase.co";
// Pro-Tip: Env variable me dalo ya direct apni vahi anon public key use karo
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || "Sb_publishable_NXG8cBn1aQja3pdWJDGxXg_MnDyixL6";
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || "Sb_publishable_NXG8cBn1aQja3pdWJDGxXg_MnDyixL6";

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
console.log("🚀 Badhai ho! Maths Guru Backend successfully Supabase Cloud se connect ho gaya.");

// ==========================================
// 3. AUTH MIDDLEWARE (Supabase Token JWT Validator)
// ==========================================
const requireAuth = async (req, res, next) => {
    const authHeader = req.headers.authorization;
    if (!authHeader) return res.status(401).json({ message: "No token provided" });
    
    const token = authHeader.split(' ')[1];
    try {
        // Direct Supabase security layer se user session verify karo
        const { data: { user }, error } = await supabase.auth.getUser(token);
        if (error || !user) return res.status(403).json({ message: "Invalid or expired token" });
        
        req.user = user;
        next();
    } catch (err) {
        return res.status(500).json({ message: "Auth validation crash" });
    }
};

const upload = multer({ dest: uploadDir });

// User Profile Bits Mapping Helper (Backward Compatibility Layer)
const mapPublicUser = (profile) => ({
    id: profile.id,
    name: profile.name,
    email: profile.email,
    premiumActive: profile.premium_active,
    remainingText: (profile.premium_active ? 100 : 10) + (profile.text_limit_bonus || 0) - (profile.text_used || 0),
    remainingImage: (profile.premium_active ? 100 : 3) - (profile.image_used || 0)
});

// ==========================================
// 4. ASLI AI DOUBT ROUTES (Direct Database Sync)
// ==========================================
app.post("/api/doubt/text", requireAuth, async (req, res) => {
    try {
        const { question, language } = req.body;
        
        // 1. Live profile read karo
        const { data: profile, error: pErr } = await supabase.from('users').select('*').eq('id', req.user.id).single();
        if (pErr || !profile) return res.status(404).json({ message: "User profile row missing" });

        // 2. Call AI logic
        const solution = await solveTextDoubt(question, language || "Hinglish");

        // 3. Increment counters on Supabase
        const updatedTextUsed = (profile.text_used || 0) + 1;
        await supabase.from('users').update({ text_used: updatedTextUsed }).eq('id', req.user.id);
        profile.text_used = updatedTextUsed;

        // 4. Insert doubt item row into 'doubts' table
        const { data: doubtData, error: dErr } = await supabase.from('doubts').insert([{
            user_id: req.user.id,
            type: "text",
            question: question,
            solution: solution
        }]).select().single();

        if (dErr) throw dErr;

        res.json({ 
            doubt: { id: doubtData.id, userId: doubtData.user_id, type: doubtData.type, question, solution, createdAt: doubtData.created_at }, 
            user: mapPublicUser(profile) 
        });
    } catch (err) { res.status(500).json({ message: "AI Error: " + err.message }); }
});

app.post("/api/doubt/image", requireAuth, upload.single('image'), async (req, res) => {
    try {
        if (!req.file) return res.status(400).json({ message: "No image uploaded" });
        const { question, language } = req.body;

        const { data: profile, error: pErr } = await supabase.from('users').select('*').eq('id', req.user.id).single();
        if (pErr || !profile) return res.status(404).json({ message: "User profile missing" });

        // Call image AI handler
        const solution = await solveImageDoubt(req.file.path, req.file.mimetype, question, language);

        const updatedImageUsed = (profile.image_used || 0) + 1;
        await supabase.from('users').update({ image_used: updatedImageUsed }).eq('id', req.user.id);
        profile.image_used = updatedImageUsed;

        const imageRelativePath = `/uploads/${req.file.filename}`;
        const { data: doubtData, error: dErr } = await supabase.from('doubts').insert([{
            user_id: req.user.id,
            type: "image",
            question: question || "Image doubt",
            solution: solution,
            image_path: imageRelativePath
        }]).select().single();

        if (dErr) throw dErr;

        res.json({ 
            doubt: { id: doubtData.id, userId: doubtData.user_id, type: doubtData.type, imagePath: imageRelativePath, solution, createdAt: doubtData.created_at }, 
            user: mapPublicUser(profile) 
        });
    } catch (err) { res.status(500).json({ message: "Image AI Error: " + err.message }); }
});

// ==========================================
// ⚡ NEW ROUTES: APNA TEST BANAO (JSON FIX)
// ==========================================
app.post("/api/test/generate", requireAuth, async (req, res) => {
    try {
        const { classLevel, chapter, topic, difficulty, questionType, numQuestions, language } = req.body;
        const finalTopic = topic || chapter || "General Questions";

        // Call the core AI generator
        const generatedQuestions = await generateCustomTest({
            classLevel, chapter, topic: finalTopic, difficulty, questionType, numQuestions, language
        });

        // Save generated metadata in Postgres 'tests' table
        const { data: testData, error: tErr } = await supabase.from('tests').insert([{
            user_id: req.user.id,
            class_level: classLevel,
            chapter: chapter,
            difficulty: difficulty,
            question_type: questionType,
            language: language,
            questions: generatedQuestions
        }]).select().single();

        if (tErr) throw tErr;

        // Clean JSON formatting direct send check (Loop killer)
        res.setHeader('Content-Type', 'application/json');
        res.json({ 
            message: "🚀 Test ban gaya.", 
            testId: testData.id.toString(), 
            questions: generatedQuestions 
        });
    } catch (err) { 
        res.status(500).json({ message: "Test Generation Failed: " + err.message }); 
    }
});

app.post("/api/test/submit/:id", requireAuth, async (req, res) => {
    try {
        const { score, timeTaken } = req.body;
        const { data: updatedTest, error } = await supabase
            .from('tests')
            .update({ score: score, time_taken: timeTaken })
            .eq('id', req.params.id)
            .select()
            .single();

        if (error) throw error;
        res.json({ message: "🎯 Score saved successfully!", test: updatedTest });
    } catch (err) { res.status(500).json({ message: "Submission failed: " + err.message }); }
});

// ==========================================
// 5. STATIC FILES & FALLBACK CONTROL
// ==========================================
app.use(express.static(__dirname)); 
app.use('/uploads', express.static(uploadDir));

app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// Server Listen
const PORT = process.env.PORT || 3000;
app.listen(PORT, "0.0.0.0", () => {
    console.log(`AI Engine Middleware Server is LIVE on port ${PORT}`);
});
                                                                     
