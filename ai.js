require("dotenv").config();

const fs = require("fs").promises;

// ==========================================
// API KEYS + MODELS
// ==========================================

const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;
const OPENROUTER_MODEL = process.env.OPENROUTER_MODEL || "openai/gpt-4o-mini";

const GROQ_API_KEY = process.env.GROQ_API_KEY;
const GROQ_MODEL = process.env.GROQ_MODEL || "llama-3.3-70b-versatile";

const SAMBANOVA_API_KEY = process.env.SAMBANOVA_API_KEY;
const SAMBANOVA_MODEL =
  process.env.SAMBANOVA_MODEL || "Meta-Llama-3.1-8B-Instruct";

if (!OPENROUTER_API_KEY) console.warn("Warning: OPENROUTER_API_KEY missing");
if (!GROQ_API_KEY) console.warn("Warning: GROQ_API_KEY missing");
if (!SAMBANOVA_API_KEY) console.warn("Warning: SAMBANOVA_API_KEY missing");

// ==========================================
// SYSTEM PROMPT — EASY HINGLISH + ACCURACY
// ==========================================

const SYSTEM_PROMPT = `
You are Math Guru, a very accurate and very simple Class 1 to 12 mathematics teacher.

MAIN GOAL:
Give correct, clean, mobile-friendly maths answers in very easy language.

LANGUAGE STYLE:
- If language is Hinglish, explain in simple Hinglish.
- Use short sentences.
- Explain like the student is weak in maths.
- Do not make the answer too technical.
- Do not use long paragraphs.

ACCURACY RULES:
1. Read the question carefully.
2. Copy all given values correctly.
3. Identify what is asked.
4. Choose the correct formula.
5. Solve step by step.
6. Re-check signs, brackets, powers, roots, fractions, and units.
7. Do not guess missing values.
8. If image/question is unclear, say:
   "Question clear nahi hai. Please clearer image upload karein ya question type karein."
9. Never give confident wrong answer.
10. If multiple meanings are possible, mention the assumption clearly.

MATH FORMAT RULES:
- Do NOT use LaTeX.
- Do NOT use \\frac, \\sqrt, \\theta, \\left, \\right.
- Do NOT use markdown tables.
- Use plain readable text only.
- Write fractions like 2/3.
- Write square root like sqrt(18), and also simplify like sqrt(18) = 3sqrt(2).
- Write power like x^2.
- Write multiplication as × only when needed.
- Write cross product as a1 × a2.
- Write dot product as dot product.
- If using symbols like | |, ×, dot product, explain their meaning in simple words.
- Keep output clean for mobile screen.

FOR MATHS DOUBT, ALWAYS USE THIS EXACT FORMAT:

1. Question Meaning
Explain in very simple words what the question is asking.

2. Given Values
Write all given values clearly.
If no numerical values are given, write:
"No numerical values given."

3. Formula / Concept
Write the formula or concept.
Also explain symbols in simple words.
Example:
| | means magnitude / positive value.
dot product means multiply and add.
cross product means vector product.

4. Step-by-Step Solution
Solve slowly.
Use small steps.
Do not skip important calculation.

5. Self-Check
Check the formula and calculation.
If direct checking is not possible, write:
"Direct self-check not possible, but formula and calculation have been rechecked."

6. Final Answer
Write final answer separately and clearly.

7. Easy Explanation
Explain the full answer in very easy language.

IMPORTANT:
- Do not write unnecessary theory.
- Do not make the answer too long.
- Keep each section short, clean and exam-friendly.
- Final Answer must be easy to see.

FOR TEST GENERATION:
Return only valid JSON when JSON is requested.
No markdown.
No explanation outside JSON.
No trailing commas.
No comments inside JSON.
Every question and answer must be mathematically valid.
`;

// ==========================================
// MAIN AI CALL — FALLBACK SYSTEM
// ==========================================

