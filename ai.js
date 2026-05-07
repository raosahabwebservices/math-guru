const fs = require("fs");
const path = require("path");

// ================================
// TEXT DOUBT SOLVER
// ================================
async function solveTextDoubt(question) {
  const apiKey = process.env.GEMINI_API_KEY?.trim();
  if (!apiKey) throw new Error("GEMINI_API_KEY missing in Render!");

  if (!question || question.trim() === "") {
    throw new Error("Question empty hai");
  }

  const url = `https://generativelanguage.googleapis.com/v1/models/gemini-1.5-flash:generateContent?key=${apiKey}`;

  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [
        {
          parts: [
            {
              text:
                "You are MATHS GURU. Solve step-by-step in Hindi + English.\n" +
                "Explain formula and final answer clearly.\n\nQuestion:\n" +
                question
            }
          ]
        }
      ]
    })
  });

  const data = await response.json();

  const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;

  if (!response.ok) {
    console.error("Gemini Error:", data);
    throw new Error(data?.error?.message || "Text model failed");
  }

  if (!text) {
    throw new Error("No response from Gemini");
  }

  return { solutionHindi: text };
}

// ================================
// IMAGE DOUBT SOLVER
// ================================
async function solveImageDoubt(imagePath, mimeType, question = "") {
  const apiKey = process.env.GEMINI_API_KEY?.trim();
  if (!apiKey) throw new Error("GEMINI_API_KEY missing in Render!");

  if (!fs.existsSync(imagePath)) {
    throw new Error("Image file not found");
  }

  const url = `https://generativelanguage.googleapis.com/v1/models/gemini-1.5-flash:generateContent?key=${apiKey}`;

  const absolutePath = path.resolve(imagePath);
  const base64Image = fs.readFileSync(absolutePath, "base64");

  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [
        {
          parts: [
            {
              text:
                "You are MATHS GURU. Solve this image step-by-step in Hindi + English.\n\nHint: " +
                question
            },
            {
              inlineData: {
                mimeType: mimeType,
                data: base64Image
              }
            }
          ]
        }
      ]
    })
  });

  const data = await response.json();

  const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;

  if (!response.ok) {
    console.error("Gemini Image Error:", data);
    throw new Error(data?.error?.message || "Image model failed");
  }

  if (!text) {
    throw new Error("No response from image model");
  }

  return { solutionHindi: text };
}

module.exports = {
  solveTextDoubt,
  solveImageDoubt
};
