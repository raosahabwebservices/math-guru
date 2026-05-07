const fs = require("fs");
const path = require("path");

async function callGemini(parts) {
  const apiKey = process.env.GEMINI_API_KEY?.trim();

  if (!apiKey) throw new Error("API Key missing");

  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash-latest:generateContent?key=${apiKey}`;

  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{ parts }]
    })
  });

  const data = await res.json();

  if (!res.ok) {
    console.log("ERROR:", data);
    throw new Error(data?.error?.message || "API Error");
  }

  return data?.candidates?.[0]?.content?.parts?.[0]?.text || "No response";
}

// TEXT
async function solveTextDoubt(question) {
  const prompt = `
Solve step by step in Hindi + English:
Question: ${question}
`;

  const result = await callGemini([{ text: prompt }]);

  return {
    solutionHindi: result,
    finalAnswer: "Solved"
  };
}

// IMAGE
async function solveImageDoubt(imagePath, mimeType, question = "") {
  const base64Image = fs.readFileSync(path.resolve(imagePath), "base64");

  const prompt = `
Solve maths from image step-by-step in Hindi + English.
Extra question: ${question}
`;

  const result = await callGemini([
    { text: prompt },
    { inlineData: { mimeType, data: base64Image } }
  ]);

  return {
    solutionHindi: result,
    finalAnswer: "Solved"
  };
}

module.exports = { solveTextDoubt, solveImageDoubt };
