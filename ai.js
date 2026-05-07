const fs = require("fs");
const path = require("path");

// --- DIRECT API CALL METHOD (NO LIBRARY) ---
async function callGeminiAPI(payload) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("GEMINI_API_KEY is missing in Render settings");

  // Humne version ko 'v1' kar diya hai jo sabse stable hai
  const url = `https://generativelanguage.googleapis.com/v1/models/gemini-1.5-flash:generateContent?key=${apiKey}`;

  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });

  const data = await response.json();

  if (!response.ok) {
    console.error("Gemini Error Details:", data);
    throw new Error(data.error?.message || "Gemini API failure");
  }

  return data.candidates[0].content.parts[0].text;
}

function mathsPrompt(question) {
  return `You are MATHS GURU, a kind bilingual maths tutor for Indian students. 
Solve this doubt clearly: ${question}

Return these sections:
QUESTION UNDERSTANDING:
FORMULA USED:
STEP-BY-STEP SOLUTION:
FINAL ANSWER:
HINDI EXPLANATION:
ENGLISH EXPLANATION:`;
}

function parseSolution(text) {
  const pick = (label) => {
    const re = new RegExp(`${label}:\\s*([\\s\\S]*?)(?=\\n[A-Z ]+:|$)`, "i");
    const match = text.match(re);
    return match ? match[1].trim() : "";
  };
  return {
    raw: text,
    solutionHindi: pick("HINDI EXPLANATION") || "Solution generated.",
    solutionEnglish: pick("ENGLISH EXPLANATION") || text,
    formulaUsed: pick("FORMULA USED") || "Standard Formula",
    steps: pick("STEP-BY-STEP SOLUTION") || text,
    finalAnswer: pick("FINAL ANSWER") || "See solution"
  };
}

async function solveTextDoubt(question) {
  const payload = {
    contents: [{ parts: [{ text: mathsPrompt(question) }] }]
  };
  const resultText = await callGeminiAPI(payload);
  return parseSolution(resultText);
}

async function solveImageDoubt(imagePath, mimeType, question = "") {
  const absolutePath = path.resolve(imagePath);
  const base64Image = fs.readFileSync(absolutePath, "base64");

  const payload = {
    contents: [{
      parts: [
        { text: mathsPrompt(question || "Solve the problem in this image") },
        { inlineData: { mimeType: mimeType, data: base64Image } }
      ]
    }]
  };
  const resultText = await callGeminiAPI(payload);
  return parseSolution(resultText);
}

module.exports = { solveTextDoubt, solveImageDoubt };
