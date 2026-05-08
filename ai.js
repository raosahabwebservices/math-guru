const fs = require("fs");
const path = require("path");

// ================================
// API KEYS
// ================================
const GROQ_KEY = process.env.GROQ_API_KEY;
const OPENROUTER_KEY = process.env.OPENROUTER_API_KEY;
const SAMBANOVA_KEY = process.env.SAMBANOVA_API_KEY;
const GEMINI_KEY = process.env.GEMINI_API_KEY;

// ================================
// PROMPT
// ================================
function buildPrompt(question) {
  return `
You are Maths Guru AI Ultimate Engine.

Solve step-by-step in Hindi + English.

Question:
${question}
`;
}

// ================================
// GROQ
// ================================
async function callGroq(prompt) {
  const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${GROQ_KEY}`
    },
    body: JSON.stringify({
      model: "llama3-8b-8192",
      messages: [{ role: "user", content: prompt }]
    })
  });

  const data = await res.json();
  if (!res.ok) throw new Error("Groq failed");

  return data.choices[0].message.content;
}

// ================================
// OPENROUTER
// ================================
async function callOpenRouter(prompt) {
  const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${OPENROUTER_KEY}`
    },
    body: JSON.stringify({
      model: "openai/gpt-4o-mini",
      messages: [{ role: "user", content: prompt }]
    })
  });

  const data = await res.json();
  if (!res.ok) throw new Error("OpenRouter failed");

  return data.choices[0].message.content;
}

// ================================
// SAMBANOVA
// ================================
async function callSambaNova(prompt) {
  const res = await fetch("https://api.sambanova.ai/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${SAMBANOVA_KEY}`
    },
    body: JSON.stringify({
      model: "default",
      messages: [{ role: "user", content: prompt }]
    })
  });

  const data = await res.json();
  if (!res.ok) throw new Error("SambaNova failed");

  return data.choices[0].message.content;
}

// ================================
// GEMINI
// ================================
async function callGemini(prompt) {
  const url = `https://generativelanguage.googleapis.com/v1/models/gemini-1.5-flash:generateContent?key=${GEMINI_KEY}`;

  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }]
    })
  });

  const data = await res.json();
  if (!res.ok) throw new Error("Gemini failed");

  return data.candidates[0].content.parts[0].text;
}

// ================================
// TEXT SOLVER (✔ FIXED)
// ================================
async function solveTextDoubt(question) {
  const prompt = buildPrompt(question);

  try {
    return await callGroq(prompt);
  } catch {
    try {
      return await callOpenRouter(prompt);
    } catch {
      try {
        return await callSambaNova(prompt);
      } catch {
        return await callGemini(prompt);
      }
    }
  }
}

// ================================
// IMAGE SOLVER (✔ FIXED)
// ================================
async function solveImageDoubt(imagePath, mimeType, question = "") {
  const base64Image = fs.readFileSync(path.resolve(imagePath), "base64");

  const prompt = buildPrompt(
    "Solve this image question: " + question
  );

  // Direct Gemini vision call
  const url = `https://generativelanguage.googleapis.com/v1/models/gemini-1.5-flash:generateContent?key=${GEMINI_KEY}`;

  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [
        {
          parts: [
            { text: prompt },
            { inlineData: { mimeType, data: base64Image } }
          ]
        }
      ]
    })
  });

  const data = await res.json();
  if (!res.ok) throw new Error("Image solve failed");

  return data.candidates[0].content.parts[0].text;
}

// ================================
// EXPORT (IMPORTANT FIX)
// ================================
module.exports = {
  solveTextDoubt,
  solveImageDoubt
};
