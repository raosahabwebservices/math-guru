require("dotenv").config();

const fs = require("fs").promises;

const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;
const OPENROUTER_MODEL = process.env.OPENROUTER_MODEL || "openai/gpt-4o-mini";

if (!OPENROUTER_API_KEY) {
  console.warn("Warning: OPENROUTER_API_KEY missing in .env");
}

async function callAI(prompt, imageDataOptional = null) {
  if (!OPENROUTER_API_KEY) {
    throw new Error("OPENROUTER_API_KEY missing in .env");
  }

  const content = [{ type: "text", text: prompt }];

  if (imageDataOptional) {
    content.push({
      type: "image_url",
      image_url: { url: imageDataOptional }
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
            "You are Math Guru, an expert maths teacher for Class 1 to 12 students. Follow the requested format strictly. If JSON is requested, return only valid JSON."
        },
        {
          role: "user",
          content
        }
      ],
      temperature: 0.2
    })
  });

  let data;

  try {
    data = await response.json();
  } catch {
    throw new Error("AI API returned invalid response");
  }

  if (!response.ok) {
    throw new Error(data?.error?.message || "AI API request failed");
  }

  return data?.choices?.[0]?.message?.content || "";
}

async function imageFileToDataUrl(imagePath, mimeType) {
  const imageBuffer = await fs.readFile(imagePath);
  const base64 = imageBuffer.toString("base64");
  return `data:${mimeType};base64,${base64}`;
}

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

async function solveTextDoubt(question, language = "Hinglish") {
  return await solveDoubt({ question, language });
}

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

