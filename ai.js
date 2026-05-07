const fs = require("fs");
const path = require("path");

// ================================
// COMMON GEMINI REQUEST FUNCTION
// ================================

async function callGeminiAPI(parts) {
  const apiKey = process.env.GEMINI_API_KEY
    ? process.env.GEMINI_API_KEY.trim()
    : null;

  if (!apiKey) {
    throw new Error("GEMINI_API_KEY missing in Render Environment Variables!");
  }

  // ✅ Latest Working Gemini Model
  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`;

  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      contents: [
        {
          role: "user",
          parts
        }
      ],
      generationConfig: {
        temperature: 0.7,
        topK: 40,
        topP: 0.95,
        maxOutputTokens: 2048
      }
    })
  });

  const data = await response.json();

  // DEBUG LOG
  console.log("Gemini Response:", JSON.stringify(data, null, 2));

  if (!response.ok) {
    console.error("Gemini API Error:", data);

    throw new Error(
      data?.error?.message || "Failed to get response from Gemini API"
    );
  }

  // SAFE RESPONSE CHECK
  const text =
    data?.candidates?.[0]?.content?.parts?.[0]?.text ||
    "No solution generated.";

  return {
    solutionHindi: text,
    finalAnswer: "Solved"
  };
}

// ================================
// TEXT DOUBT SOLVER
// ================================

async function solveTextDoubt(question) {
  if (!question || question.trim() === "") {
    throw new Error("Question is required");
  }

  const prompt = `
You are an expert maths teacher.

Solve the following maths problem step-by-step in simple Hindi + English language.

Instructions:
- Explain every step clearly
- Mention formula used
- Give final answer separately
- Use easy language for students
- If possible give shortcut trick also

Question:
${question}
`;

  return await callGeminiAPI([
    {
      text: prompt
    }
  ]);
}

// ================================
// IMAGE DOUBT SOLVER
// ================================

async function solveImageDoubt(imagePath, mimeType, question = "") {
  if (!fs.existsSync(imagePath)) {
    throw new Error("Image file not found");
  }

  const absolutePath = path.resolve(imagePath);

  const base64Image = fs.readFileSync(absolutePath, "base64");

  const prompt = `
You are an expert maths teacher.

Analyze the uploaded image carefully.

Solve the maths question step-by-step in simple Hindi + English.

Instructions:
- Detect the question from image
- Explain every step clearly
- Mention formulas
- Give final answer separately
- Use student-friendly language
- If possible give shortcut tricks

Extra user question:
${question}
`;

  return await callGeminiAPI([
    {
      text: prompt
    },
    {
      inlineData: {
        mimeType: mimeType,
        data: base64Image
      }
    }
  ]);
}

// ================================
// EXPORTS
// ================================

module.exports = {
  solveTextDoubt,
  solveImageDoubt
};
