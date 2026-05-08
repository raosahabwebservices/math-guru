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
// PROMPT BUILDER (MERGED CLEAN)
// ================================
function buildPrompt(question) {
  return `
You are Maths Guru AI Ultimate Engine, a premium multi-model mathematics tutor designed for maximum accuracy, speed, and student satisfaction.

MISSION:
Solve any maths question from Class 1 to 12 step-by-step in Hindi + English.

RULES:
- Clear steps
- Formula used
- Final answer
- Exam-ready format

CLASSIFICATION:
- Class 1–5: basic maths
- Class 6–8: intermediate
- Class 9–10: advanced
- Class 11–12: expert level

INSTRUCTIONS:
Always explain in simple language and show steps clearly.

Question:
${question}
`;
}

// ================================
// 1. GROQ
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
// 2. OPENROUTER
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
// 3. SAMBANOVA
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
// 4. GEMINI (FINAL)
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
// MAIN ROUTER (FINAL FLOW)
// ================================
async function solveMath(question) {
  if (!question?.trim()) {
    throw new Error("Question empty");
  }

  const prompt = buildPrompt(question);

  try {
    return await callGroq(prompt);
  } catch (e1) {
    console.log("Groq failed → OpenRouter");

    try {
      return await callOpenRouter(prompt);
    } catch (e2) {
      console.log("OpenRouter failed → SambaNova");

      try {
        return await callSambaNova(prompt);
      } catch (e3) {
        console.log("SambaNova failed → Gemini");

        return await callGemini(prompt);
      }
    }
  }
}

module.exports = { solveMath };
