const fs = require("fs");
const path = require("path");

const GEMINI_KEY = process.env.GEMINI_API_KEY;

// ================================
// ⚡ NEW: PARSER FUNCTION (Ye missing tha)
// ================================
function parseResponse(text) {
  // AI se aaye huye text ko headings ke hisaab se todna
  const sections = {
    understanding: text.match(/Question Understanding:\s*([\s\S]*?)(?=Formula Used:|$)/i)?.[1]?.trim() || "See steps below",
    formula: text.match(/Formula Used:\s*([\s\S]*?)(?=Step-by-step Solution:|$)/i)?.[1]?.trim() || "Applied in steps",
    solution: text.match(/Step-by-step Solution:\s*([\s\S]*?)(?=Final Answer:|$)/i)?.[1]?.trim() || text,
    finalAnswer: text.match(/Final Answer:\s*([\s\S]*?)(?=Hindi Explanation:|$)/i)?.[1]?.trim() || "Solved",
    hindi: text.match(/Hindi Explanation:\s*([\s\S]*?)(?=English Explanation:|$)/i)?.[1]?.trim() || "Upar dekhein",
    english: text.match(/English Explanation:\s*([\s\S]*?)$/i)?.[1]?.trim() || "See solution"
  };
  return sections;
}

async function callGemini(payload) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${GEMINI_KEY}`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error?.message || "Gemini Error");
  return data.candidates[0].content.parts[0].text;
}

// ================================
// TEXT SOLVER
// ================================
async function solveTextDoubt(question) {
  const prompt = `Solve this math question step-by-step.
  You MUST use these EXACT headings in your response:
  Question Understanding: 
  Formula Used: 
  Step-by-step Solution: 
  Final Answer: 
  Hindi Explanation: 
  English Explanation: 
  
  Question: ${question}`;

  try {
    const text = await callGemini({ contents: [{ parts: [{ text: prompt }] }] });
    return parseResponse(text); // Yahan tukde karke bhej rahe hain
  } catch (e) {
    return { solution: "AI Error: " + e.message };
  }
}

// ================================
// IMAGE SOLVER
// ================================
async function solveImageDoubt(imagePath, mimeType, question = "") {
  const base64Image = fs.readFileSync(path.resolve(imagePath), "base64");
  const prompt = `Solve the math problem in this image. 
  You MUST use these EXACT headings in your response:
  Question Understanding: 
  Formula Used: 
  Step-by-step Solution: 
  Final Answer: 
  Hindi Explanation: 
  English Explanation: 
  
  Extra context: ${question}`;

  try {
    const text = await callGemini({
      contents: [{
        parts: [
          { text: prompt },
          { inlineData: { mimeType, data: base64Image } }
        ]
      }]
    });
    return parseResponse(text); // Image wale mein bhi tukde karke bhej rahe hain
  } catch (e) {
    return { solution: "Image AI Error: " + e.message };
  }
}

module.exports = { solveTextDoubt, solveImageDoubt };
          
