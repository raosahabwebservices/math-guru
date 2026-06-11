// ✅ URL Setup: Local aur Render dono ke liye
const API =
  window.location.hostname === "localhost" ||
  window.location.hostname === "127.0.0.1"
    ? "http://localhost:3000"
    : "https://math-guru.onrender.com";

const upiId = "raos38908@okhdfcbank";
const upiUri = `upi://pay?pa=${upiId}&pn=Rao%20Sahab&am=99&cu=INR&tn=MATHS%20GURU%20Premium`;

// =============================
// TOKEN HELPERS
// =============================
function token() {
  return localStorage.getItem("mg_token") || "";
}

function adminToken() {
  return localStorage.getItem("mg_admin_token") || "";
}

function setUser(data) {
  if (data.token) localStorage.setItem("mg_token", data.token);
  if (data.user) localStorage.setItem("mg_user", JSON.stringify(data.user));
}

function logout() {
  localStorage.removeItem("mg_token");
  localStorage.removeItem("mg_user");
  location.href = "login.html";
}

// =============================
// UI MESSAGE
// =============================
function msg(el, text, type = "notice") {
  if (!el) return;
  el.className = `notice ${type}`;
  el.textContent = text;
  el.style.display = "block";
}

// =============================
// AI SOLUTION BEAUTIFUL RENDERER
// =============================
function escapeHtml(text) {
  return String(text || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function cleanSolutionText(text) {
  return String(text || "")
    .replace(/\r/g, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function getSection(solution, startTitle, endTitle = null) {
  const text = cleanSolutionText(solution);

  const startRegex = new RegExp(
    `${startTitle.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\s*`,
    "i"
  );

  const startMatch = text.match(startRegex);
  if (!startMatch) return "";

  const startIndex = startMatch.index + startMatch[0].length;
  let endIndex = text.length;

  if (endTitle) {
    const endRegex = new RegExp(
      `${endTitle.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\s*`,
      "i"
    );

    const rest = text.slice(startIndex);
    const endMatch = rest.match(endRegex);

    if (endMatch) {
      endIndex = startIndex + endMatch.index;
    }
  }

  return text.slice(startIndex, endIndex).trim();
}

function renderAISolution(solutionText) {
  const solution = cleanSolutionText(solutionText);

  const questionMeaning = getSection(solution, "1. Question Meaning", "2. Given Values");
  const givenValues = getSection(solution, "2. Given Values", "3. Formula / Concept");
  const formula = getSection(solution, "3. Formula / Concept", "4. Step-by-Step Solution");
  const steps = getSection(solution, "4. Step-by-Step Solution", "5. Self-Check");
  const selfCheck = getSection(solution, "5. Self-Check", "6. Final Answer");
  const finalAnswer = getSection(solution, "6. Final Answer", "7. Easy Explanation");
  const easyExplanation = getSection(solution, "7. Easy Explanation");

  if (
    !questionMeaning &&
    !givenValues &&
    !formula &&
    !steps &&
    !selfCheck &&
    !finalAnswer &&
    !easyExplanation
  ) {
    return `
      <div class="sol-container">
        <div class="sol-card">
          <h3 class="sol-title">AI Solution</h3>
          <div class="sol-steps-box">${escapeHtml(solution)}</div>
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
              <div class="sol-text">${escapeHtml(questionMeaning)}</div>
            `
            : ""
        }

        ${
          givenValues
            ? `
              <h3 class="sol-title">Given Values</h3>
              <div class="sol-text">${escapeHtml(givenValues)}</div>
            `
            : ""
        }

        ${
          formula
            ? `
              <h3 class="sol-title">Formula / Concept</h3>
              <div class="sol-text">${escapeHtml(formula)}</div>
            `
            : ""
        }

        ${
          steps
            ? `
              <h3 class="sol-title">Step-by-Step Solution</h3>
              <div class="sol-steps-box">${escapeHtml(steps)}</div>
            `
            : ""
        }

        ${
          selfCheck
            ? `
              <h3 class="sol-title">Self-Check</h3>
              <div class="sol-text">${escapeHtml(selfCheck)}</div>
            `
            : ""
        }

        ${
          finalAnswer
            ? `
              <div class="final-ans-box">
                <p class="ans-label">✅ Final Answer</p>
                <p class="ans-value">${escapeHtml(finalAnswer)}</p>
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
                  <p>${escapeHtml(easyExplanation)}</p>
                </div>
              </div>
            `
            : ""
        }

      </div>
    </div>
  `;
}

function showAISolution(targetEl, solutionText) {
  if (!targetEl) return;

  targetEl.classList.remove("hidden");
  targetEl.innerHTML = renderAISolution(solutionText);

  setTimeout(() => {
    targetEl.scrollIntoView({
      behavior: "smooth",
      block: "start"
    });
  }, 100);
    }
// =============================
// PATH NORMALIZER
// =============================
function apiPath(path) {
  if (path.startsWith("/api/")) return path;
  if (path.startsWith("/")) return `/api${path}`;
  return `/api/${path}`;
}

// =============================
// SAFE FETCH WRAPPER
// =============================
async function request(path, options = {}) {
  const cleanPath = apiPath(path);

  const headers = {};

  if (!(options.body instanceof FormData)) {
    headers["Content-Type"] = "application/json";
  }

  const auth = options.admin ? adminToken() : token();

  if (auth) {
    headers["Authorization"] = `Bearer ${auth}`;
  }

  try {
    const res = await fetch(API + cleanPath, {
      ...options,
      headers: {
        ...headers,
        ...(options.headers || {})
      }
    });

    const contentType = res.headers.get("content-type") || "";

    if (!contentType.includes("application/json")) {
      throw new Error("Server Error: API route not found or Render server issue");
    }

    const data = await res.json();

    if (res.status === 401 && !cleanPath.includes("/login")) {
      logout();
      return;
    }

    if (!res.ok) {
      throw new Error(data.message || "Request failed");
    }

    return data;
  } catch (err) {
    console.error("Fetch Error:", err);
    throw err;
  }
}

window.request = request;

// =============================
// REQUIRE STUDENT
// =============================
async function requireStudent() {
  const t = token();

  if (!t) {
    logout();
    return;
  }

  try {
    const data = await request("/api/profile");

    if (data && data.user) {
      localStorage.setItem("mg_user", JSON.stringify(data.user));
      return data.user;
    }

    throw new Error("Invalid User");
  } catch (err) {
    console.error("Auth check failed:", err);
    logout();
  }
}

window.requireStudent = requireStudent;

// =============================
// USER UI UPDATE
// =============================
function updateUserUI(user) {
  if (!user) return;

  document.querySelectorAll("[data-auth-name]").forEach((el) => {
    el.textContent = user.name || "Student";
  });

  document.querySelectorAll("[data-auth-mobile]").forEach((el) => {
    el.textContent = user.mobile || "";
  });

  document.querySelectorAll("[data-text-left]").forEach((el) => {
    el.textContent = user.textLeft ?? user.remainingText ?? 0;
  });

  document.querySelectorAll("[data-image-left]").forEach((el) => {
    el.textContent = user.imageLeft ?? user.remainingImage ?? 0;
  });

  document.querySelectorAll("[data-test-left]").forEach((el) => {
    el.textContent = user.testLeft ?? user.remainingTest ?? 0;
  });

  document.querySelectorAll("[data-plan]").forEach((el) => {
    el.textContent = user.premiumActive ? user.planId || "Premium" : "Free";
  });
}

// =============================
// HISTORY RENDER
// =============================
function renderHistory(listEl, doubts = []) {
  if (!listEl) return;

  if (!Array.isArray(doubts) || doubts.length === 0) {
    listEl.innerHTML = `<p class="muted">Abhi koi doubt history nahi hai.</p>`;
    return;
  }

  listEl.innerHTML = doubts
    .map((d) => {
      return `
        <div class="history-item">
          ${
            d.imagePath
              ? `<img class="history-img" src="${API}${d.imagePath}" alt="Doubt image">`
              : ""
          }
          <p><strong>Type:</strong> ${escapeHtml(d.type || "text")}</p>
          <p><strong>Question:</strong> ${escapeHtml(d.question || "")}</p>
          <details>
            <summary><strong>View Solution</strong></summary>
            <div class="ai-output">${escapeHtml(d.solution || "")}</div>
          </details>
        </div>
      `;
    })
    .join("");
}

// =============================
// TEST RENDER
// =============================
function renderGeneratedTest(targetEl, testData) {
  if (!targetEl) return;

  const test = testData?.test || testData;
  const innerTest = test?.test || test;

  const questions = innerTest?.questions || [];

  if (!Array.isArray(questions) || questions.length === 0) {
    targetEl.classList.remove("hidden");
    targetEl.innerHTML = `<div class="notice error">Test generator me questions nahi aaye.</div>`;
    return;
  }

  targetEl.classList.remove("hidden");

  targetEl.innerHTML = `
    <div class="card">
      <h2 class="section-title">${escapeHtml(innerTest.title || "Generated Test")}</h2>
      <p class="muted">
        Class: ${escapeHtml(innerTest.classLevel || "")} |
        Topic: ${escapeHtml(innerTest.topic || "")} |
        Total Marks: ${escapeHtml(innerTest.totalMarks || questions.length)}
      </p>

      <div style="display:grid;gap:14px;margin-top:18px;">
        ${questions
          .map((q, i) => {
            return `
              <div class="exp-box english">
                <h3 class="exp-title">Q${i + 1}. ${escapeHtml(q.question || "")}</h3>

                ${
                  Array.isArray(q.options) && q.options.length
                    ? `
                      <div style="display:grid;gap:8px;margin-top:10px;">
                        ${q.options
                          .map((op) => `<div class="notice">${escapeHtml(op)}</div>`)
                          .join("")}
                      </div>
                    `
                    : ""
                }

                <details style="margin-top:10px;">
                  <summary><strong>Answer</strong></summary>
                  <p class="success notice">${escapeHtml(q.correctAnswer || "")}</p>
                </details>
              </div>
            `;
          })
          .join("")}
      </div>
    </div>
  `;

  setTimeout(() => {
    targetEl.scrollIntoView({ behavior: "smooth", block: "start" });
  }, 100);
}
// =============================
// DOM READY & FORMS
// =============================
document.addEventListener("DOMContentLoaded", () => {
  const year = document.querySelector("#year");
  if (year) year.textContent = new Date().getFullYear();

  const userData = localStorage.getItem("mg_user");

  if (userData) {
    try {
      const user = JSON.parse(userData);
      updateUserUI(user);
    } catch (err) {
      localStorage.removeItem("mg_user");
    }
  }

  document.querySelectorAll("[data-logout]").forEach((b) =>
    b.addEventListener("click", (e) => {
      e.preventDefault();
      logout();
    })
  );

  // =============================
  // LOGIN FORM
  // =============================
  const login = document.querySelector("#loginForm");

  if (login) {
    login.addEventListener("submit", async (e) => {
      e.preventDefault();

      const box = document.querySelector("#formMsg");
      const form = Object.fromEntries(new FormData(login).entries());

      const identifier = String(
        form.identifier || form.email || form.mobile || ""
      ).trim();

      const password = String(form.password || "");

      if (!identifier || !password) {
        msg(box, "Email/mobile aur password required hai.", "error");
        return;
      }

      const body = {
        identifier,
        password
      };

      try {
        msg(box, "Logging in...", "notice");

        const data = await request("/api/login", {
          method: "POST",
          body: JSON.stringify(body)
        });

        if (data.token) {
          setUser(data);
          location.href = "dashboard.html";
        }
      } catch (err) {
        if (err.message === "Invalid Credentials") {
          msg(box, "Email/mobile ya password galat hai.", "error");
        } else {
          msg(box, err.message, "error");
        }
      }
    });
  }

  // =============================
  // SIGNUP FORM
  // =============================
  const signup = document.querySelector("#signupForm");

  if (signup) {
    signup.addEventListener("submit", async (e) => {
      e.preventDefault();

      const box = document.querySelector("#formMsg");
      const form = Object.fromEntries(new FormData(signup).entries());

      const name = String(form.name || "").trim();
      const email = String(form.email || "").trim().toLowerCase();
      const mobileRaw = String(form.mobile || "").trim();
      const password = String(form.password || "");

      let mobile = mobileRaw.replace(/\D/g, "");

      if (mobile.length === 12 && mobile.startsWith("91")) {
        mobile = mobile.slice(2);
      }

      if (!name || !email || !mobile || !password) {
        msg(box, "Name, email, mobile aur password required hai.", "error");
        return;
      }

      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        msg(box, "Valid email enter karo.", "error");
        return;
      }

      if (!/^[6-9]\d{9}$/.test(mobile)) {
        msg(box, "Valid 10 digit Indian mobile number enter karo.", "error");
        return;
      }

      if (password.length < 6) {
        msg(box, "Password minimum 6 characters ka hona chahiye.", "error");
        return;
      }

      const body = {
        name,
        email,
        mobile,
        password
      };

      try {
        msg(box, "Creating account...", "notice");

        const data = await request("/api/signup", {
          method: "POST",
          body: JSON.stringify(body)
        });

        if (data.token) {
          setUser(data);
          location.href = "dashboard.html";
        }
      } catch (err) {
        msg(box, err.message, "error");
      }
    });
  }

  // =============================
  // TEXT DOUBT FORM
  // Supports ids: #textDoubtForm, #doubtForm
  // =============================
  const textDoubtForm =
    document.querySelector("#textDoubtForm") ||
    document.querySelector("#doubtForm");

  if (textDoubtForm) {
    textDoubtForm.addEventListener("submit", async (e) => {
      e.preventDefault();

      const box = document.querySelector("#formMsg") || document.querySelector("#doubtMsg");
      const solutionPanel = document.querySelector("#solutionPanel");

      const form = Object.fromEntries(new FormData(textDoubtForm).entries());

      const question = String(
        form.question || form.doubt || form.text || ""
      ).trim();

      const language = String(form.language || "Hinglish").trim();

      if (!question || question.length < 2) {
        msg(box, "Question likho.", "error");
        return;
      }

      try {
        msg(box, "AI solve kar raha hai...", "notice");

        if (solutionPanel) {
          solutionPanel.classList.remove("hidden");
          solutionPanel.innerHTML = `<div class="notice">AI solution generate ho raha hai...</div>`;
        }

        const data = await request("/api/doubt/text", {
          method: "POST",
          body: JSON.stringify({
            question,
            language
          })
        });

        if (data.user) {
          localStorage.setItem("mg_user", JSON.stringify(data.user));
          updateUserUI(data.user);
        }

        msg(box, "Doubt solved successfully.", "success");
        showAISolution(solutionPanel, data?.doubt?.solution || data?.solution || "");

      } catch (err) {
        msg(box, err.message, "error");
        if (solutionPanel) {
          solutionPanel.innerHTML = `<div class="notice error">${escapeHtml(err.message)}</div>`;
        }
      }
    });
  }

  // =============================
  // IMAGE DOUBT FORM
  // Supports ids: #imageDoubtForm, #imageForm
  // =============================
  const imageDoubtForm =
    document.querySelector("#imageDoubtForm") ||
    document.querySelector("#imageForm");

  if (imageDoubtForm) {
    imageDoubtForm.addEventListener("submit", async (e) => {
      e.preventDefault();

      const box = document.querySelector("#formMsg") || document.querySelector("#imageMsg");
      const solutionPanel = document.querySelector("#solutionPanel");

      const fd = new FormData(imageDoubtForm);

      const image =
        fd.get("image") ||
        fd.get("file") ||
        fd.get("photo");

      if (!image || !image.name) {
        msg(box, "Image upload karo.", "error");
        return;
      }

      if (!fd.get("question")) {
        fd.set("question", "Solve this maths question from image.");
      }

      if (!fd.get("language")) {
        fd.set("language", "Hinglish");
      }

      try {
        msg(box, "Image AI solve kar raha hai...", "notice");

        if (solutionPanel) {
          solutionPanel.classList.remove("hidden");
          solutionPanel.innerHTML = `<div class="notice">Image solution generate ho raha hai...</div>`;
        }

        const data = await request("/api/doubt/image", {
          method: "POST",
          body: fd
        });

        if (data.user) {
          localStorage.setItem("mg_user", JSON.stringify(data.user));
          updateUserUI(data.user);
        }

        msg(box, "Image doubt solved successfully.", "success");
        showAISolution(solutionPanel, data?.doubt?.solution || data?.solution || "");

      } catch (err) {
        msg(box, err.message, "error");
        if (solutionPanel) {
          solutionPanel.innerHTML = `<div class="notice error">${escapeHtml(err.message)}</div>`;
        }
      }
    });
        }
  // =============================
  // TEST GENERATOR FORM
  // Supports ids: #testForm, #testGeneratorForm
  // =============================
  const testForm =
    document.querySelector("#testForm") ||
    document.querySelector("#testGeneratorForm");

  if (testForm) {
    testForm.addEventListener("submit", async (e) => {
      e.preventDefault();

      const box = document.querySelector("#formMsg") || document.querySelector("#testMsg");
      const testResult =
        document.querySelector("#testResult") ||
        document.querySelector("#generatedTest") ||
        document.querySelector("#testOutput");

      const form = Object.fromEntries(new FormData(testForm).entries());

      const classLevel = form.classLevel || form.class || "";
      const subject = form.subject || "Maths";
      const chapter = form.chapter || form.topic || "";
      const difficulty = form.difficulty || "Easy";
      const questionType = form.questionType || "Mixed";
      const numQuestions = form.numQuestions || 5;
      const language = form.language || "Hinglish";

      if (!classLevel || !chapter) {
        msg(box, "Class aur chapter/topic required hai.", "error");
        return;
      }

      try {
        msg(box, "Test generate ho raha hai...", "notice");

        if (testResult) {
          testResult.classList.remove("hidden");
          testResult.innerHTML = `<div class="notice">AI test generate kar raha hai...</div>`;
        }

        const data = await request("/api/test/generate", {
          method: "POST",
          body: JSON.stringify({
            classLevel,
            subject,
            chapter,
            topic: chapter,
            difficulty,
            questionType,
            numQuestions,
            language
          })
        });

        if (data.user) {
          localStorage.setItem("mg_user", JSON.stringify(data.user));
          updateUserUI(data.user);
        }

        msg(box, "Test generated successfully.", "success");
        renderGeneratedTest(testResult, data.test || data);

      } catch (err) {
        msg(box, err.message, "error");
        if (testResult) {
          testResult.innerHTML = `<div class="notice error">${escapeHtml(err.message)}</div>`;
        }
      }
    });
  }

  // =============================
  // HISTORY LOAD
  // Button or page auto
  // =============================
  const historyList =
    document.querySelector("#historyList") ||
    document.querySelector("#doubtHistory");

  const loadHistoryBtn = document.querySelector("#loadHistoryBtn");

  async function loadHistory() {
    if (!historyList) return;

    try {
      historyList.innerHTML = `<div class="notice">History load ho rahi hai...</div>`;

      const data = await request("/api/doubts/history");

      renderHistory(historyList, data.doubts || []);
    } catch (err) {
      historyList.innerHTML = `<div class="notice error">${escapeHtml(err.message)}</div>`;
    }
  }

  if (loadHistoryBtn) {
    loadHistoryBtn.addEventListener("click", loadHistory);
  }

  if (historyList && document.body.dataset.autoHistory === "true") {
    loadHistory();
  }

  // =============================
  // PAYMENT FORM
  // Supports id: #paymentForm
  // =============================
  const paymentForm = document.querySelector("#paymentForm");

  if (paymentForm) {
    paymentForm.addEventListener("submit", async (e) => {
      e.preventDefault();

      const box = document.querySelector("#formMsg") || document.querySelector("#paymentMsg");
      const fd = new FormData(paymentForm);

      try {
        msg(box, "Payment request submit ho rahi hai...", "notice");

        const data = await request("/api/payment/request", {
          method: "POST",
          body: fd
        });

        msg(box, data.message || "Payment request submitted.", "success");
        paymentForm.reset();
      } catch (err) {
        msg(box, err.message, "error");
      }
    });
  }

  // =============================
  // UPI BUTTON
  // =============================
  document.querySelectorAll("[data-upi-pay]").forEach((btn) => {
    btn.addEventListener("click", () => {
      window.location.href = upiUri;
    });
  });
});

