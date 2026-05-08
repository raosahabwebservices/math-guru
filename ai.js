  const fs = require("fs");
const path = require("path");

// Free-tier friendly model priority
const MODELS = [
  "gemini-1.5-flash-latest",
  "gemini-1.5-flash-8b",
  "gemini-1.5-pro-latest"
];

// ================================
// COMMON REQUEST FUNCTION
// ================================
async function callGemini(contents) {
  const apiKey = process.env.GEMINI_API_KEY?.trim();

  if (!apiKey) {
    throw new Error("GEMINI_API_KEY missing in Render!");
  }

  let lastError = "All models failed";

  for (const MODEL of MODELS) {
    try {
      const url =
        `https://generativelanguage.googleapis.com/v1/models/${MODEL}:generateContent?key=${apiKey}`;

      const response = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ contents })
      });

      const data = await response.json();

      if (!response.ok) {
        console.error(`Gemini Error (${MODEL}):`, data);
        lastError =
          data?.error?.message ||
          `Request failed on ${MODEL}`;
        continue;
      }

      const text =
        data?.candidates?.[0]?.content?.parts?.[0]?.text;

      if (text) return text;

      lastError = `No response from ${MODEL}`;
    } catch (err) {
      console.error(`Fetch Error (${MODEL}):`, err);
      lastError = err.message;
    }
  }

  throw new Error(lastError);
}

// ================================
// TEXT DOUBT SOLVER
// ================================
async function solveTextDoubt(question) {
  if (!question?.trim()) {
    throw new Error("Question empty hai");
  }

  const text = await callGemini([
    {
      parts: [
        {
          text:
            "You are MATHS GURU. Solve step-by-step in Hindi + English. Explain formula and final answer clearly.\n\nQuestion:\n" +
            question
        }
      ]
    }
  ]);

  return {
    solutionHindi: text,
    solutionEnglish: text,
    formulaUsed: ""
  };
}

// ================================
// IMAGE DOUBT SOLVER
// ================================
async function solveImageDoubt(
  imagePath,
  mimeType,
  question = ""
) {
  if (!fs.existsSync(imagePath)) {
    throw new Error("Image file not found");
  }

  const base64Image = fs.readFileSync(
    path.resolve(imagePath),
    "base64"
  );

  const text = await callGemini([
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
  ]);

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
