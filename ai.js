require("dotenv").config();

const fs = require("fs").promises;

const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;
const OPENROUTER_MODEL = process.env.OPENROUTER_MODEL || "openai/gpt-4o-mini";

if (!OPENROUTER_API_KEY) {
  console.warn("Warning: OPENROUTER_API_KEY missing in .env");
}

// ==========================================
// 1. REUSABLE AI FUNCTION
// Same function for doubt solver + test generator
// ==========================================
async function callAI(prompt, imageDataOptional = null) {
  if (!OPENROUTER_API_KEY) {
    throw new Error("OPENROUTER_API_KEY missing in .env");
  }

  const content = [
    {
      type: "text",
      text: prompt
    }
  ];

  if (imageDataOptional) {
    content.push({
      type: "image_url",
      image_url: {
        url: imageDataOptional
      }
    });
  }

  const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${OPENROUTER_API_KEY}`,
      "Content-Type": "application/json",
      "HTTP-Referer": process.env.APP_URL || "https://math-guru.onrender.com",
      "X-Title": "Math Guru"
    },
    body: JSON.stringify({
      model: OPENROUTER_MODEL,
      messages: [
        {
          role: "system",
          content:
            "You are Math Guru, an expert maths teacher for Class 1 to 12 students. Give accurate step-by-step solutions in simple Hindi, English or Hinglish."
        },
        {
          role: "user",
          content
        }
      ],
      temperature: 0.3
    })
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data?.error?.message || "AI API request failed");
  }

  return data?.choices?.[0]?.message?.content || "";
}

// ==========================================
// 2. IMAGE TO BASE64 DATA URL
// ==========================================
async function imageFileToDataUrl(imagePath, mimeType) {
  const imageBuffer = await fs.readFile(imagePath);
  const base64 = imageBuffer.toString("base64");

  return `data:${mimeType};base64,${base64}`;
}

// ==========================================
// 3. COMMON DOUBT SOLVER
// ==========================================
async function solveDoubt({
  question,
  language = "Hinglish",
  imagePath = null,
  mimeType = null
}) {
  let imageData = null;

  if (imagePath && mimeType) {
    imageData = await imageFileToDataUrl(imagePath, mimeType);
  }

  const prompt = `
Solve this maths doubt for a Class 1 to 12 student.

Student question:
${question}

Language:
${language}

Give answer in this exact format:

1. Problem Understanding
Explain what the question is asking.

2. Formula Used
Write formula used. If no formula, write "No special formula needed".

3. Step-by-Step Solution
Solve slowly and clearly.

4. Simple Explanation
Explain in simple Hindi + English / Hinglish.

5. Final Answer
Write final answer separately.

Rules:
- Do not skip steps.
- Do not give only final answer.
- Keep language simple.
- If image is provided, read the maths question from image and solve it.
`;

  return await callAI(prompt, imageData);
}

// ==========================================
// 4. TEXT DOUBT WRAPPER
// server.js ko ye function chahiye
// ==========================================
async function solveTextDoubt(question, language = "Hinglish") {
  return await solveDoubt({
    question,
    language
  });
}

// ==========================================
// 5. IMAGE DOUBT WRAPPER
// server.js ko ye function chahiye
// ==========================================
async function solveImageDoubt(
  imagePath,
  mimeType,
  question = "Solve this maths question from image.",
  language = "Hinglish"
) {
  return await solveDoubt({
    question,
    language,
    imagePath,
    mimeType
  });
}

// ==========================================
// 6. TEST GENERATOR
// ==========================================
async function generateMathTest({
  classLevel,
  subject = "Mathematics",
  topic,
  difficulty = "Medium",
  numQuestions = 5,
  questionType = "Mixed",
  language = "Hinglish"
}) {
  const prompt = `
Create a maths test for Math Guru.

Requirements:
- Class: ${classLevel}
- Subject: ${subject}
- Chapter/Topic: ${topic}
- Difficulty: ${difficulty}
- Question Type: ${questionType}
- Number of Questions: ${numQuestions}
- Language: ${language}

Return ONLY valid JSON.
Do not use markdown.
Do not write explanation outside JSON.

JSON format must be exactly:

{
  "title": "Test title here",
  "classLevel": ${classLevel},
  "subject": "${subject}",
  "topic": "${topic}",
  "difficulty": "${difficulty}",
  "marksPerQuestion": 1,
  "totalMarks": ${numQuestions},
  "questions": [
    {
      "type": "MCQ",
      "question": "Question text",
      "options": ["Option A", "Option B", "Option C", "Option D"],
      "correctAnswer": "Option A",
      "stepByStepSolution": "Full step by step solution"
    }
  ],
  "answerKey": [
    {
      "questionNumber": 1,
      "answer": "Option A"
    }
  ]
}

Rules:
- Generate exactly ${numQuestions} questions.
- If question type is MCQ, every question must have 4 options.
- If question type is Very Short, Short or Long, options must be [].
- If question type is Mixed, mix MCQ and written questions.
- correctAnswer must be clear.
- For MCQ, correctAnswer must exactly match one option.
- Questions must be suitable for Class ${classLevel}.
- Use simple ${language}.
- Keep answers accurate.
`;

  const aiText = await callAI(prompt);
  const parsed = safeJsonParse(aiText);

  const questions = Array.isArray(parsed.questions) ? parsed.questions : [];

  if (questions.length === 0) {
    throw new Error("AI did not return valid questions");
  }

  const finalQuestions = questions.slice(0, Number(numQuestions)).map((q, index) => {
    const options = Array.isArray(q.options) ? q.options : [];

    return {
      type: q.type || questionType || "Mixed",
      question: q.question || `Question ${index + 1}`,
      options,
      correctAnswer: q.correctAnswer || "",
      stepByStepSolution: q.stepByStepSolution || ""
    };
  });

  const marksPerQuestion = Number(parsed.marksPerQuestion || 1);
  const totalMarks = marksPerQuestion * finalQuestions.length;

  return {
    title: parsed.title || `Class ${classLevel} ${topic} Test`,
    classLevel,
    subject,
    topic,
    difficulty,
    marksPerQuestion,
    totalMarks,
    questions: finalQuestions,
    answerKey: finalQuestions.map((q, index) => ({
      questionNumber: index + 1,
      answer: q.correctAnswer
    }))
  };
}

// ==========================================
// 7. SAFE JSON PARSER
// ==========================================
function safeJsonParse(text) {
  try {
    return JSON.parse(text);
  } catch (err) {
    const match = text.match(/\{[\s\S]*\}/);

    if (!match) {
      throw new Error("AI response was not valid JSON");
    }

    try {
      return JSON.parse(match[0]);
    } catch (err2) {
      throw new Error("AI JSON parse failed");
    }
  }
}

// ==========================================
// 8. EXPORTS
// server.js ke import ke according
// ==========================================
module.exports = {
  callAI,
  solveDoubt,
  solveTextDoubt,
  solveImageDoubt,
  generateMathTest
};
