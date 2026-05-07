const fs = require("fs");
const path = require("path");

async function callGemini(payload) {
  const apiKey = process.env.GEMINI_API_KEY ? process.env.GEMINI_API_KEY.trim() : null;
  if (!apiKey) throw new Error("GEMINI_API_KEY missing in Render!");

  // Hum 2 alag-alag raste try karenge, koi toh khula hoga!
  const versions = [
    "https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent",
    "https://generativelanguage.googleapis.com/v1/models/gemini-1.5-flash:generateContent"
  ];

  let lastError;
  for (let baseUrl of versions) {
    try {
      const response = await fetch(`${baseUrl}?key=${apiKey}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });

      const data = await response.json();
      if (response.ok) return data.candidates[0].content.parts[0].text;
      
      lastError = data.error?.message || "Unknown API Error";
    } catch (err) {
      lastError = err.message;
    }
  }
  
  throw new Error("Sare Models Fail Ho Gaye: " + lastError);
}

async function solveTextDoubt(question) {
  const payload = { contents: [{ parts: [{ text: "Solve this maths doubt step-by-step: " + question }] }] };
  const text = await callGemini(payload);
  return { solutionHindi: text };
}

async function solveImageDoubt(imagePath, mimeType, question = "") {
  const absolutePath = path.resolve(imagePath);
  const base64Image = fs.readFileSync(absolutePath, "base64");
  const payload = {
    contents: [{
      parts: [
        { text: "Solve this maths image problem: " + question },
        { inlineData: { mimeType, data: base64Image } }
      ]
    }]
  };
  const text = await callGemini(payload);
  return { solutionHindi: text };
}

module.exports = { solveTextDoubt, solveImageDoubt };
