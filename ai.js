const fs = require("fs");
const path = require("path");

async function solveTextDoubt(question) {
  // 1. Key check karein
  const apiKey = process.env.GEMINI_API_KEY ? process.env.GEMINI_API_KEY.trim() : null;
  
  if (!apiKey) {
    throw new Error("Render settings mein GEMINI_API_KEY nahi mili!");
  }

  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`;

  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{ parts: [{ text: "Solve this maths doubt: " + question }] }]
    })
  });

  const data = await response.json();

  if (!response.ok) {
    // Agar error aata hai toh console mein print hoga
    console.error("Gemini Error Details:", JSON.stringify(data));
    throw new Error(data.error?.message || "Invalid API Key or Permission");
  }

  return {
    solutionHindi: data.candidates[0].content.parts[0].text,
    finalAnswer: "Solved"
  };
}

async function solveImageDoubt(imagePath, mimeType, question = "") {
  const apiKey = process.env.GEMINI_API_KEY ? process.env.GEMINI_API_KEY.trim() : null;
  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`;
  
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
  if (!response.ok) throw new Error(data.error?.message || "Image API Error");

  return {
    solutionHindi: data.candidates[0].content.parts[0].text,
    finalAnswer: "Solved"
  };
}

module.exports = { solveTextDoubt, solveImageDoubt };
