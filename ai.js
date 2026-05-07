const fs = require("fs"); // 'c' chhota kar diya
const path = require("path");

async function callGemini(payload) {
  const apiKey = process.env.GEMINI_API_KEY;
  
  // Flash 1.5 sabse stable hai AI Studio keys ke liye
  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`;

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
    
    const data = await response.json();
    
    if (response.ok && data.candidates && data.candidates[0]) {
      return data.candidates[0].content.parts[0].text;
    } else {
      throw new Error(data.error?.message || "Gemini API Error");
    }
  } catch (err) {
    console.error("Gemini Error:", err.message);
    throw err;
  }
}

function parseSolution(text) {
  return {
    raw: text,
    solutionHindi: text,
    solutionEnglish: text,
    formulaUsed: "Gemini AI",
    steps: text,
    finalAnswer: "Solved"
  };
}

async function solveTextDoubt(question) {
  const payload = { contents: [{ parts: [{ text: "Solve this maths doubt step by step: " + question }] }] };
  const result = await callGemini(payload);
  return parseSolution(result);
}

async function solveImageDoubt(imagePath, mimeType, question = "") {
  const absolutePath = path.resolve(imagePath);
  const base64Image = fs.readFileSync(absolutePath, "base64");
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
