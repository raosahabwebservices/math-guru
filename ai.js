const fs = require("fs");
const path = require("path");

async function callGemini(payload) {
  const apiKey = process.env.GEMINI_API_KEY;
  
  // Hum 3 alag-alag raste try karenge taaki koi toh chale!
  const endpoints = [
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`,
    `https://generativelanguage.googleapis.com/v1/models/gemini-1.5-flash:generateContent?key=${apiKey}`,
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent?key=${apiKey}`
  ];

  let lastError;
  for (let url of endpoints) {
    try {
      const response = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      const data = await response.json();
      if (response.ok) return data.candidates[0].content.parts[0].text;
      lastError = data.error?.message || "API Error";
    } catch (err) {
      lastError = err.message;
    }
  }
  throw new Error("Sare raste band hain: " + lastError);
}

function parseSolution(text) {
  return {
    raw: text,
    solutionHindi: text,
    solutionEnglish: text,
    formulaUsed: "AI Generated",
    steps: text,
    finalAnswer: "Solved"
  };
}

async function solveTextDoubt(question) {
  const payload = { contents: [{ parts: [{ text: "Solve this maths doubt: " + question }] }] };
  const result = await callGemini(payload);
  return parseSolution(result);
}

async function solveImageDoubt(imagePath, mimeType, question = "") {
  const base64Image = fs.readFileSync(path.resolve(imagePath), "base64");
  const payload = {
    contents: [{
      parts: [
        { text: "Solve this maths image doubt: " + question },
        { inlineData: { mimeType, data: base64Image } }
      ]
    }]
  };
  const result = await callGemini(payload);
  return parseSolution(result);
}

module.exports = { solveTextDoubt, solveImageDoubt };
