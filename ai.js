const fs = require("fs");
const path = require("path");

async function solveTextDoubt(question) {
  const apiKey = process.env.GEMINI_API_KEY ? process.env.GEMINI_API_KEY.trim() : null;
  if (!apiKey) throw new Error("GEMINI_API_KEY missing in Render Settings!");

  // Stable V1 URL for Gemini 1.5 Flash
  const url = `https://generativelanguage.googleapis.com/v1/models/gemini-1.5-flash:generateContent?key=${apiKey}`;

  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{ parts: [{ text: "Solve this maths doubt step-by-step: " + question }] }]
    })
  });

  const data = await response.json();

  if (!response.ok) {
    console.error("Gemini Debug Error:", JSON.stringify(data));
    throw new Error(data.error?.message || "API Error");
  }

  return {
    solutionHindi: data.candidates[0].content.parts[0].text,
    finalAnswer: "Solved"
  };
}

async function solveImageDoubt(imagePath, mimeType, question = "") {
  const apiKey = process.env.GEMINI_API_KEY ? process.env.GEMINI_API_KEY.trim() : null;
  const url = `https://generativelanguage.googleapis.com/v1/models/gemini-1.5-flash:generateContent?key=${apiKey}`;
  
  const absolutePath = path.resolve(imagePath);
  const base64Image = fs.readFileSync(absolutePath, "base64");

  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{
        parts: [
          { text: "Solve this maths problem from the image: " + question },
          { inlineData: { mimeType, data: base64Image } }
        ]
      }]
    })
  });

  const data = await response.json();
  if (!response.ok) throw new Error(data.error?.message || "Image API Error");

  return {
    solutionHindi: data.candidates[0].content.parts[0].text,
    finalAnswer: "Solved"
  };
}

module.exports = { solveTextDoubt, solveImageDoubt };
