const fs = require("fs");
const path = require("path");

const OPENROUTER_KEY = process.env.OPENROUTER_API_KEY;

// ================================
// ⚡ PARSER (AI ke answer ko tukdon mein todne ke liye)
// ================================
function parseResponse(text) {
  const sections = {
    understanding: text.match(/Question Understanding:\s*([\s\S]*?)(?=Formula Used:|$)/i)?.[1]?.trim() || "Solved",
    formula: text.match(/Formula Used:\s*([\s\S]*?)(?=Step-by-step Solution:|$)/i)?.[1]?.trim() || "Applied in steps",
    solution: text.match(/Step-by-step Solution:\s*([\s\S]*?)(?=Final Answer:|$)/i)?.[1]?.trim() || text,
    finalAnswer: text.match(/Final Answer:\s*([\s\S]*?)(?=Hindi Explanation:|$)/i)?.[1]?.trim() || "Result above",
    hindi: text.match(/Hindi Explanation:\s*([\s\S]*?)(?=English Explanation:|$)/i)?.[1]?.trim() || "Upar dekhein",
    english: text.match(/English Explanation:\s*([\s\S]*?)$/i)?.[1]?.trim() || "Detailed solution above"
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
      model: "openai/gpt-4o-mini", // Best and reliable model
      messages: messages
    })
  });

  const data = await res.json();
  if (!res.ok) throw new Error(data.error?.message || "AI Error");
  
  return data.choices[0].message.content;
}

const formatPrompt = `
Solve the math problem step-by-step.
You MUST use these EXACT headings:
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
async function solveTextDoubt(question) {
  try {
    const text = await callAI([
      { role: "user", content: `${formatPrompt}\n\nQuestion: ${question}` }
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
async function solveImageDoubt(imagePath, mimeType, question = "") {
  try {
    const absolutePath = path.resolve(imagePath);
    const base64Image = fs.readFileSync(absolutePath, "base64");
    
    const text = await callAI([
      {
        role: "user",
        content: [
          { type: "text", text: `${formatPrompt}\n\nContext: ${question}` },
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
