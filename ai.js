const fs = require("fs");
const path = require("path");
const { GoogleGenerativeAI } = require("@google/generative-ai");

function getClient() {
  const apiKey = process.env.GEMINI_API_KEY; 
  if (!apiKey) throw new Error("GEMINI_API_KEY missing in Render Settings");
  return new GoogleGenerativeAI(apiKey);
}

function mathsPrompt(question) {
  return `You are MATHS GURU, a kind bilingual maths tutor for Indian Class 1 to 12 students.
Solve the maths doubt below. Keep the language simple and student-friendly.

Return exactly these clearly separated sections:
QUESTION UNDERSTANDING:
FORMULA USED:
FORMULA KAISE USE HUA:
STEP-BY-STEP SOLUTION:
FINAL ANSWER:
HINDI EXPLANATION:
ENGLISH EXPLANATION:

Rules:
- If the question is unclear, state assumptions and still guide the student.
- Use Hindi and English. Hindi explanation must be in simple Hindi/Hinglish.
- Do not skip steps.
- For image doubts, first read the question from the image.

Student doubt: ${question || "Image question uploaded by student"}`;
}

function parseSolution(text) {
  const pick = (label) => {
    const escaped = label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const re = new RegExp(`${escaped}:\\s*([\\s\\S]*?)(?=\\n[A-Z -]+(?:KAISE USE HUA|UNDERSTANDING|USED|SOLUTION|ANSWER|EXPLANATION):|$)`, "i");
    const match = text.match(re);
    return match ? match[1].trim() : "";
  };
  return {
    raw: text,
    questionUnderstanding: pick("QUESTION UNDERSTANDING"),
    formulaUsed: pick("FORMULA USED"),
    formulaHowUsed: pick("FORMULA KAISE USE HUA"),
    steps: pick("STEP-BY-STEP SOLUTION"),
    finalAnswer: pick("FINAL ANSWER"),
    solutionHindi: pick("HINDI EXPLANATION"),
    solutionEnglish: pick("ENGLISH EXPLANATION")
  };
}

async function solveTextDoubt(question) {
  const genAI = getClient();
  // FIXED MODEL NAME HERE
  const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash-latest" });
  
  const result = await model.generateContent(mathsPrompt(question));
  const response = await result.response;
  return parseSolution(response.text());
}

async function solveImageDoubt(imagePath, mimeType, question = "") {
  const genAI = getClient();
  // FIXED MODEL NAME HERE
  const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash-latest" });

  const absolutePath = path.resolve(imagePath);
  const base64Image = fs.readFileSync(absolutePath, "base64");

  const result = await model.generateContent([
    { text: mathsPrompt(question) },
    {
      inlineData: {
        data: base64Image,
        mimeType: mimeType
      },
    },
  ]);
  
  const response = await result.response;
  return parseSolution(response.text());
}

module.exports = { solveTextDoubt, solveImageDoubt };
