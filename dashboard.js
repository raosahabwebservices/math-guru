// =========================================
// 🌐 CONFIGURATION SYNC
// =========================================
// 👑 FIXED: API Variable top par define kiya taaki image paths aur request wrapper crash na ho
const API = window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1"
  ? "http://localhost:3000"
  : "https://math-guru.onrender.com";

// =========================
// HELPERS & CLEANERS
// =========================
function safeText(value) {
  return String(value || "").replace(/[<>&]/g, "");
}

function cleanAIResponse(text) {
  if (!text) return "";
  return text
    .replace(/\\\[|\\\]|\\\(|\\\)/g, "") // LaTeX brackets remove
    .replace(/\*\*/g, "")               // Bold symbols remove
    .replace(/\n\s*\n/g, "\n")          // Extra empty lines single line
    .replace(/\n{2,}/g, "\n")           // Extra line breaks tight
    .trim();
}

// =========================
// SOLUTION RENDER (Sync with AI response)
// =========================
function renderSolution(doubt) {
  let s = doubt?.solution;
  if (typeof s === 'string') {
    s = { solution: s, understanding: "Anaylzed", formula: "Logic", finalAnswer: "Check steps", hindi: "Upar dekhein", english: "See above" };
  }
  if (!s) s = {};

  return `
    <div class="sol-container">
      <div class="sol-card">
        <h3 class="sol-title">Question Understanding:</h3>
        <p class="sol-text">${cleanAIResponse(s.understanding || "Analyzed question detail.")}</p>
        
        <h3 class="sol-title">Formula Used:</h3>
        <p class="sol-text">${cleanAIResponse(s.formula || "Applied in steps.")}</p>
        
        <h3 class="sol-title">Step-by-step Solution:</h3>
        <div class="sol-steps-box" style="white-space: pre-wrap; background: #f9f9f9; padding: 15px; border-radius: 8px;">
          ${cleanAIResponse(s.solution || "Solution steps...")}
        </div>
        
        <div class="final-ans-box" style="margin-top: 15px; background: #e8f5e9; padding: 15px; border-radius: 8px; border-left: 5px solid #4caf50;">
          <h3 class="ans-label" style="margin: 0; color: #2e7d32;">Final Answer:</h3>
          <p class="ans-value" style="font-size: 1.2rem; font-weight: bold; margin: 5px 0 0 0;">${cleanAIResponse(s.finalAnswer || "Solved")}</p>
        </div>
        
        <hr class="sol-divider" style="margin: 20px 0; opacity: 0.1;">
        
        <div class="explanation-grid">
          <div class="exp-box hindi" style="margin-bottom: 15px;">
            <h3 class="exp-title" style="color: #1976d2;">Hindi Explanation:</h3>
            <p>${cleanAIResponse(s.hindi || "Upar steps dekhein.")}</p>
          </div>
          <div class="exp-box english">
            <h3 class="exp-title" style="color: #1976d2;">English Explanation:</h3>
            <p>${cleanAIResponse(s.english || "See solution above.")}</p>
          </div>
        </div>
      </div>
    </div>
  `;
}

// =========================
// SHOW SOLUTION
// =========================
function showSolution(doubt) {
  const panel = document.querySelector("#solutionPanel");
  const content = document.querySelector("#solutionContent");
  if (!panel || !content) return;

  content.innerHTML = renderSolution(doubt);
  panel.classList.remove("hidden");
  panel.scrollIntoView({ behavior: "smooth" });
}

// =========================
// PROFILE
// =========================
async function loadProfileBits() {
  try {
    // 👑 FIXED: script.js se profile data handle check safe structure lagaya
    const data = await window.requireStudent(); 
    const user = data;
    
    const plan = document.querySelector("#planType");
    const textLeft = document.querySelector("#textLeft");
    const imageLeft = document.querySelector("#imageLeft");

    if (plan) plan.textContent = user?.premiumActive ? "Premium" : "Free";
    if (textLeft) textLeft.textContent = user?.remainingText ?? 0;
    if (imageLeft) imageLeft.textContent = user?.remainingImage ?? 0;

    const limitText = document.querySelector("#limitText");
    const limitImage = document.querySelector("#limitImage");
    if (limitText) limitText.textContent = user?.remainingText ?? 0;
    if (limitImage) limitImage.textContent = user?.remainingImage ?? 0;

    return user;
  } catch (e) {
    console.error("Profile load failed", e);
  }
}