async function callAI(prompt, imageDataOptional = null) {
  const errors = [];

  // Image doubt: only OpenRouter supports image input here.
  if (imageDataOptional) {
    if (!OPENROUTER_API_KEY) {
      throw new Error("Image AI failed: OPENROUTER_API_KEY missing");
    }

    try {
      const answer = await callOpenRouter(prompt, imageDataOptional);

      if (answer && String(answer).trim()) {
        return answer;
      }

      throw new Error("OpenRouter returned empty image response");
    } catch (err) {
      throw new Error("Image AI failed: OpenRouter: " + err.message);
    }
  }

  const providers = [
    {
      name: "OpenRouter",
      enabled: Boolean(OPENROUTER_API_KEY),
      fn: () => callOpenRouter(prompt)
    },
    {
      name: "Groq",
      enabled: Boolean(GROQ_API_KEY),
      fn: () => callGroq(prompt)
    },
    {
      name: "SambaNova",
      enabled: Boolean(SAMBANOVA_API_KEY),
      fn: () => callSambaNova(prompt)
    }
  ];

  for (const provider of providers) {
    if (!provider.enabled) {
      errors.push(`${provider.name}: API key missing`);
      continue;
    }

    try {
      const answer = await provider.fn();

      if (answer && String(answer).trim()) {
        return answer;
      }

      errors.push(`${provider.name}: empty response`);
    } catch (err) {
      errors.push(`${provider.name}: ${err.message}`);
    }
  }

  throw new Error("All AI providers failed: " + errors.join(" | "));
}

// ==========================================
// OPENROUTER
// ==========================================

async function callOpenRouter(prompt, imageDataOptional = null) {
  const userContent = [{ type: "text", text: prompt }];

  if (imageDataOptional) {
    userContent.push({
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
          content: SYSTEM_PROMPT
        },
        {
          role: "user",
          content: userContent
        }
      ],
      temperature: 0.1
    })
  });

  const data = await safeResponseJson(response, "OpenRouter");

  if (!response.ok) {
    const openRouterMsg =
      data?.error?.message ||
      data?.message ||
      "OpenRouter request failed";

    const lowerMsg = String(openRouterMsg).toLowerCase();

    if (lowerMsg.includes("user not found")) {
      throw new Error(
        "OpenRouter API key invalid hai. Render Environment me OPENROUTER_API_KEY nayi key se update karo."
      );
    }

    if (lowerMsg.includes("no auth") || lowerMsg.includes("unauthorized")) {
      throw new Error(
        "OpenRouter API key missing/invalid hai. Render Environment me OPENROUTER_API_KEY check karo."
      );
    }

    if (lowerMsg.includes("credit") || lowerMsg.includes("insufficient")) {
      throw new Error(
        "OpenRouter credits/balance issue hai. OpenRouter account me credits check karo."
      );
    }

    throw new Error(openRouterMsg);
  }

  return data?.choices?.[0]?.message?.content || "";
}

// ==========================================
// GROQ
// ==========================================

async function callGroq(prompt) {
  const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${GROQ_API_KEY}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      model: GROQ_MODEL,
      messages: [
        {
          role: "system",
          content: SYSTEM_PROMPT
        },
        {
          role: "user",
          content: prompt
        }
      ],
      temperature: 0.1
    })
  });

  const data = await safeResponseJson(response, "Groq");

  if (!response.ok) {
    throw new Error(data?.error?.message || "Groq request failed");
  }

  return data?.choices?.[0]?.message?.content || "";
}

// ==========================================
// SAMBANOVA
// ==========================================

async function callSambaNova(prompt) {
  const response = await fetch("https://api.sambanova.ai/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${SAMBANOVA_API_KEY}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      model: SAMBANOVA_MODEL,
      messages: [
        {
          role: "system",
          content: SYSTEM_PROMPT
        },
        {
          role: "user",
          content: prompt
        }
      ],
      temperature: 0.1
    })
  });

  const data = await safeResponseJson(response, "SambaNova");

  if (!response.ok) {
    throw new Error(data?.error?.message || "SambaNova request failed");
  }

  return data?.choices?.[0]?.message?.content || "";
}

// ==========================================
// IMAGE HELPERS
// ==========================================

async function imageFileToDataUrl(imagePath, mimeType) {
  const imageBuffer = await fs.readFile(imagePath);
  const base64 = imageBuffer.toString("base64");
  return `data:${mimeType};base64,${base64}`;
}

// ==========================================
// DOUBT SOLVER
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
Solve this maths doubt with maximum accuracy.

Student question:
${question}

Language:
${language}

IMPORTANT:
Before final answer, internally re-check:
- Given values copied correctly?
- Correct formula used?
- Signs, brackets, powers, roots, fractions correct?
- Arithmetic correct?
- Image text readable?

If image/question is unclear:
Do not guess.
Write:
"Question clear nahi hai. Please clearer image upload karein ya question type karein."

Use this format only:

1. Question Meaning
Explain what is being asked in very simple words.

2. Given Values
Write all given values clearly.

3. Formula / Concept
Write formula.
Explain symbols in simple words.

4. Step-by-Step Solution
Solve in small clean steps.

5. Self-Check
Check formula and calculation.

