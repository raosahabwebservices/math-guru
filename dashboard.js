function safeText(value) {
  return String(value || "").replace(/[<>&]/g, "");
}

// =========================
// SOLUTION RENDER (PREMIUM UI)
// =========================
function renderSolution(doubt) {
  const s = doubt?.solution || {};

  // Is container se width control hogi aur solution failega nahi
  return `
    <div style="max-width:800px; margin:0 auto; text-align:left;">
      <div class="sol-card" style="background:white; padding:20px; border-radius:12px; border:1px solid #e2e8f0;">
        
        <h3 style="color:#2563eb; font-weight:bold; margin-bottom:8px; font-size:1.1rem;">Question Understanding:</h3>
        <p style="color:#475569; margin-bottom:20px;">${s.understanding || "Analyzed question detail."}</p>
        
        <h3 style="color:#2563eb; font-weight:bold; margin-bottom:8px; font-size:1.1rem;">Formula Used:</h3>
        <p style="color:#475569; margin-bottom:20px;">${s.formula || "Basic calculation principles."}</p>
        
        <h3 style="color:#2563eb; font-weight:bold; margin-bottom:8px; font-size:1.1rem;">Step-by-step Solution:</h3>
        <div style="background:#f8fafc; padding:18px; border-radius:8px; white-space:pre-wrap; border:1px solid #cbd5e1; margin:10px 0; font-family: 'Courier New', Courier, monospace; color:#1e293b; line-height:1.6;">${s.solution || "Solution steps..."}</div>
        
        <div style="background:#ecfdf5; padding:15px; border-radius:10px; border-left:5px solid #10b981; margin:25px 0;">
          <h3 style="color:#065f46; font-weight:bold; margin:0; font-size:1.1rem;">Final Answer:</h3>
          <p style="font-size:1.4rem; color:#047857; margin-top:5px; font-weight:800;">${s.finalAnswer || "Solved"}</p>
        </div>
        
        <hr style="margin:25px 0; border:0; border-top:1px solid #e2e8f0">
        
        <div class="explanation-grid" style="display:grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap:20px;">
          <div style="background:#f5f3ff; padding:15px; border-radius:8px; border:1px solid #ddd6fe;">
            <h3 style="color:#7c3aed; font-weight:bold; margin-bottom:8px;">Hindi Explanation:</h3>
            <p style="color:#4c1d95; font-size:0.95rem;">${s.hindi || "Upar steps dekhein."}</p>
          </div>
          
          <div style="background:#eff6ff; padding:15px; border-radius:8px; border:1px solid #bfdbfe;">
            <h3 style="color:#1d4ed8; font-weight:bold; margin-bottom:8px;">English Explanation:</h3>
            <p style="color:#1e3a8a; font-size:0.95rem;">${s.english || "See detailed solution above."}</p>
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

  // Clear background and set innerHTML
  content.style.background = "transparent"; 
  content.innerHTML = renderSolution(doubt);
  
  panel.classList.remove("hidden");
  panel.scrollIntoView({ behavior: "smooth" });
}

// =========================
// PROFILE (SAME)
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
// HISTORY (SAME)
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
      <div class="history-item card" style="margin-bottom:15px; padding:15px; border:1px solid #eee;">
        <span class="badge" style="background:#e0e7ff; color:#4338ca; padding:2px 8px; border-radius:4px; font-size:12px;">${safeText(d.type).toUpperCase()}</span>
        <h3 style="margin:10px 0;">${safeText(d.question || "Image doubt")}</h3>
        ${d.imagePath ? `<img src="${API}${d.imagePath}" style="max-height:120px;border-radius:12px; margin-bottom:10px; display:block;">` : ""}
        <p class="muted" style="font-size:12px;">${new Date(d.createdAt).toLocaleDateString()}</p>
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
// INIT (SAME)
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
                                                   