// =========================
// HISTORY
// =========================
async function loadHistory() {
  const list = document.querySelector("#historyList");
  if (!list) return;

  try {
    const data = await request("/api/doubts/history");
    if (!data?.doubts || data.doubts.length === 0) {
      list.innerHTML = `<p class="muted">No doubts yet. Ask your first doubt.</p>`;
      return;
    }

    list.innerHTML = data.doubts.map((d) => `
      <div class="history-item card" style="border: 1px solid #eee; margin-bottom: 10px; padding: 15px;">
        <span class="badge" style="background: #eee; padding: 2px 8px; border-radius: 4px; font-size: 0.8rem;">${safeText(d.type).toUpperCase()}</span>
        <h3 style="margin: 10px 0; font-size: 1rem;">${safeText(d.question || "Image doubt")}</h3>
        ${d.imagePath ? `<img src="${API}${d.imagePath}" class="history-img" style="max-height:120px; border-radius:12px; display:block; margin-bottom:10px;">` : ""}
        <p class="muted" style="font-size: 0.8rem;">${new Date(d.createdAt).toLocaleDateString()}</p>
        <button class="btn small ghost" data-view="${d.id}" style="margin-top:10px; cursor: pointer;">View Solution</button>
      </div>
    `).join("");

    list.querySelectorAll("[data-view]").forEach((btn) =>
      btn.addEventListener("click", () => {
        const doubt = data.doubts.find((d) => d.id === btn.dataset.view);
        if (doubt) showSolution(doubt);
      })
    );
  } catch (err) {
    list.textContent = "Failed to load history";
  }
}

// =========================
// INIT
// =========================
document.addEventListener("DOMContentLoaded", async () => {
  await loadProfileBits();
  loadHistory();

  // Tab switching logic
  document.querySelectorAll("[data-tab]").forEach((tab) =>
    tab.addEventListener("click", () => {
      document.querySelectorAll(".tab").forEach((t) => t.classList.remove("active"));
      tab.classList.add("active");
      document.querySelector("#textDoubtForm")?.classList.toggle("hidden", tab.dataset.tab !== "text");
      document.querySelector("#imageDoubtForm")?.classList.toggle("hidden", tab.dataset.tab !== "image");
    })
  );

  // Text Form Submission
  const textForm = document.querySelector("#textDoubtForm");
  if (textForm) {
    textForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      const box = document.querySelector("#textMsg");
      if (typeof msg === "function") msg(box, "Solving your question...", "notice");
      try {
        const data = await request("/api/doubt/text", {
          method: "POST",
          body: JSON.stringify(Object.fromEntries(new FormData(textForm)))
        });
        if (typeof msg === "function") msg(box, "Solved successfully", "success");
        showSolution(data.doubt);
        await loadProfileBits();
      } catch (err) { if (typeof msg === "function") msg(box, err.message, "error"); }
    });
  }

  // Image Form Submission
  const imageForm = document.querySelector("#imageDoubtForm");
  if (imageForm) {
    imageForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      const box = document.querySelector("#imageMsg");
      if (typeof msg === "function") msg(box, "AI is analyzing the image...", "notice");
      try {
        const data = await request("/api/doubt/image", {
          method: "POST",
          body: new FormData(imageForm)
        });
        if (typeof msg === "function") msg(box, "Solved successfully", "success");
        showSolution(data.doubt);
        await loadProfileBits();
      } catch (err) { if (typeof msg === "function") msg(box, err.message, "error"); }
    });
  }
});

