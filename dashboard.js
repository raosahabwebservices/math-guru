function safeText(value) {
  return String(value || "").replace(/[<>&]/g, "");
}

function renderSolution(doubt) {
  const s = doubt.solution || {};
  return `Question Understanding:\n${s.questionUnderstanding || "Saved question: " + (doubt.question || "Image doubt")}\n\nFormula Used:\n${s.formulaUsed || doubt.formulaUsed || "See full answer"}\n\nFormula Kaise Use Hua:\n${s.formulaHowUsed || "Explained in solution"}\n\nStep-by-step Solution:\n${s.steps || s.raw || ""}\n\nFinal Answer:\n${s.finalAnswer || ""}\n\nHindi Explanation:\n${doubt.solutionHindi || s.solutionHindi || ""}\n\nEnglish Explanation:\n${doubt.solutionEnglish || s.solutionEnglish || ""}`;
}

function showSolution(doubt) {
  const panel = document.querySelector("#solutionPanel");
  const content = document.querySelector("#solutionContent");
  if (!panel || !content) return;
  content.textContent = renderSolution(doubt);
  panel.classList.remove("hidden");
  panel.scrollIntoView({ behavior: "smooth" });
}

async function loadProfileBits() {
  const user = await requireStudent();
  const plan = document.querySelector("#planType");
  const textLeft = document.querySelector("#textLeft");
  const imageLeft = document.querySelector("#imageLeft");
  const limitText = document.querySelector("#limitText");
  const limitImage = document.querySelector("#limitImage");
  if (plan) plan.textContent = user.premiumActive ? "Premium" : "Free";
  if (textLeft) textLeft.textContent = user.remainingText;
  if (imageLeft) imageLeft.textContent = user.remainingImage;
  if (limitText) limitText.textContent = user.remainingText;
  if (limitImage) limitImage.textContent = user.remainingImage;
  return user;
}

async function loadHistory() {
  const list = document.querySelector("#historyList");
  if (!list) return;
  try {
    const data = await request("/api/doubts/history");
    if (!data.doubts.length) {
      list.textContent = "No doubts yet. Ask your first doubt now.";
      return;
    }
    list.innerHTML = data.doubts.map((d) => `<div class="history-item"><span class="badge">${safeText(d.type)}</span><h3>${safeText(d.question || "Image doubt")}</h3>${d.imagePath ? `<img src="${d.imagePath}" style="max-height:120px;border-radius:12px">` : ""}<p class="muted">${moneyDate(d.createdAt)}</p><button class="btn small ghost" data-view="${d.id}">View Solution</button></div>`).join("");
    list.querySelectorAll("[data-view]").forEach((btn) => btn.addEventListener("click", () => showSolution(data.doubts.find((d) => d.id === btn.dataset.view))));
  } catch (error) {
    list.textContent = error.message;
  }
}

document.addEventListener("DOMContentLoaded", async () => {
  if (document.querySelector("#planType") || document.querySelector("#limitText") || document.querySelector("#paymentForm")) await loadProfileBits();
  loadHistory();

  document.querySelectorAll("[data-tab]").forEach((tab) => tab.addEventListener("click", () => {
    document.querySelectorAll(".tab").forEach((item) => item.classList.remove("active"));
    tab.classList.add("active");
    document.querySelector("#textDoubtForm").classList.toggle("hidden", tab.dataset.tab !== "text");
    document.querySelector("#imageDoubtForm").classList.toggle("hidden", tab.dataset.tab !== "image");
  }));

  const textForm = document.querySelector("#textDoubtForm");
  if (textForm) textForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    const box = document.querySelector("#textMsg");
    msg(box, "Solving your doubt with AI...", "notice");
    try {
      const data = await request("/api/doubt/text", { method: "POST", body: JSON.stringify(Object.fromEntries(new FormData(textForm))) });
      setUser(data);
      msg(box, "Solved successfully.", "success");
      showSolution(data.doubt);
      await loadProfileBits();
    } catch (error) {
      msg(box, error.message, "error");
      if (error.message.includes("limit")) setTimeout(() => location.href = "upgrade.html", 1200);
    }
  });

  const imageForm = document.querySelector("#imageDoubtForm");
  if (imageForm) imageForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    const box = document.querySelector("#imageMsg");
    msg(box, "Reading image and solving with AI...", "notice");
    try {
      const data = await request("/api/doubt/image", { method: "POST", body: new FormData(imageForm) });
      setUser(data);
      msg(box, "Solved successfully.", "success");
      showSolution(data.doubt);
      await loadProfileBits();
    } catch (error) {
      msg(box, error.message, "error");
      if (error.message.includes("limit")) setTimeout(() => location.href = "upgrade.html", 1200);
    }
  });

  const payment = document.querySelector("#paymentForm");
  if (payment) payment.addEventListener("submit", async (event) => {
    event.preventDefault();
    const box = document.querySelector("#paymentMsg");
    try {
      const data = await request("/api/payment", { method: "POST", body: new FormData(payment) });
      payment.reset();
      msg(box, data.message, "success");
    } catch (error) {
      msg(box, error.message, "error");
    }
  });
});