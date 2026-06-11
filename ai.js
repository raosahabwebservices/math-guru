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
const SAMBANOVA_MODEL = process.env.SAMBANOVA_MODEL || "Meta-Llama-3.1-8B-Instruct";

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const GEMINI_MODEL = process.env.GEMINI_MODEL || "gemini-1.5-flash";

if (!OPENROUTER_API_KEY) console.warn("Warning: OPENROUTER_API_KEY missing");
if (!GROQ_API_KEY) console.warn("Warning: GROQ_API_KEY missing");
if (!SAMBANOVA_API_KEY) console.warn("Warning: SAMBANOVA_API_KEY missing");
if (!GEMINI_API_KEY) console.warn("Warning: GEMINI_API_KEY missing");

// ==========================================
// STRONG SYSTEM PROMPT FOR HIGH ACCURACY
// ==========================================

const SYSTEM_PROMPT = `
You are Math Guru, a highly accurate Class 1 to 12 mathematics teacher.

Your main goal:
Give the most correct answer possible, not the fastest answer.

Accuracy rules:
1. Read the question carefully before solving.
2. Identify the class level and topic if possible.
3. Choose the correct formula.
4. Do calculation step-by-step.
5. Re-check every arithmetic step before final answer.
6. Verify the final answer by substitution, reverse-check, unit-check, or logic-check whenever possible.
7. If the question is unclear or image text is not readable, do not guess. Ask the student to upload a clearer image or type the question.
8. If multiple interpretations are possible, mention the assumption clearly.
9. Do not hallucinate numbers, diagrams, values, options, or missing information.
10. Never give a confident wrong answer.
11. If you are not sure, clearly say what is uncertain.
12. For calculation-based maths, re-check signs, powers, brackets, fractions, and units.
13. For word problems, identify given values, required value, and formula before solving.
14. For geometry, do not assume diagram values unless clearly given.
15. For trigonometry, clearly mention angle unit if needed.
16. For algebra, check the final answer by substitution wherever possible.
17. For probability/statistics, clearly define total cases and favourable cases.
18. For test generation, every question and answer must be mathematically valid.

Formatting rules:
- Do NOT use LaTeX.
- Do NOT use \\frac, \\sqrt, \\theta, \\cos^{-1}, \\left, \\right.
- Use plain readable text only.
- Write fractions like 2/3.
- Write square root like sqrt(22).
- Write power like x^2.
- Write theta as theta.
- Write inverse cosine as cos inverse.
- Keep answer clean for mobile screen.
- Use simple Hindi + English / Hinglish if language is Hinglish.
- Final answer must be separate.
- Do not use markdown tables.

For maths doubt:
Use this exact format:

1. Question Meaning
Explain what the question is asking in very simple words.

2. Given Values
List all given values clearly.
If values are missing, say clearly.

3. Formula / Concept
Write the correct formula or concept in plain text.

4. Step-by-Step Solution
Solve slowly and clearly.
Do not skip important calculation steps.

5. Self-Check
Check the answer using substitution, reverse method, unit check, or logic check.
If self-check is not possible, write:
"Direct self-check not possible, but formula and calculation have been rechecked."

6. Final Answer
Write the final answer clearly.

7. Easy Explanation
Explain in very easy language for a weak student.

For test generation:
Return only valid JSON when JSON is requested.
No markdown.
No explanation outside JSON.
No trailing commas.
No comments inside JSON.
`;

// ==========================================
// MAIN AI CALL — FALLBACK SYSTEM
// ==========================================

