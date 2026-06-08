const DOUBT_API =
  window.location.hostname === "localhost" ||
  window.location.hostname === "127.0.0.1"
    ? "http://localhost:3000"
    : "https://math-guru.onrender.com";

function cleanText(value) {
  return String(value || "")
    .replace(/[<>&]/g, "")
    .replace(/\*\*/g, "")
    .trim();
}

function showLocalMsg(el, text, type = "notice") {
  if (!el) return;

  el.className = `notice ${type}`;
  el.textContent = text;
  el.style.display = "block";
  el.classList.remove("hidden");
}

function renderSolution(doubt) {
  const solution = cleanText(doubt?.solution || "No solution found.");

  return `
    <div class="sol-card">
      <h3>Step-by-step Solution</h3>
      <div style="white-space:pre-wrap; background:#f9f9f9; padding:15px; border-radius:8px;">
        ${solution}
      </div>
    </div>
  `;
}

function showSolution(doubt) {
  const panel = document.querySelector("#solutionPanel");
  const content = document.querySelector("#solutionContent");

  if (!panel || !content) return;

  content.innerHTML = renderSolution(doubt);
  panel.classList.remove("hidden");
  panel.scrollIntoView({ behavior: "smooth" });
}

async function loadDoubtProfile() {
  try {
    if (typeof window.requireStudent !== "function") {
      console.error("requireStudent missing. script.js pehle load hona chahiye.");
      return;
    }

    const user = await window.requireStudent();

    const limitText = document.querySelector("#limitText");
    const limitImage = document.querySelector("#limitImage");

    if (limitText) limitText.textContent = user?.remainingText ?? 0;
    if (limitImage) limitImage.textContent = user?.remainingImage ?? 0;
  } catch (err) {
    console.error("Profile error:", err.message);
  }
}

async function loadDoubtHistory() {
  const list = document.querySelector("#historyList");
  if (!list) return;

  try {
    const data = await request("/api/doubts/history");

    if (!data?.doubts || data.doubts.length === 0) {
      list.innerHTML = `<p class="muted">No doubts yet.</p>`;
      return;
    }

    list.innerHTML = data.doubts.map((d) => {
      return `
        <div class="history-item card" style="margin-bottom:10px; padding:15px;">
          <strong>${cleanText(d.type).toUpperCase()}</strong>
          <p>${cleanText(d.question || "Image doubt")}</p>

          ${
            d.imagePath
              ? `<img src="${DOUBT_API}${d.imagePath}" style="max-width:140px; border-radius:8px;">`
              : ""
          }

          <br><br>

          <button type="button" class="btn small ghost" data-view="${d.id}">
            View Solution
          </button>
        </div>
      `;
    }).join("");

    list.querySelectorAll("[data-view]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const doubt = data.doubts.find((d) => d.id === btn.dataset.view);
        if (doubt) showSolution(doubt);
      });
    });
  } catch (err) {
    list.innerHTML = `<p class="muted">History load failed.</p>`;
  }
}

async function handleTextDoubt(e) {
  e.preventDefault();

  const form = e.target;
  const box = document.querySelector("#textMsg");
  const btn = form.querySelector("button[type='submit']");

  const formData = Object.fromEntries(new FormData(form).entries());

  const question = String(formData.question || "").trim();
  const language = formData.language || "Hinglish";

  if (!question) {
    showLocalMsg(box, "Pehle question likho.", "error");
    return;
  }

  try {
    btn.disabled = true;
    btn.textContent = "Solving...";
    showLocalMsg(box, "AI solve kar raha hai...", "notice");

    const data = await request("/api/doubt/text", {
      method: "POST",
      body: JSON.stringify({
        question,
        language
      })
    });

    showLocalMsg(box, "Solved successfully", "success");
    showSolution(data.doubt);

    await loadDoubtProfile();
    await loadDoubtHistory();

  } catch (err) {
    showLocalMsg(box, err.message, "error");
  } finally {
    btn.disabled = false;
    btn.textContent = "Solve Text Doubt";
  }
}

async function handleImageDoubt(e) {
  e.preventDefault();

  const form = e.target;
  const box = document.querySelector("#imageMsg");
  const btn = form.querySelector("button[type='submit']");
  const fileInput = form.querySelector('input[name="image"]');

  if (!fileInput || !fileInput.files || fileInput.files.length === 0) {
    showLocalMsg(box, "Pehle image select karo.", "error");
    return;
  }

  try {
    btn.disabled = true;
    btn.textContent = "Analyzing...";
    showLocalMsg(box, "AI image analyze kar raha hai...", "notice");

    const data = await request("/api/doubt/image", {
      method: "POST",
      body: new FormData(form)
    });

    showLocalMsg(box, "Solved successfully", "success");
    showSolution(data.doubt);

    await loadDoubtProfile();
    await loadDoubtHistory();

  } catch (err) {
    showLocalMsg(box, err.message, "error");
  } finally {
    btn.disabled = false;
    btn.textContent = "Solve Image Doubt";
  }
}

document.addEventListener("DOMContentLoaded", async () => {
  await loadDoubtProfile();
  await loadDoubtHistory();

  document.querySelectorAll("[data-tab]").forEach((tab) => {
    tab.addEventListener("click", () => {
      document.querySelectorAll(".tab").forEach((t) => {
        t.classList.remove("active");
      });

      tab.classList.add("active");

      const textForm = document.querySelector("#textDoubtForm");
      const imageForm = document.querySelector("#imageDoubtForm");

      if (textForm) {
        textForm.classList.toggle("hidden", tab.dataset.tab !== "text");
      }

      if (imageForm) {
        imageForm.classList.toggle("hidden", tab.dataset.tab !== "image");
      }
    });
  });

  const textForm = document.querySelector("#textDoubtForm");
  const imageForm = document.querySelector("#imageDoubtForm");

  if (textForm) {
    textForm.addEventListener("submit", handleTextDoubt);
  }

  if (imageForm) {
    imageForm.addEventListener("submit", handleImageDoubt);
  }
});
