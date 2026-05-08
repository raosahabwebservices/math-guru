function safeText(value) {
  return String(value || "").replace(/[<>&]/g, "");
}

// =========================
// SOLUTION RENDER (FIXED)
// =========================
function renderSolution(doubt) {
  // AI se aaya hua solution object
  const s = doubt?.solution || {};

  return `
    <div class="sol-box">
      <h3 style="color:#2563eb; font-weight:bold; margin-bottom:5px;">Question Understanding:</h3>
      <p>${s.understanding || "Saved question: " + (doubt?.question || "Image doubt")}</p>
      
      <h3 style="color:#2563eb; font-weight:bold; margin-top:15px; margin-bottom:5px;">Formula Used:</h3>
      <p>${s.formula || "Applied in solution steps"}</p>
      
      <h3 style="color:#2563eb; font-weight:bold; margin-top:15px; margin-bottom:5px;">Step-by-step Solution:</h3>
      <div style="background:#f8fafc; padding:15px; border-radius:8px; white-space:pre-wrap; border:1px solid #e2e8f0; margin:10px 0; font-family: monospace;">${s.solution || "Processing solution..."}</div>
      
      <h3 style="color:#059669; font-weight:bold; margin-top:15px; margin-bottom:5px;">Final Answer:</h3>
      <p style="font-size:1.2rem; color:#059669;"><strong>${s.finalAnswer || "Solved"}</strong></p>
      
      <hr style="margin:20px 0; border:0; border-top:1px solid #ddd">
      
      <h3 style="color:#7c3aed; font-weight:bold;">Hindi Explanation:</h3>
      <p>${s.hindi || "Upar steps dekhein"}</p>
      
      <h3 style="color:#7c3aed; font-weight:bold; margin-top:10px;">English Explanation:</h3>
      <p>${s.english || "See solution above"}</p>
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

  // content.textContent ki jagah innerHTML taaki styling dikhe
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
// HISTORY (FIXED)
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

        ${d.imagePath ? `
          <img src="${API}${d.imagePath}" 
          style="max-height:120px;border-radius:12px; margin-bottom:10px; display:block;">
        ` : ""}

        <p class="muted" style="font-size:12px;">${new Date(d.createdAt).toLocaleDateString()}</p>

        <button class="btn small ghost" data-view="${d.id}" style="margin-top:10px;">
          View Solution
        </button>
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

  // TAB SWITCH
  document.querySelectorAll("[data-tab]").forEach((tab) =>
    tab.addEventListener("click", () => {
      document.querySelectorAll(".tab").forEach((t) => t.classList.remove("active"));
      tab.classList.add("active");

      document.querySelector("#textDoubtForm")?.classList.toggle("hidden", tab.dataset.tab !== "text");
      document.querySelector("#imageDoubtForm")?.classList.toggle("hidden", tab.dataset.tab !== "image");
    })
  );

  // =========================
  // TEXT DOUBT
  // =========================
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
      } catch (err) {
        msg(box, err.message, "error");
      }
    });
  }

  // =========================
  // IMAGE DOUBT
  // =========================
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
      } catch (err) {
        msg(box, err.message, "error");
      }
    });
  }
});
      