async function callAI(prompt, imageDataOptional = null) {
  const errors = [];

  // Image doubt: OpenRouter first, Gemini last.
  // Groq and SambaNova usually do not support image input.
  if (imageDataOptional) {
    if (OPENROUTER_API_KEY) {
      try {
        const answer = await callOpenRouter(prompt, imageDataOptional);
        if (answer && String(answer).trim()) return answer;
      } catch (err) {
        errors.push("OpenRouter: " + err.message);
      }
    } else {
      errors.push("OpenRouter: API key missing");
    }

    if (GEMINI_API_KEY) {
      try {
        const answer = await callGemini(prompt, imageDataOptional);
        if (answer && String(answer).trim()) return answer;
      } catch (err) {
        errors.push("Gemini: " + err.message);
      }
    } else {
      errors.push("Gemini: API key missing");
    }

    throw new Error("All image AI providers failed: " + errors.join(" | "));
  }

  // Text/Test fallback order:
  // 1. OpenRouter
  // 2. Groq
  // 3. SambaNova
  // 4. Gemini last
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
    },
    {
      name: "Gemini",
      enabled: Boolean(GEMINI_API_KEY),
      fn: () => callGemini(prompt)
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
  const content = [{ type: "text", text: prompt }];

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
          content: SYSTEM_PROMPT
        },
        {
          role: "user",
          content
        }
      ],
      temperature: 0.1
    })
  });

  const data = await safeResponseJson(response, "OpenRouter");

  if (!response.ok) {
    throw new Error(data?.error?.message || "OpenRouter request failed");
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
// GEMINI — LAST FALLBACK
// ==========================================

async function callGemini(prompt, imageDataOptional = null) {
  const parts = [
    {
      text: SYSTEM_PROMPT + "\n\nUser task:\n" + prompt
    }
  ];

  if (imageDataOptional) {
    const parsedImage = parseDataUrl(imageDataOptional);

    parts.push({
      inline_data: {
        mime_type: parsedImage.mimeType,
        data: parsedImage.base64
      }
    });
  }

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${GEMINI_API_KEY}`;

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
        temperature: 0.1
      }
    })
  });

  const data = await safeResponseJson(response, "Gemini");

  if (!response.ok) {
    throw new Error(data?.error?.message || "Gemini request failed");
  }

  return (
    data?.candidates?.[0]?.content?.parts
      ?.map((p) => p.text || "")
      .join("\n") || ""
  );
}

// ==========================================
// IMAGE HELPERS
// ==========================================

async function imageFileToDataUrl(imagePath, mimeType) {
  const imageBuffer = await fs.readFile(imagePath);
  const base64 = imageBuffer.toString("base64");
  return `data:${mimeType};base64,${base64}`;
}

function parseDataUrl(dataUrl) {
  const match = String(dataUrl || "").match(/^data:(.+);base64,(.+)$/);

  if (!match) {
    throw new Error("Invalid image data URL");
  }

  return {
    mimeType: match[1],
    base64: match[2]
  };
}
// ==========================================
// DOUBT SOLVER — HIGH ACCURACY PLAIN TEXT OUTPUT
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

IMPORTANT ACCURACY CHECK:
Before writing final answer, internally re-check:
- Did I copy all given values correctly?
- Did I understand what is being asked?
- Did I use the correct formula?
- Are signs, brackets, powers, roots, and fractions correct?
- Is arithmetic correct?
- Does the final answer satisfy the question?
- If image is provided, is the image text readable?

If image/question is unclear:
Do not guess.
Write:
"Question clear nahi hai. Please clearer image upload karein ya question type karein."

Answer format:

1. Question Meaning
Explain in very simple words what is being asked.

2. Given Values
Write all values from the question.
If no numerical values are given, write "No numerical values given."

3. Formula / Concept
Write the correct formula or concept in plain text.
Do not use LaTeX.

4. Step-by-Step Solution
Solve step by step.
Show all important calculation steps.
Do not skip arithmetic.

5. Self-Check
Verify the answer by substitution/reverse check/logic check/unit check.
If not possible, write:
"Direct self-check not possible, but formula and calculation have been rechecked."

6. Final Answer
Write final answer separately.
Give exact answer and approximate answer if needed.

7. Easy Explanation
Explain in very easy ${language}, like teaching a weak student.

Strict rules:
- No LaTeX.
- No confusing symbols.
- No markdown table.
- No fake values.
- No guessing.
- Do not invent missing numbers.
- Keep answer clean for mobile screen.
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

async function safeResponseJson(response, providerName) {
  try {
    return await response.json();
  } catch {
    throw new Error(`${providerName} returned invalid JSON response`);
  }
}

module.exports = {
  callAI,
  solveDoubt,
  solveTextDoubt,
  solveImageDoubt,
  generateMathTest
};
