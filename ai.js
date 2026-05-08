const fs = require("fs");
const path = require("path");

const MODEL = "gemini-2.0-flash";

// ================================
// TEXT DOUBT SOLVER
// ================================
async function solveTextDoubt(question) {
  const apiKey = process.env.GEMINI_API_KEY?.trim();

  if (!apiKey) throw new Error("GEMINI_API_KEY missing in Render!");
  if (!question?.trim()) throw new Error("Question empty hai");

  const url =
    `https://generativelanguage.googleapis.com/v1/models/${MODEL}:generateContent?key=${apiKey}`;

  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      contents: [
        {
          parts: [
            {
              text:
                "You are MATHS GURU. Solve step-by-step in Hindi + English. Explain formula and final answer clearly.\n\nQuestion:\n" +
                question
            }
          ]
        }
      ]
    })
  });

  const data = await response.json();

  if (!response.ok) {
    console.error("Gemini Error:", data);
    throw new Error(data?.error?.message || "Text model failed");
  }

  const text =
    data?.candidates?.[0]?.content?.parts?.[0]?.text;

  if (!text) throw new Error("No response from Gemini");

  return {
    solutionHindi: text,
    solutionEnglish: text,
    formulaUsed: ""
  };
}

// ================================
// IMAGE DOUBT SOLVER
// ================================
async function solveImageDoubt(imagePath, mimeType, question = "") {
  const apiKey = process.env.GEMINI_API_KEY?.trim();

  if (!apiKey) throw new Error("GEMINI_API_KEY missing in Render!");
  if (!fs.existsSync(imagePath)) throw new Error("Image file not found");

  const base64Image = fs.readFileSync(
    path.resolve(imagePath),
    "base64"
  );

  const url =
    `https://generativelanguage.googleapis.com/v1/models/${MODEL}:generateContent?key=${apiKey}`;

  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      contents: [
        {
          parts: [
            {
              text:
                "You are MATHS GURU. Solve this image maths question step-by-step in Hindi + English.\n\nHint: " +
                question
            },
            {
              inlineData: {
                mimeType,
                data: base64Image
              }
            }
          ]
        }
      ]
    })
  });

  const data = await response.json();

  if (!response.ok) {
    console.error("Gemini Image Error:", data);
    throw new Error(data?.error?.message || "Image model failed");
  }

  const text =
    data?.candidates?.[0]?.content?.parts?.[0]?.text;

  if (!text) throw new Error("No response from image model");

  return {
    solutionHindi: text,
    solutionEnglish: text,
    formulaUsed: ""
  };
}

module.exports = {
  solveTextDoubt,
  solveImageDoubt
};
