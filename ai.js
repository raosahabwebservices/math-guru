const fs = require("fs");
const path = require("path");

const GROQ_KEY = process.env.GROQ_API_KEY;
const OPENROUTER_KEY = process.env.OPENROUTER_API_KEY;
const SAMBANOVA_KEY = process.env.SAMBANOVA_API_KEY;
const GEMINI_KEY = process.env.GEMINI_API_KEY;

// ================================
// 🔥 UPDATED STRICT PROMPT (FIXED)
// ================================
function buildPrompt(question) {
  return `
You are Maths Guru AI. Solve the following question step-by-step.

OUTPUT FORMAT MUST BE FOLLOWED EXACTLY. USE THESE HEADINGS:

Question Understanding: [Write a short summary of what the question is asking]

Formula Used: [List all math formulas used]

Step-by-step Solution:
[Write the full detailed calculation here]

Final Answer: [Write only the final result here]

Hindi Explanation: [Explain the logic in simple Hindi for the student]

Question: ${question}
`;
}

// ================================
// ⚡ OUTPUT ENFORCER
// ================================
function enforceOutput(text) {
  if (!text || !text.includes("Final Answer:")) {
    return text + "\n\nFinal Answer: Check calculation above.";
  }
  return text;
}

async function safeJson(res) {
  try { return await res.json(); } catch { return null; }
}

// ================================
// PROVIDERS (Keep as they are, just use the new prompt)
// ================================

async function callGroq(prompt) {
  const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${GROQ_KEY}` },
    body: JSON.stringify({ model: "llama3-8b-8192", messages: [{ role: "user", content: prompt }] }),
  });
  const data = await safeJson(res);
  if (!res.ok || !data?.choices?.[0]?.message?.content) throw new Error("Groq failed");
  return enforceOutput(data.choices[0].message.content);
}

async function callGeminiText(prompt) {
  // ✅ FIX: Use v1beta for better stability with Flash
  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${GEMINI_KEY}`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] }),
  });
  const data = await safeJson(res);
  if (!res.ok || !data?.candidates?.[0]?.content?.parts?.[0]?.text) throw new Error("Gemini failed");
  return enforceOutput(data.candidates[0].content.parts[0].text);
}

// (Yahan OpenRouter aur SambaNova ke calls tumhare purane wale hi rahenge, bas prompt naya jayega)

// ================================
// TEXT & IMAGE SOLVERS
// ================================

async function solveTextDoubt(question) {
  const prompt = buildPrompt(question);
  // Pehle Gemini try karenge (Best quality), fir dusre
  const providers = [callGeminiText, callGroq]; 
  
  let lastError;
  for (const fn of providers) {
    try { return await fn(prompt); } catch (e) { lastError = e.message; }
  }
  return `AI FAILED: ${lastError}`;
}

async function solveImageDoubt(imagePath, mimeType, question = "") {
  const base64Image = fs.readFileSync(path.resolve(imagePath), "base64");
  const prompt = buildPrompt("Solve the math problem in this image: " + question);

  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${GEMINI_KEY}`;

  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }, { inlineData: { mimeType, data: base64Image } }] }],
    }),
  });

  const data = await safeJson(res);
  if (!res.ok || !data?.candidates?.[0]?.content?.parts?.[0]?.text) {
    return "Image AI failed. Try clearer image.";
  }

  return enforceOutput(data.candidates[0].content.parts[0].text);
}

module.exports = { solveTextDoubt, solveImageDoubt };