6. Final Answer
Write final answer clearly.

7. Easy Explanation
Explain in very easy ${language}.

Strict rules:
- No LaTeX.
- No markdown table.
- No fake values.
- No guessing.
- Keep answer short, clean and mobile-friendly.
`;

  return await callAI(prompt, imageData);
}

async function solveTextDoubt(question, language = "Hinglish") {
  return await solveDoubt({
    question,
    language
  });
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
// ==========================================
// TEST GENERATOR — HIGH ACCURACY JSON OUTPUT
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
  const finalNumQuestions = Number(numQuestions) || 5;

  let typeInstruction = "";

  if (questionType === "MCQ") {
    typeInstruction = `
STRICT QUESTION TYPE RULE:
- Generate ONLY MCQ questions.
- Every question must have exactly 4 options.
- options must be an array of exactly 4 strings.
- correctAnswer must exactly match one option.
- Only one option should be correct.
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
- MCQ questions must have only one correct option.
`;
  }

  const prompt = `
Create a maths test for Math Guru with maximum accuracy.

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
Do not add explanation outside JSON.
Do not add comments inside JSON.
Do not add trailing commas.

JSON format must be exactly:

{
  "title": "Test title",
  "classLevel": "${classLevel}",
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

QUALITY RULES:
- Generate exactly ${finalNumQuestions} questions.
- Every question must be mathematically correct.
- Every correctAnswer must be verified.
- Do not create ambiguous questions.
- Do not create questions with missing values.
- For MCQ, only one option should be correct.
- Wrong options should be realistic but clearly incorrect.
- Questions must match Class ${classLevel} level.
- Do not make questions too advanced for the class.
- Difficulty must be ${difficulty}.
- Use simple ${language}.
- Follow selected question type strictly: ${questionType}.
- If selected type is MCQ, options must have exactly 4 options.
- If selected type is Very Short, Short or Long, options must be [].
- Do not put step-by-step solution.
- stepByStepSolution must always be "".
- correctAnswer must contain ONLY the final answer.
- answerKey must match correctAnswer exactly.
- Return valid JSON only.
`;

  const aiText = await callAI(prompt);
  const parsed = safeJsonParse(aiText);

  let questions = Array.isArray(parsed.questions) ? parsed.questions : [];

  if (questions.length === 0) {
    throw new Error("AI did not return valid questions");
  }

  questions = questions.slice(0, finalNumQuestions).map((q, index) => {
    let finalType =
      questionType === "Mixed" ? String(q.type || "Short").trim() : questionType;

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

// ==========================================
// UTILS
// ==========================================

function normalizeMcqOptions(options, correctAnswer) {
  let cleanOptions = Array.isArray(options)
    ? options.map((o) => String(o || "").trim()).filter(Boolean)
    : [];

  const cleanCorrect = String(correctAnswer || "").trim();

  if (cleanCorrect && !cleanOptions.includes(cleanCorrect)) {
    cleanOptions.unshift(cleanCorrect);
  }

  cleanOptions = [...new Set(cleanOptions)];

  while (cleanOptions.length < 4) {
    cleanOptions.push(`Option ${cleanOptions.length + 1}`);
  }

  return cleanOptions.slice(0, 4);
}

function safeJsonParse(text) {
  try {
    let clean = String(text || "").trim();

    clean = clean
      .replace(/^```json/i, "")
      .replace(/^```/i, "")
      .replace(/```$/i, "")
      .trim();

    const firstBrace = clean.indexOf("{");
    const lastBrace = clean.lastIndexOf("}");

    if (firstBrace !== -1 && lastBrace !== -1) {
      clean = clean.slice(firstBrace, lastBrace + 1);
    }

    return JSON.parse(clean);
  } catch (err) {
    console.error("JSON Parse Error:", err.message);
    console.error("AI Raw Text:", text);

    return {
      title: "Generated Test",
      questions: [],
      answerKey: []
    };
  }
}

async function safeResponseJson(response, providerName) {
  try {
    const text = await response.text();

    if (!text) {
      return {};
    }

    try {
      return JSON.parse(text);
    } catch (err) {
      return {
        error: {
          message: `${providerName} returned non-JSON response: ${text.slice(0, 300)}`
        }
      };
    }
  } catch (err) {
    return {
      error: {
        message: `${providerName} response read failed: ${err.message}`
      }
    };
  }
}

// ==========================================
// EXPORTS
// ==========================================

module.exports = {
  callAI,
  solveDoubt,
  solveTextDoubt,
  solveImageDoubt,
  generateMathTest
};
