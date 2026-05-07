const fs = require("fs");
const path = require("path");

async function solveTextDoubt(question) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("GEMINI_API_KEY missing");

  // Hum seedha V1 API use karenge, koi beta-veta ka chakkar nahi
  const url = `https://generativelanguage.googleapis.com/v1/models/gemini-1.5-flash:generateContent?key=${apiKey}`;

  const prompt = `You are MATHS GURU, a kind bilingual maths tutor. Solve this: ${question}
  
Return these sections clearly:
QUESTION UNDERSTANDING:
FORMULA USED:
STEP-BY-STEP SOLUTION:
FINAL ANSWER:
HINDI EXPLANATION:
ENGLISH EXPLANATION:`;

  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }]
    })
  });

  const data = await response.json();
  if (!response.ok) throw new Error(data.error?.message || "Gemini API Error");

  const text = data.candidates[0].content.parts[0].text;
  return parseSolution(text);
}

async function solveImageDoubt(imagePath, mimeType, question = "") {
  const apiKey = process.env.GEMINI_API_KEY;
  const url = `https://generativelanguage.googleapis.com/v1/models/gemini-1.5-flash:generateContent?key=${apiKey}`;

  const base64Image = fs.readFileSync(path.resolve(imagePath), "base64");

  const body = {
    contents: [{
      parts: [
        { text: `You are MATHS GURU. Solve this image question: ${question}` },
        { inlineData: { mimeType, data: base64Image } }
      ]
    }]
  };

  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body)
  });

  const data = await response.json();
  if (!response.ok) throw new Error(data.error?.message || "Gemini Image Error");

  const text = data.candidates[0].content.parts[0].text;
  return parseSolution(text);
}

function parseSolution(text) {
  const pick = (label) => {
    const re = new RegExp(`${label}:\\s*([\\s\\S]*?)(?=\\n[A-Z ]+:|$)`, "i");
    const match = text.match(re);
    return match ? match[1].trim() : "";
  };
  return {
    raw: text,
    solutionHindi: pick("HINDI EXPLANATION") || text,
    solutionEnglish: pick("ENGLISH EXPLANATION"),
    formulaUsed: pick("FORMULA USED"),
    steps: pick("STEP-BY-STEP SOLUTION"),
    finalAnswer: pick("FINAL ANSWER")
  };
}

module.exports = { solveTextDoubt, solveImageDoubt };
