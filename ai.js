const fs = require("fs");
const path = require("path");
const OpenAI = require("openai");

function getClient() {
  if (!process.env.OPENAI_API_KEY) throw new Error("OPENAI_API_KEY missing");
  return new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
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
  const client = getClient();
  const response = await client.responses.create({
    model: process.env.OPENAI_MODEL || "gpt-4.1-mini",
    input: [{ role: "user", content: [{ type: "input_text", text: mathsPrompt(question) }] }],
    temperature: 0.2
  });
  return parseSolution(response.output_text || "");
}

async function solveImageDoubt(imagePath, mimeType, question = "") {
  const client = getClient();
  const absolutePath = path.resolve(imagePath);
  const base64Image = fs.readFileSync(absolutePath, "base64");
  const response = await client.responses.create({
    model: process.env.OPENAI_MODEL || "gpt-4.1-mini",
    input: [{
      role: "user",
      content: [
        { type: "input_text", text: mathsPrompt(question) },
        { type: "input_image", image_url: `data:${mimeType};base64,${base64Image}`, detail: "high" }
      ]
    }],
    temperature: 0.2
  });
  return parseSolution(response.output_text || "");
}

module.exports = { solveTextDoubt, solveImageDoubt };