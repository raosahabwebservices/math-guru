const DOUBT_API =
  window.location.hostname === "localhost" ||
  window.location.hostname === "127.0.0.1"
    ? "http://localhost:3000"
    : "https://math-guru.onrender.com";

// =========================
// API REQUEST FALLBACK
// =========================
async function doubtRequest(path, options = {}) {
  if (typeof window.request === "function") {
    return await window.request(path, options);
  }

  const token = localStorage.getItem("mg_token") || "";

  const cleanPath = path.startsWith("/api/")
    ? path
    : path.startsWith("/")
      ? `/api${path}`
      : `/api/${path}`;

  const headers = {};

  if (!(options.body instanceof FormData)) {
    headers["Content-Type"] = "application/json";
  }

  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  const res = await fetch(DOUBT_API + cleanPath, {
    ...options,
    headers: {
      ...headers,
      ...(options.headers || {})
    }
  });

  const contentType = res.headers.get("content-type") || "";

  if (!contentType.includes("application/json")) {
    throw new Error("Server Error: API route not found or Render issue");
  }

  const data = await res.json();

  if (res.status === 401) {
    localStorage.removeItem("mg_token");
    localStorage.removeItem("mg_user");
    window.location.href = "login.html";
    return;
  }

  if (!res.ok) {
    throw new Error(data.message || "Request failed");
  }

  return data;
}

