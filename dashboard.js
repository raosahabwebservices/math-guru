function safeText(value) {
  return String(value || "").replace(/[<>&]/g, "");
}

// =========================
// SOLUTION RENDER (SAFE)
// =========================
function renderSolution(doubt) {
  const s = doubt?.solution || {};

  return `
Question Understanding:
${s.questionUnderstanding || "Saved question: " + (doubt?.question || "Image doubt")}

Formula Used:
${s.formulaUsed || "See full answer"}

Formula Kaise Use Hua:
${s.formulaHowUsed || "Explained in solution"}

Step-by-step Solution:
${s.steps || s.raw || s.solutionHindi || ""}

Final Answer:
${s.finalAnswer || "N/A"}

Hindi Explanation:
${s.solutionHindi || ""}

English Explanation:
${s.solutionEnglish || ""}
`;
}

// =========================
// SHOW SOLUTION
// =========================
function showSolution(doubt) {
  const panel = document.querySelector("#solutionPanel");
  const content = document.querySelector("#solutionContent");

  if (!panel || !content) return;

  content.textContent = renderSolution(doubt);
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
      <div class="history-item">
        <span class="badge">${safeText(d.type)}</span>
        <h3>${safeText(d.question || "Image doubt")}</h3>

        ${d.imagePath ? `
          <img src="https://math-guru-production.up.railway.app${d.imagePath}" 
          style="max-height:120px;border-radius:12px">
        ` : ""}

        <p class="muted">${moneyDate(d.createdAt)}</p>

        <button class="btn small ghost" data-view="${d.id}">
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

        // 🔥 FIX IMPORTANT
        setUser(data.user);

        msg(box, "Solved successfully", "success");
        showSolution(data.doubt);

        await loadProfileBits();

      } catch (err) {
        msg(box, err.message, "error");

        if (err.message.includes("limit")) {
          setTimeout(() => location.href = "upgrade.html", 1000);
        }
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

        // 🔥 FIX IMPORTANT
        setUser(data.user);

        msg(box, "Solved successfully", "success");
        showSolution(data.doubt);

        await loadProfileBits();

      } catch (err) {
        msg(box, err.message, "error");

        if (err.message.includes("limit")) {
          setTimeout(() => location.href = "upgrade.html", 1000);
        }
      }
    });
  }

});