async function generateMathTest({
  classLevel,
  subject = "Mathematics",
  topic,
  difficulty = "Medium",
  numQuestions = 5,
  questionType = "Mixed",
  language = "Hinglish"
}) {
  const finalNumQuestions = Number(numQuestions) || 5;

  let typeInstruction = "";

  if (questionType === "MCQ") {
    typeInstruction = `
STRICT QUESTION TYPE RULE:
- Generate ONLY MCQ questions.
- Every question must have exactly 4 options.
- options must be an array of exactly 4 strings.
- correctAnswer must exactly match one option.
`;
  } else if (questionType === "Very Short") {
    typeInstruction = `
STRICT QUESTION TYPE RULE:
- Generate ONLY Very Short answer questions.
- Do NOT generate MCQ.
- options must be [] for every question.
- correctAnswer must be only final answer in 1 line.
`;
  } else if (questionType === "Short") {
    typeInstruction = `
STRICT QUESTION TYPE RULE:
- Generate ONLY Short answer questions.
- Do NOT generate MCQ.
- options must be [] for every question.
- correctAnswer must be only final answer in 1 to 3 lines.
`;
  } else if (questionType === "Long") {
    typeInstruction = `
STRICT QUESTION TYPE RULE:
- Generate ONLY Long answer questions.
- Do NOT generate MCQ.
- options must be [] for every question.
- correctAnswer must be only final result / final answer.
`;
  } else {
    typeInstruction = `
STRICT QUESTION TYPE RULE:
- Generate Mixed questions.
- Include both MCQ and written answer questions.
- MCQ questions must have exactly 4 options.
- Written questions must have options as [].
`;
  }

  const prompt = `
Create a maths test for Math Guru.

Class: ${classLevel}
Subject: ${subject}
Chapter/Topic: ${topic}
Difficulty: ${difficulty}
Question Type Selected By User: ${questionType}
Number of Questions: ${finalNumQuestions}
Language: ${language}

${typeInstruction}

Return ONLY valid JSON.
Do not use markdown.
Do not write anything outside JSON.

JSON format must be exactly:

{
  "title": "Test title",
  "classLevel": ${classLevel},
  "subject": "${subject}",
  "topic": "${topic}",
  "difficulty": "${difficulty}",
  "marksPerQuestion": 1,
  "totalMarks": ${finalNumQuestions},
  "questions": [
    {
      "type": "${questionType}",
      "question": "Question text",
      "options": [],
      "correctAnswer": "Only final answer here",
      "stepByStepSolution": ""
    }
  ],
  "answerKey": [
    {
      "questionNumber": 1,
      "answer": "Only final answer here"
    }
  ]
}

VERY STRICT RULES:
- Generate exactly ${finalNumQuestions} questions.
- Follow selected question type strictly: ${questionType}.
- If selected type is MCQ, options must have exactly 4 options.
- If selected type is Very Short, Short or Long, options must be [].
- Do not put step-by-step solution.
- stepByStepSolution must always be "".
- correctAnswer must contain ONLY the final answer.
- Questions must match Class ${classLevel}.
- Difficulty must be ${difficulty}.
- Use simple ${language}.
`;

  const aiText = await callAI(prompt);
  const parsed = safeJsonParse(aiText);

  let questions = Array.isArray(parsed.questions) ? parsed.questions : [];

  if (questions.length === 0) {
    throw new Error("AI did not return valid questions");
  }

  questions = questions.slice(0, finalNumQuestions).map((q, index) => {
    let finalType = questionType === "Mixed" ? String(q.type || "Short").trim() : questionType;
    let options = Array.isArray(q.options) ? q.options.map(String) : [];
    let correctAnswer = String(q.correctAnswer || "").trim();

    if (
      questionType === "Very Short" ||
      questionType === "Short" ||
      questionType === "Long"
    ) {
      finalType = questionType;
      options = [];
    }

    if (questionType === "MCQ") {
      finalType = "MCQ";
      options = normalizeMcqOptions(options, correctAnswer);

      if (!options.includes(correctAnswer)) {
        correctAnswer = options[0];
      }
    }

    if (questionType === "Mixed") {
      const isActuallyMCQ =
        finalType === "MCQ" &&
        Array.isArray(options) &&
        options.length > 0;

      if (isActuallyMCQ) {
        finalType = "MCQ";
        options = normalizeMcqOptions(options, correctAnswer);

        if (!options.includes(correctAnswer)) {
          correctAnswer = options[0];
        }
      } else {
        if (!["Very Short", "Short", "Long"].includes(finalType)) {
          finalType = "Short";
        }

        options = [];
      }
    }

    return {
      type: finalType,
      question: String(q.question || `Question ${index + 1}`).trim(),
      options,
      correctAnswer,
      stepByStepSolution: ""
    };
  });

  while (questions.length < finalNumQuestions) {
    const n = questions.length + 1;

    if (questionType === "MCQ") {
      questions.push({
        type: "MCQ",
        question: `Question ${n}: ${topic} se related ek simple question solve karein.`,
        options: ["Option A", "Option B", "Option C", "Option D"],
        correctAnswer: "Option A",
        stepByStepSolution: ""
      });
    } else {
      questions.push({
        type: questionType === "Mixed" ? "Short" : questionType,
        question: `Question ${n}: ${topic} se related ek answer likhein.`,
        options: [],
        correctAnswer: "Answer may vary. Match with concept.",
        stepByStepSolution: ""
      });
    }
  }

  const marksPerQuestion = Number(parsed.marksPerQuestion || 1);
  const totalMarks = marksPerQuestion * questions.length;

  return {
    title: parsed.title || `Class ${classLevel} ${topic} Test`,
    classLevel,
    subject,
    topic,
    difficulty,
    marksPerQuestion,
    totalMarks,
    questions,
    answerKey: questions.map((q, index) => ({
      questionNumber: index + 1,
      answer: q.correctAnswer
    }))
  };
}

function normalizeMcqOptions(options, correctAnswer) {
  let cleanOptions = Array.isArray(options)
    ? options.map((o) => String(o || "").trim()).filter(Boolean)
    : [];

  const cleanCorrect = String(correctAnswer || "").trim();

  if (cleanCorrect && !cleanOptions.includes(cleanCorrect)) {
    cleanOptions.unshift(cleanCorrect);
  }

  cleanOptions = [...new Set(cleanOptions)].slice(0, 4);

  while (cleanOptions.length < 4) {
    cleanOptions.push(`Option ${String.fromCharCode(65 + cleanOptions.length)}`);
  }

  return cleanOptions.slice(0, 4);
}

function safeJsonParse(text) {
  try {
    return JSON.parse(text);
  } catch {
    const match = String(text || "").match(/\{[\s\S]*\}/);

    if (!match) {
      throw new Error("AI response was not valid JSON");
    }

    try {
      return JSON.parse(match[0]);
    } catch {
      throw new Error("AI JSON parse failed");
    }
  }
}

module.exports = {
  callAI,
  solveDoubt,
  solveTextDoubt,
  solveImageDoubt,
  generateMathTest
};