// =========================
// CLEANERS
// =========================
function cleanText(value) {
  return String(value || "")
    .replace(/\\frac\s*\{([^}]*)\}\s*\{([^}]*)\}/g, "($1)/($2)")
    .replace(/\\sqrt\s*\{([^}]*)\}/g, "sqrt($1)")
    .replace(/\\theta/g, "theta")
    .replace(/\\cos\^\{-1\}/g, "cos inverse")
    .replace(/\\sin\^\{-1\}/g, "sin inverse")
    .replace(/\\tan\^\{-1\}/g, "tan inverse")
    .replace(/\\left/g, "")
    .replace(/\\right/g, "")
    .replace(/\\cdot/g, "*")
    .replace(/\\times/g, "×")
    .replace(/\\div/g, "÷")
    .replace(/\\\[/g, "")
    .replace(/\\\]/g, "")
    .replace(/\\\(/g, "")
    .replace(/\\\)/g, "")
    .replace(/\$/g, "")
    .replace(/\*\*/g, "")
    .replace(/#{1,6}\s?/g, "")
    .replace(/\r/g, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function escapeDoubtHtml(value) {
  return cleanText(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function showLocalMsg(el, text, type = "notice") {
  if (!el) return;

  el.className = `notice ${type}`;
  el.textContent = text;
  el.style.display = "block";
  el.classList.remove("hidden");
}

function getImageUrl(path) {
  const p = String(path || "").trim();

  if (!p) return "";
  if (p.startsWith("http://") || p.startsWith("https://")) return p;

  return DOUBT_API + p;
}

function safeDate(value) {
  try {
    return new Date(value || Date.now()).toLocaleDateString();
  } catch (err) {
    return "";
  }
}

// =========================
// SECTION EXTRACTOR
// =========================
function getSolutionSection(text, startTitle, endTitle = null) {
  const solution = cleanText(text);

  const safeStartTitle = startTitle.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

  const startRegex = new RegExp(`${safeStartTitle}\\s*`, "i");
  const startMatch = solution.match(startRegex);

  if (!startMatch) return "";

  const startIndex = startMatch.index + startMatch[0].length;
  let endIndex = solution.length;

  if (endTitle) {
    const safeEndTitle = endTitle.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const endRegex = new RegExp(`${safeEndTitle}\\s*`, "i");

    const rest = solution.slice(startIndex);
    const endMatch = rest.match(endRegex);

    if (endMatch) {
      endIndex = startIndex + endMatch.index;
    }
  }

  return solution.slice(startIndex, endIndex).trim();
}

// =========================
// BEAUTIFUL SOLUTION RENDER
// =========================
function renderSolution(doubt) {
  const rawSolution = cleanText(
    doubt?.solution || doubt?.answer || "No solution found."
  );

  const questionMeaning = getSolutionSection(
    rawSolution,
    "1. Question Meaning",
    "2. Given Values"
  );

  const givenValues = getSolutionSection(
    rawSolution,
    "2. Given Values",
    "3. Formula / Concept"
  );

  const formula = getSolutionSection(
    rawSolution,
    "3. Formula / Concept",
    "4. Step-by-Step Solution"
  );

  const steps = getSolutionSection(
    rawSolution,
    "4. Step-by-Step Solution",
    "5. Self-Check"
  );

  const selfCheck = getSolutionSection(
    rawSolution,
    "5. Self-Check",
    "6. Final Answer"
  );

  const finalAnswer = getSolutionSection(
    rawSolution,
    "6. Final Answer",
    "7. Easy Explanation"
  );

  const easyExplanation = getSolutionSection(
    rawSolution,
    "7. Easy Explanation"
  );

  const hasSections =
    questionMeaning ||
    givenValues ||
    formula ||
    steps ||
    selfCheck ||
    finalAnswer ||
    easyExplanation;

  if (!hasSections) {
    return `
      <div class="sol-container">
        <div class="sol-card">
          <h3 class="sol-title">AI Solution</h3>
          <div class="sol-steps-box">${escapeDoubtHtml(rawSolution)}</div>
        </div>
      </div>
    `;
  }

  return `
    <div class="sol-container">
      <div class="sol-card">

        ${
          questionMeaning
            ? `
              <h3 class="sol-title">Question Meaning</h3>
              <div class="sol-text">${escapeDoubtHtml(questionMeaning)}</div>
            `
            : ""
        }

        ${
          givenValues
            ? `
              <h3 class="sol-title">Given Values</h3>
              <div class="sol-text">${escapeDoubtHtml(givenValues)}</div>
            `
            : ""
        }

        ${
          formula
            ? `
              <h3 class="sol-title">Formula / Concept</h3>
              <div class="sol-text">${escapeDoubtHtml(formula)}</div>
            `
            : ""
        }

        ${
          steps
            ? `
              <h3 class="sol-title">Step-by-Step Solution</h3>
              <div class="sol-steps-box">${escapeDoubtHtml(steps)}</div>
            `
            : ""
        }

        ${
          selfCheck
            ? `
              <h3 class="sol-title">Self-Check</h3>
              <div class="sol-text">${escapeDoubtHtml(selfCheck)}</div>
            `
            : ""
        }

        ${
          finalAnswer
            ? `
              <div class="final-ans-box">
                <p class="ans-label">✅ Final Answer</p>
                <p class="ans-value">${escapeDoubtHtml(finalAnswer)}</p>
              </div>
            `
            : ""
        }

        ${
          easyExplanation
            ? `
              <div class="explanation-grid">
                <div class="exp-box hindi">
                  <h3 class="exp-title">Easy Explanation</h3>
                  <p>${escapeDoubtHtml(easyExplanation)}</p>
                </div>
              </div>
            `
            : ""
        }

      </div>
    </div>
  `;
}

function showSolution(doubt) {
  const panel = document.querySelector("#solutionPanel");
  const content = document.querySelector("#solutionContent") || panel;

  if (!panel || !content) return;

  content.innerHTML = renderSolution(doubt);
  panel.classList.remove("hidden");
  panel.style.display = "block";

  setTimeout(() => {
    panel.scrollIntoView({
      behavior: "smooth",
      block: "start"
    });
  }, 100);
}

// =========================
// PROFILE
// =========================
async function loadDoubtProfile() {
  try {
    let user = null;

    if (typeof window.requireStudent === "function") {
      user = await window.requireStudent();
    } else {
      const data = await doubtRequest("/api/profile");
      user = data?.user || null;
    }

    if (!user) return;

    const limitText = document.querySelector("#limitText");
    const limitImage = document.querySelector("#limitImage");

    const textLeft = user.remainingText ?? user.textLeft ?? 0;
    const imageLeft = user.remainingImage ?? user.imageLeft ?? 0;

    if (limitText) limitText.textContent = textLeft;
    if (limitImage) limitImage.textContent = imageLeft;

    document.querySelectorAll("[data-text-left]").forEach((el) => {
      el.textContent = textLeft;
    });

    document.querySelectorAll("[data-image-left]").forEach((el) => {
      el.textContent = imageLeft;
    });

    localStorage.setItem("mg_user", JSON.stringify(user));
  } catch (err) {
    console.error("Profile error:", err.message);
  }
             }
// =========================
// HISTORY
// =========================
async function loadDoubtHistory() {
  const list = document.querySelector("#historyList");
  if (!list) return;

  try {
    list.innerHTML = `<div class="notice">History load ho rahi hai...</div>`;

    const data = await doubtRequest("/api/doubts/history");

    if (!data?.doubts || data.doubts.length === 0) {
      list.innerHTML = `<p class="muted">No doubts yet.</p>`;
      return;
    }

    list.innerHTML = data.doubts
      .map((d) => {
        const imageUrl = getImageUrl(d.imagePath);

        return `
          <div class="history-item card" style="margin-bottom:12px; padding:16px;">
            <div style="display:flex;justify-content:space-between;gap:10px;align-items:center;flex-wrap:wrap;">
              <strong>${escapeDoubtHtml(d.type || "text").toUpperCase()}</strong>
              <span class="badge">${escapeDoubtHtml(safeDate(d.createdAt))}</span>
            </div>

            <p style="margin-top:10px;">${escapeDoubtHtml(d.question || "Image doubt")}</p>

            ${
              imageUrl
                ? `<img src="${imageUrl}" class="history-img" alt="Doubt image">`
                : ""
            }

            <button type="button" class="btn small ghost" data-view="${escapeDoubtHtml(d.id)}">
              View Solution
            </button>
          </div>
        `;
      })
      .join("");

    list.querySelectorAll("[data-view]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const doubt = data.doubts.find(
          (d) => String(d.id) === String(btn.dataset.view)
        );

        if (doubt) {
          showSolution(doubt);
        }
      });
    });
  } catch (err) {
    console.error("History error:", err);
    list.innerHTML = `<p class="muted">History load failed.</p>`;
  }
}

