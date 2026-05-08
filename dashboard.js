function safeText(value) {
  return String(value || "").replace(/[<>&]/g, "");
}

// ⚡ Final Gaps Killer Function
function cleanAIResponse(text) {
  if (!text) return "";
  return text
    .replace(/\\\[|\\\]|\\\(|\\\)/g, "") // LaTeX brackets remove
    .replace(/\*\*/g, "")               // Bold symbols remove
    .replace(/\n\s*\n/g, "\n")          // ⚡ Double/Triple empty lines ko single line banayegi
    .replace(/\n{2,}/g, "\n")           // Extra line breaks ko tight kar dega
    .trim();
}

// =========================
// SOLUTION RENDER (CLEAN)
// =========================
function renderSolution(doubt) {
  const s = doubt?.solution || {};

  return `
    <div class="sol-container">
      <div class="sol-card">
        
        <h3 class="sol-title">Question Understanding:</h3>
        <p class="sol-text">${cleanAIResponse(s.understanding || "Analyzed question detail.")}</p>
        
        <h3 class="sol-title">Formula Used:</h3>
        <p class="sol-text">${cleanAIResponse(s.formula || "Applied in steps.")}</p>
        
        <h3 class="sol-title">Step-by-step Solution:</h3>
        <div class="sol-steps-box">
          ${cleanAIResponse(s.solution || "Solution steps...")}
        </div>
        
        <div class="final-ans-box">
          <h3 class="ans-label">Final Answer:</h3>
          <p class="ans-value">${cleanAIResponse(s.finalAnswer || "Solved")}</p>
        </div>
        
        <hr class="sol-divider">
        
        <div class="explanation-grid">
          <div class="exp-box hindi">
            <h3 class="exp-title">Hindi Explanation:</h3>
            <p>${cleanAIResponse(s.hindi || "Upar steps dekhein.")}</p>
          </div>
          
          <div class="exp-box english">
            <h3 class="exp-title">English Explanation:</h3>
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

  // Background clean aur content render
  content.innerHTML = renderSolution(doubt);
  panel.classList.remove("hidden");
  panel.scrollIntoView({ behavior: "smooth" });
}

// =========================
// PROFILE
// =========================
async function loadProfileBits() {
  const user = await requireStudent();
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
      list.textContent = "No doubts yet. Ask your first doubt.";
      return;
    }

    list.innerHTML = data.doubts.map((d) => `
      <div class="history-item card">
        <span class="badge">${safeText(d.type).toUpperCase()}</span>
        <h3 style="margin: 10px 0;">${safeText(d.question || "Image doubt")}</h3>
        ${d.imagePath ? `<img src="${API}${d.imagePath}" class="history-img" style="max-height:120px; border-radius:12px; display:block; margin-bottom:10px;">` : ""}
        <p class="muted">${new Date(d.createdAt).toLocaleDateString()}</p>
        <button class="btn small ghost" data-view="${d.id}" style="margin-top:10px;">View Solution</button>
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

  document.querySelectorAll("[data-tab]").forEach((tab) =>
    tab.addEventListener("click", () => {
      document.querySelectorAll(".tab").forEach((t) => t.classList.remove("active"));
      tab.classList.add("active");
      document.querySelector("#textDoubtForm")?.classList.toggle("hidden", tab.dataset.tab !== "text");
      document.querySelector("#imageDoubtForm")?.classList.toggle("hidden", tab.dataset.tab !== "image");
    })
  );

  const textForm = document.querySelector("#textDoubtForm");
  if (textForm) {
    textForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      const box = document.querySelector("#textMsg");
      msg(box, "Solving...", "notice");
      try {
        const data = await request("/api/doubt/text", {
          method: "POST",
          body: JSON.stringify(Object.fromEntries(new FormData(textForm)))
        });
        setUser(data);
        msg(box, "Solved successfully", "success");
        showSolution(data.doubt);
        await loadProfileBits();
      } catch (err) { msg(box, err.message, "error"); }
    });
  }

  const imageForm = document.querySelector("#imageDoubtForm");
  if (imageForm) {
    imageForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      const box = document.querySelector("#imageMsg");
      msg(box, "Processing image...", "notice");
      try {
        const data = await request("/api/doubt/image", {
          method: "POST",
          body: new FormData(imageForm)
        });
        setUser(data);
        msg(box, "Solved successfully", "success");
        showSolution(data.doubt);
        await loadProfileBits();
      } catch (err) { msg(box, err.message, "error"); }
    });
  }
});
    
