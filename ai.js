const fs = require("fs");
const path = require("path");

const OPENROUTER_KEY = process.env.OPENROUTER_API_KEY;

// ================================
// ⚡ PARSER (Safaai ke saath)
// ================================
function parseResponse(text) {
  // Faltu symbols aur extra gaps hatane ke liye clean-up
  const clean = (str) => {
    if (!str) return "";
    return str
      .replace(/\\\[|\\\]|\\\(|\\\)/g, "") // Remove LaTeX brackets
      .replace(/\*\*/g, "")               // Remove Bold symbols
      .replace(/\n{3,}/g, "\n\n")         // Max 2 newlines only
      .trim();
  };

  const sections = {
    understanding: clean(text.match(/Question Understanding:\s*([\s\S]*?)(?=Formula Used:|$)/i)?.[1]),
    formula: clean(text.match(/Formula Used:\s*([\s\S]*?)(?=Step-by-step Solution:|$)/i)?.[1]),
    solution: clean(text.match(/Step-by-step Solution:\s*([\s\S]*?)(?=Final Answer:|$)/i)?.[1] || text),
    finalAnswer: clean(text.match(/Final Answer:\s*([\s\S]*?)(?=Hindi Explanation:|$)/i)?.[1]),
    hindi: clean(text.match(/Hindi Explanation:\s*([\s\S]*?)(?=English Explanation:|$)/i)?.[1]),
    english: clean(text.match(/English Explanation:\s*([\s\S]*?)$/i)?.[1])
  };
  return sections;
}

// ================================
// OPENROUTER API CALLER
// ================================
async function callAI(messages) {
  if (!OPENROUTER_KEY) throw new Error("OPENROUTER_API_KEY missing in Render settings!");

  const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${OPENROUTER_KEY}`
    },
    body: JSON.stringify({
      model: "openai/gpt-4o-mini",
      messages: messages,
      temperature: 0.5 // Thoda serious answer ke liye
    })
  });

  const data = await res.json();
  if (!res.ok) throw new Error(data.error?.message || "AI Error");
  
  return data.choices[0].message.content;
}

// Prompt Engine
const getSystemPrompt = (lang) => `
You are Maths Guru AI. Solve the problem step-by-step.
STRICT RULES:
1. Do NOT use markdown symbols like **, #, or LaTeX brackets like \\[ \\].
2. Use plain text only.
3. Language Preference: Explanations must be in ${lang}.
4. Keep the spacing clean.

YOU MUST USE THESE HEADINGS:
Question Understanding:
Formula Used:
Step-by-step Solution:
Final Answer:
Hindi Explanation:
English Explanation:
`;

// ================================
// TEXT DOUBT SOLVER
// ================================
async function solveTextDoubt(question, language = "Hinglish") {
  try {
    const text = await callAI([
      { role: "system", content: getSystemPrompt(language) },
      { role: "user", content: `Question: ${question}` }
    ]);
    return parseResponse(text);
  } catch (e) {
    console.error(e);
    return { solution: "AI Error: " + e.message };
  }
}

// ================================
// IMAGE DOUBT SOLVER
// ================================
async function solveImageDoubt(imagePath, mimeType, question = "", language = "Hinglish") {
  try {
    const absolutePath = path.resolve(imagePath);
    const base64Image = fs.readFileSync(absolutePath, "base64");
    
    const text = await callAI([
      { role: "system", content: getSystemPrompt(language) },
      {
        role: "user",
        content: [
          { type: "text", text: `Extra context: ${question}` },
          {
            type: "image_url",
            image_url: { url: `data:${mimeType};base64,${base64Image}` }
          }
        ]
      }
    ]);
    
    return parseResponse(text);
  } catch (e) {
    console.error(e);
    return { solution: "Image AI Error: " + e.message };
  }
}

module.exports = { solveTextDoubt, solveImageDoubt };
