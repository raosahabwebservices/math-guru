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
// PROMPT BUILDER
// ================================
function buildPrompt(question) {
  return `
You are Maths Guru AI Ultimate Engine for Class 1–12.

RULES:
- Solve step-by-step
- Use Hindi + English explanation
- Show formula clearly
- Final Answer MUST be included

OUTPUT FORMAT:
Final Answer (MANDATORY): exact result only

Question:
${question}
`;
}

// ================================
// SAFE FETCH WRAPPER
// ================================
async function safeJson(res) {
  try {
    return await res.json();
  } catch {
    return null;
  }
}

// ================================
// GROQ
// ================================
async function callGroq(prompt) {
  const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${GROQ_KEY}`,
    },
    body: JSON.stringify({
      model: "llama3-8b-8192",
      messages: [{ role: "user", content: prompt }],
    }),
  });

  const data = await safeJson(res);

  if (!res.ok || !data?.choices?.[0]?.message?.content) {
    throw new Error("Groq failed");
  }

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
      Authorization: `Bearer ${OPENROUTER_KEY}`,
    },
    body: JSON.stringify({
      model: "openai/gpt-4o-mini",
      messages: [{ role: "user", content: prompt }],
    }),
  });

  const data = await safeJson(res);

  if (!res.ok || !data?.choices?.[0]?.message?.content) {
    throw new Error("OpenRouter failed");
  }

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
      Authorization: `Bearer ${SAMBANOVA_KEY}`,
    },
    body: JSON.stringify({
      model: "default",
      messages: [{ role: "user", content: prompt }],
    }),
  });

  const data = await safeJson(res);

  if (!res.ok || !data?.choices?.[0]?.message?.content) {
    throw new Error("SambaNova failed");
  }

  return data.choices[0].message.content;
}

// ================================
// GEMINI TEXT
// ================================
async function callGeminiText(prompt) {
  const url = `https://generativelanguage.googleapis.com/v1/models/gemini-1.5-flash:generateContent?key=${GEMINI_KEY}`;

  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
    }),
  });

  const data = await safeJson(res);

  if (!res.ok || !data?.candidates?.[0]?.content?.parts?.[0]?.text) {
    throw new Error("Gemini failed");
  }

  return data.candidates[0].content.parts[0].text;
}

// ================================
// TEXT SOLVER (FIXED EXPORT ISSUE)
// ================================
async function solveTextDoubt(question) {
  const prompt = buildPrompt(question);

  const providers = [
    callGroq,
    callOpenRouter,
    callSambaNova,
    callGeminiText,
  ];

  let lastError;

  for (const fn of providers) {
    try {
      return await fn(prompt);
    } catch (e) {
      lastError = e.message;
    }
  }

  return `AI FAILED: ${lastError}`;
}

// ================================
// IMAGE SOLVER (FIXED + SAFE VISION)
// ================================
async function solveImageDoubt(imagePath, mimeType, question = "") {
  const base64Image = fs.readFileSync(
    path.resolve(imagePath),
    "base64"
  );

  const prompt = buildPrompt("Solve image question: " + question);

  async function callGeminiVision(p) {
    const url = `https://generativelanguage.googleapis.com/v1/models/gemini-1.5-flash:generateContent?key=${GEMINI_KEY}`;

    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [
          {
            parts: [
              { text: p },
              {
                inlineData: {
                  mimeType,
                  data: base64Image,
                },
              },
            ],
          },
        ],
      }),
    });

    const data = await safeJson(res);

    if (!res.ok || !data?.candidates?.[0]?.content?.parts?.[0]?.text) {
      throw new Error("Gemini vision failed");
    }

    return data.candidates[0].content.parts[0].text;
  }

  const providers = [
    callGroq,
    callOpenRouter,
    callSambaNova,
    callGeminiVision,
  ];

  let lastError;

  for (const fn of providers) {
    try {
      return await fn(prompt);
    } catch (e) {
      lastError = e.message;
    }
  }

  return `AI FAILED: ${lastError}`;
}

// ================================
// FIXED EXPORT (MOST IMPORTANT BUG FIX)
// ================================
module.exports = {
  solveTextDoubt,
  solveImageDoubt,
};