// =========================
// TEXT DOUBT
// =========================
async function handleTextDoubt(e) {
  e.preventDefault();

  const form = e.target;
  const box = document.querySelector("#textMsg");
  const btn = form.querySelector("button[type='submit']");
  const oldBtnText = btn ? btn.textContent : "";

  const formData = Object.fromEntries(new FormData(form).entries());

  const question = String(formData.question || "").trim();
  const language = formData.language || "Hinglish";

  if (!question) {
    showLocalMsg(box, "Pehle question likho.", "error");
    return;
  }

  try {
    if (btn) {
      btn.disabled = true;
      btn.textContent = "Solving...";
    }

    showLocalMsg(box, "AI solve kar raha hai...", "notice");

    const panel = document.querySelector("#solutionPanel");
    const content = document.querySelector("#solutionContent") || panel;

    if (panel && content) {
      panel.classList.remove("hidden");
      panel.style.display = "block";
      content.innerHTML = `<div class="notice">AI solution generate ho raha hai...</div>`;
    }

    const data = await doubtRequest("/api/doubt/text", {
      method: "POST",
      body: JSON.stringify({
        question,
        language
      })
    });

    const doubt = data?.doubt || {
      question,
      type: "text",
      solution: data?.solution || data?.answer || ""
    };

    showLocalMsg(box, "Solved successfully", "success");
    showSolution(doubt);

    await loadDoubtProfile();
    await loadDoubtHistory();
  } catch (err) {
    showLocalMsg(box, err.message, "error");

    const panel = document.querySelector("#solutionPanel");
    const content = document.querySelector("#solutionContent") || panel;

    if (panel && content) {
      panel.classList.remove("hidden");
      panel.style.display = "block";
      content.innerHTML = `<div class="notice error">${escapeDoubtHtml(err.message)}</div>`;
    }
  } finally {
    if (btn) {
      btn.disabled = false;
      btn.textContent = oldBtnText || "Solve Text Doubt";
    }
  }
}

// =========================
// IMAGE DOUBT
// =========================
async function handleImageDoubt(e) {
  e.preventDefault();

  const form = e.target;
  const box = document.querySelector("#imageMsg");
  const btn = form.querySelector("button[type='submit']");
  const oldBtnText = btn ? btn.textContent : "";

  const fileInput =
    form.querySelector('input[name="image"]') ||
    form.querySelector('input[type="file"]');

  if (!fileInput || !fileInput.files || fileInput.files.length === 0) {
    showLocalMsg(box, "Pehle image select karo.", "error");
    return;
  }

  try {
    if (btn) {
      btn.disabled = true;
      btn.textContent = "Analyzing...";
    }

    showLocalMsg(box, "AI image analyze kar raha hai...", "notice");

    const panel = document.querySelector("#solutionPanel");
    const content = document.querySelector("#solutionContent") || panel;

    if (panel && content) {
      panel.classList.remove("hidden");
      panel.style.display = "block";
      content.innerHTML = `<div class="notice">Image solution generate ho raha hai...</div>`;
    }

    const fd = new FormData(form);

    if (!fd.get("question")) {
      fd.set("question", "Solve this maths question from image.");
    }

    if (!fd.get("language")) {
      fd.set("language", "Hinglish");
    }

    const data = await doubtRequest("/api/doubt/image", {
      method: "POST",
      body: fd
    });

    const doubt = data?.doubt || {
      question: fd.get("question") || "Image doubt",
      type: "image",
      solution: data?.solution || data?.answer || ""
    };

    showLocalMsg(box, "Solved successfully", "success");
    showSolution(doubt);

    await loadDoubtProfile();
    await loadDoubtHistory();
  } catch (err) {
    showLocalMsg(box, err.message, "error");

    const panel = document.querySelector("#solutionPanel");
    const content = document.querySelector("#solutionContent") || panel;

    if (panel && content) {
      panel.classList.remove("hidden");
      panel.style.display = "block";
      content.innerHTML = `<div class="notice error">${escapeDoubtHtml(err.message)}</div>`;
    }
  } finally {
    if (btn) {
      btn.disabled = false;
      btn.textContent = oldBtnText || "Solve Image Doubt";
    }
  }
}

// =========================
// TABS
// =========================
function initDoubtTabs() {
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
}

// =========================
// INIT
// =========================
document.addEventListener("DOMContentLoaded", async () => {
  const textForm = document.querySelector("#textDoubtForm");
  const imageForm = document.querySelector("#imageDoubtForm");

  initDoubtTabs();

  if (textForm) {
    textForm.addEventListener("submit", handleTextDoubt);
  }

  if (imageForm) {
    imageForm.addEventListener("submit", handleImageDoubt);
  }

  await loadDoubtProfile();
  await loadDoubtHistory();
});
