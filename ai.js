const fs = require("fs");
const path = require("path");

async function solveTextDoubt(question) {
  const apiKey = process.env.GEMINI_API_KEY ? process.env.GEMINI_API_KEY.trim() : null;
  if (!apiKey) throw new Error("GEMINI_API_KEY missing in Render!");

  // Pro model har account par chalta hai
  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent?key=${apiKey}`;

  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{ parts: [{ text: "You are MATHS GURU. Solve this: " + question }] }]
    })
  });

  const data = await response.json();
  if (!response.ok) {
    console.error("Gemini Error:", JSON.stringify(data));
    throw new Error(data.error?.message || "Model Not Found");
  }

  return { solutionHindi: data.candidates[0].content.parts[0].text };
}

async function solveImageDoubt(imagePath, mimeType, question = "") {
  const apiKey = process.env.GEMINI_API_KEY ? process.env.GEMINI_API_KEY.trim() : null;
  // Image ke liye Pro-Vision use hota hai
  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-pro-vision:generateContent?key=${apiKey}`;
  
  const absolutePath = path.resolve(imagePath);
  const base64Image = fs.readFileSync(absolutePath, "base64");

  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{
        parts: [
          { text: "Solve this maths image: " + question },
          { inlineData: { mimeType, data: base64Image } }
        ]
      }]
    })
  });

  const data = await response.json();
  if (!response.ok) throw new Error(data.error?.message || "Image Model Error");

  return { solutionHindi: data.candidates[0].content.parts[0].text };
}

module.exports = { solveTextDoubt, solveImageDoubt };
