// =========================================
// 🌐 PAGE CONFIGURATION
// =========================================
const PAGE_API =
  window.location.hostname === "localhost" ||
  window.location.hostname === "127.0.0.1"
    ? "http://localhost:3000"
    : "https://math-guru.onrender.com";

// =========================================
// HELPERS
// =========================================
function pageToken() {
  return localStorage.getItem("mg_token") || "";
}

async function pageRequest(path, options = {}) {
  if (typeof window.request === "function") {
    return await window.request(path, options);
  }

  const cleanPath = path.startsWith("/api/")
    ? path
    : path.startsWith("/")
      ? `/api${path}`
      : `/api/${path}`;

  const headers = {};

  if (!(options.body instanceof FormData)) {
    headers["Content-Type"] = "application/json";
  }

  const token = pageToken();

  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  const res = await fetch(PAGE_API + cleanPath, {
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

function safeText(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function cleanAIResponse(text) {
  if (!text) return "";

  return String(text)
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
    .replace(/\\\[|\\\]|\\\(|\\\)/g, "")
    .replace(/\$/g, "")
    .replace(/\*\*/g, "")
    .replace(/#{1,6}\s?/g, "")
    .replace(/\r/g, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function getMsgBox(id) {
  return document.querySelector(id);
}

function showMsg(box, text, type = "notice") {
  if (typeof window.msg === "function") {
    window.msg(box, text, type);
    return;
  }

  if (!box) return;

  box.className = `notice ${type}`;
  box.textContent = text;
  box.style.display = "block";
  box.classList.remove("hidden");
}

function imageUrl(path) {
  const p = String(path || "").trim();

  if (!p) return "";
  if (p.startsWith("http://") || p.startsWith("https://")) return p;

  return PAGE_API + p;
}

// =========================================
// SOLUTION SECTION EXTRACTOR
// =========================================
function getSolutionSection(text, startTitle, endTitle = null) {
  const solution = cleanAIResponse(text);

  const safeStart = startTitle.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const startRegex = new RegExp(`${safeStart}\\s*`, "i");
  const startMatch = solution.match(startRegex);

  if (!startMatch) return "";

  const startIndex = startMatch.index + startMatch[0].length;
  let endIndex = solution.length;

  if (endTitle) {
    const safeEnd = endTitle.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const endRegex = new RegExp(`${safeEnd}\\s*`, "i");
    const rest = solution.slice(startIndex);
    const endMatch = rest.match(endRegex);

    if (endMatch) {
      endIndex = startIndex + endMatch.index;
    }
  }

  return solution.slice(startIndex, endIndex).trim();
}

// =========================================
// SOLUTION RENDER
// =========================================
function renderSolution(doubt) {
  const rawSolution = cleanAIResponse(
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
          <div class="sol-steps-box">${safeText(rawSolution)}</div>
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
              <div class="sol-text">${safeText(questionMeaning)}</div>
            `
            : ""
        }

        ${
          givenValues
            ? `
              <h3 class="sol-title">Given Values</h3>
              <div class="sol-text">${safeText(givenValues)}</div>
            `
            : ""
        }

        ${
          formula
            ? `
              <h3 class="sol-title">Formula / Concept</h3>
              <div class="sol-text">${safeText(formula)}</div>
            `
            : ""
        }

        ${
          steps
            ? `
              <h3 class="sol-title">Step-by-Step Solution</h3>
              <div class="sol-steps-box">${safeText(steps)}</div>
            `
            : ""
        }

        ${
          selfCheck
            ? `
              <h3 class="sol-title">Self-Check</h3>
              <div class="sol-text">${safeText(selfCheck)}</div>
            `
            : ""
        }

        ${
          finalAnswer
            ? `
              <div class="final-ans-box">
                <p class="ans-label">✅ Final Answer</p>
                <p class="ans-value">${safeText(finalAnswer)}</p>
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
                  <p>${safeText(easyExplanation)}</p>
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

  if (!panel || !content) {
    console.error("solutionPanel missing in HTML");
    return;
  }

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

// =========================================
// PROFILE
// =========================================
async function loadProfileBits() {
  try {
    let user = null;

    if (typeof window.requireStudent === "function") {
      user = await window.requireStudent();
    } else {
      const data = await pageRequest("/api/profile");
      user = data?.user || null;
    }

    if (!user) return null;

    const plan = document.querySelector("#planType");
    const textLeft = document.querySelector("#textLeft");
    const imageLeft = document.querySelector("#imageLeft");
    const testLeft = document.querySelector("#testLeft");

    const limitText = document.querySelector("#limitText");
    const limitImage = document.querySelector("#limitImage");
    const limitTest = document.querySelector("#limitTest");

    const remainingText = user.remainingText ?? user.textLeft ?? 0;
    const remainingImage = user.remainingImage ?? user.imageLeft ?? 0;
    const remainingTest = user.remainingTest ?? user.testLeft ?? 0;

    if (plan) plan.textContent = user?.premiumActive ? "Premium" : "Free";
    if (textLeft) textLeft.textContent = remainingText;
    if (imageLeft) imageLeft.textContent = remainingImage;
    if (testLeft) testLeft.textContent = remainingTest;

    if (limitText) limitText.textContent = remainingText;
    if (limitImage) limitImage.textContent = remainingImage;
    if (limitTest) limitTest.textContent = remainingTest;

    document.querySelectorAll("[data-text-left]").forEach((el) => {
      el.textContent = remainingText;
    });

    document.querySelectorAll("[data-image-left]").forEach((el) => {
      el.textContent = remainingImage;
    });

    document.querySelectorAll("[data-test-left]").forEach((el) => {
      el.textContent = remainingTest;
    });

    localStorage.setItem("mg_user", JSON.stringify(user));
    return user;
  } catch (err) {
    console.error("Profile load failed:", err.message);
    return null;
  }
}

// =========================================
// DOUBT HISTORY
// =========================================
async function loadHistory() {
  const list = document.querySelector("#historyList");
  if (!list) return;

  try {
    list.innerHTML = `<div class="notice">History load ho rahi hai...</div>`;

    const data = await pageRequest("/api/doubts/history");

    if (!data?.doubts || data.doubts.length === 0) {
      list.innerHTML = `<p class="muted">No doubts yet. Ask your first doubt.</p>`;
      return;
    }

    list.innerHTML = data.doubts
      .map((d) => {
        const img = imageUrl(d.imagePath);

        return `
          <div class="history-item card" style="margin-bottom:12px; padding:16px;">
            <div style="display:flex;justify-content:space-between;gap:10px;align-items:center;flex-wrap:wrap;">
              <span class="badge">${safeText(d.type || "text").toUpperCase()}</span>
              <span class="muted" style="font-size:0.8rem;">
                ${d.createdAt ? new Date(d.createdAt).toLocaleDateString() : ""}
              </span>
            </div>

            <h3 style="margin:10px 0; font-size:1rem;">
              ${safeText(d.question || "Image doubt")}
            </h3>

            ${
              img
                ? `<img src="${img}" class="history-img" alt="Doubt image">`
                : ""
            }

            <button
              type="button"
              class="btn small ghost"
              data-view="${safeText(d.id)}"
              style="margin-top:10px;"
            >
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

        if (doubt) showSolution(doubt);
      });
    });
  } catch (err) {
    console.error("History Error:", err);
    list.innerHTML = `<p class="muted">Failed to load history.</p>`;
  }
}

// =========================================
// TEXT DOUBT SUBMIT
// =========================================
async function handleTextDoubtSubmit(e) {
  e.preventDefault();

  const textForm = e.target;
  const box = getMsgBox("#textMsg");
  const submitBtn = textForm.querySelector("button[type='submit']");
  const oldText = submitBtn ? submitBtn.textContent : "";

  const formData = Object.fromEntries(new FormData(textForm).entries());

  const question = String(formData.question || "").trim();
  const language = formData.language || "Hinglish";

  if (!question) {
    showMsg(box, "Pehle maths doubt likho.", "error");
    return;
  }

  try {
    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.textContent = "Solving...";
    }

    showMsg(box, "Solving your question...", "notice");

    const panel = document.querySelector("#solutionPanel");
    const content = document.querySelector("#solutionContent") || panel;

    if (panel && content) {
      panel.classList.remove("hidden");
      panel.style.display = "block";
      content.innerHTML = `<div class="notice">AI solution generate ho raha hai...</div>`;
    }

    const data = await pageRequest("/api/doubt/text", {
      method: "POST",
      body: JSON.stringify({
        question,
        language
      })
    });

    const doubt = data?.doubt || {
      type: "text",
      question,
      solution: data?.solution || data?.answer || ""
    };

    showMsg(box, "Solved successfully", "success");
    showSolution(doubt);

    await loadProfileBits();
    await loadHistory();
  } catch (err) {
    showMsg(box, err.message, "error");
  } finally {
    if (submitBtn) {
      submitBtn.disabled = false;
      submitBtn.textContent = oldText || "Solve Text Doubt";
    }
  }
}

// =========================================
// IMAGE DOUBT SUBMIT
// =========================================
async function handleImageDoubtSubmit(e) {
  e.preventDefault();

  const imageForm = e.target;
  const box = getMsgBox("#imageMsg");
  const submitBtn = imageForm.querySelector("button[type='submit']");
  const oldText = submitBtn ? submitBtn.textContent : "";

  const fileInput =
    imageForm.querySelector('input[type="file"][name="image"]') ||
    imageForm.querySelector('input[type="file"]');

  if (!fileInput || !fileInput.files || fileInput.files.length === 0) {
    showMsg(box, "Pehle image select karo.", "error");
    return;
  }

  try {
    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.textContent = "Analyzing...";
    }

    showMsg(box, "AI is analyzing the image...", "notice");

    const panel = document.querySelector("#solutionPanel");
    const content = document.querySelector("#solutionContent") || panel;

    if (panel && content) {
      panel.classList.remove("hidden");
      panel.style.display = "block";
      content.innerHTML = `<div class="notice">Image solution generate ho raha hai...</div>`;
    }

    const fd = new FormData(imageForm);

    if (!fd.get("question")) {
      fd.set("question", "Solve this maths question from image.");
    }

    if (!fd.get("language")) {
      fd.set("language", "Hinglish");
    }

    const data = await pageRequest("/api/doubt/image", {
      method: "POST",
      body: fd
    });

    const doubt = data?.doubt || {
      type: "image",
      question: fd.get("question") || "Image doubt",
      solution: data?.solution || data?.answer || ""
    };

    showMsg(box, "Solved successfully", "success");
    showSolution(doubt);

    await loadProfileBits();
    await loadHistory();
  } catch (err) {
    showMsg(box, err.message, "error");
  } finally {
    if (submitBtn) {
      submitBtn.disabled = false;
      submitBtn.textContent = oldText || "Solve Image Doubt";
    }
  }
  }
// =========================================
// TEST GENERATOR STATE
// =========================================
let activeTestId = "";
let testQuestions = [];
let timerInterval = null;
let secondsElapsed = 0;
let isTestSubmitted = false;

const userSelections = {};

// =========================================
// TEST DATA EXTRACTOR
// =========================================
function extractGeneratedTest(data) {
  const testRecord = data?.test || {};
  const generatedTest = testRecord?.test || data?.test || {};

  const questions = Array.isArray(generatedTest.questions)
    ? generatedTest.questions
    : Array.isArray(testRecord.questions)
      ? testRecord.questions
      : Array.isArray(data.questions)
        ? data.questions
        : [];

  const testId = testRecord.id || data.testId || data.id || "";

  return {
    testId,
    generatedTest,
    questions
  };
}

// =========================================
// TEST GENERATOR
// =========================================
async function startTestGeneration() {
  const token = pageToken();

  if (!token) {
    alert("Pehle login karo.");
    window.location.href = "login.html";
    return;
  }

  const btn = document.querySelector("#generate-btn");
  const box = document.querySelector("#testMsg");

  const classLevel = document.querySelector("#classLevel")?.value || "";
  const chapter = document.querySelector("#chapter")?.value?.trim() || "";
  const difficulty = document.querySelector("#difficulty")?.value || "Medium";
  const questionType = document.querySelector("#questionType")?.value || "Mixed";
  const numQuestions = document.querySelector("#numQuestions")?.value || "5";
  const language = document.querySelector("#language")?.value || "Hinglish";

  if (!classLevel) {
    showMsg(box, "Class select karo.", "error");
    return;
  }

  if (!chapter) {
    showMsg(box, "Chapter/topic enter karo.", "error");
    return;
  }

  const payload = {
    classLevel,
    subject: "Mathematics",
    chapter,
    topic: chapter,
    difficulty,
    questionType,
    numQuestions,
    language
  };

  try {
    if (btn) {
      btn.disabled = true;
      btn.textContent = "AI Test ban raha hai...";
    }

    showMsg(box, "AI test generate kar raha hai. Please wait...", "notice");

    const data = await pageRequest("/api/test/generate", {
      method: "POST",
      body: JSON.stringify(payload)
    });

    const extracted = extractGeneratedTest(data);

    activeTestId = extracted.testId;
    testQuestions = extracted.questions;
    isTestSubmitted = false;

    if (!Array.isArray(testQuestions) || testQuestions.length === 0) {
      console.log("Full test response:", data);
      throw new Error("AI ne questions return nahi kiye. Backend response format check karo.");
    }

    Object.keys(userSelections).forEach((key) => delete userSelections[key]);

    const setupContainer = document.querySelector("#setup-container");
    const testContainer = document.querySelector("#test-container");
    const statusBar = document.querySelector("#test-status-bar");
    const runningChapter = document.querySelector("#running-chapter");
    const scoreBox = document.querySelector("#scoreBox");
    const submitBtn = document.querySelector("#submit-test-btn");

    if (setupContainer) setupContainer.style.display = "none";
    if (testContainer) testContainer.style.display = "block";
    if (statusBar) statusBar.style.display = "flex";

    if (runningChapter) {
      runningChapter.textContent =
        `Chapter: ${extracted.generatedTest.topic || chapter}`;
    }

    if (scoreBox) {
      scoreBox.style.display = "none";
      scoreBox.innerHTML = "";
    }

    if (submitBtn) {
      submitBtn.disabled = false;
      submitBtn.textContent = "🎯 Test Submit Karo";
    }

    renderQuestions();
    startTimer();

    showMsg(box, "Test generated successfully", "success");

    if (testContainer) {
      testContainer.scrollIntoView({ behavior: "smooth" });
    }

    await loadProfileBits();
  } catch (err) {
    showMsg(box, err.message, "error");
  } finally {
    if (btn) {
      btn.disabled = false;
      btn.textContent = "⚡ Test Generate Karo";
    }
  }
}

window.startTestGeneration = startTestGeneration;

// =========================================
// TEST TIMER
// =========================================
function startTimer() {
  secondsElapsed = 0;

  if (timerInterval) {
    clearInterval(timerInterval);
  }

  timerInterval = setInterval(() => {
    secondsElapsed++;

    const mins = String(Math.floor(secondsElapsed / 60)).padStart(2, "0");
    const secs = String(secondsElapsed % 60).padStart(2, "0");

    const timer = document.querySelector("#timer");
    if (timer) timer.textContent = `⏰ Time: ${mins}:${secs}`;
  }, 1000);
}

// =========================================
// ANSWER HELPERS
// =========================================
function normalizeTestAnswer(value) {
  return String(value || "")
    .toLowerCase()
    .trim()
    .replace(/\s+/g, " ")
    .replace(/[.,;:!?]/g, "")
    .replace(/^option\s*/i, "")
    .replace(/^[a-d]\)\s*/i, "")
    .replace(/^[a-d]\.\s*/i, "")
    .replace(/^ans\s*/i, "")
    .replace(/^answer\s*/i, "");
}

function isTestAnswerCorrect(userAnswer, correctAnswer) {
  const u = normalizeTestAnswer(userAnswer);
  const c = normalizeTestAnswer(correctAnswer);

  if (!u || !c) return false;

  return u === c;
}

// =========================================
// RENDER TEST QUESTIONS
// =========================================
function renderQuestions() {
  const area = document.querySelector("#questions-area");
  if (!area) {
    console.error("questions-area missing in HTML");
    return;
  }

  area.innerHTML = "";

  testQuestions.forEach((q, idx) => {
    userSelections[idx] = "";

    const card = document.createElement("div");
    card.className = "question-card";
    card.id = `question-card-${idx}`;

    const qType = q.type || "Question";
    const isMCQ = Array.isArray(q.options) && q.options.length > 0;

    let answerHTML = "";

    if (isMCQ) {
      answerHTML = `
        <div class="options-container">
          ${q.options
            .map((opt, oIdx) => {
              return `
                <button
                  type="button"
                  class="option-btn"
                  id="opt-${idx}-${oIdx}"
                >
                  ${safeText(opt)}
                </button>
              `;
            })
            .join("")}
        </div>
      `;
    } else {
      answerHTML = `
        <div class="answer-box">
          <label>Apna answer likho:</label>
          <textarea
            id="written-answer-${idx}"
            placeholder="Yahan apna answer likho..."
          ></textarea>
        </div>
      `;
    }

    card.innerHTML = `
      <span class="q-type-badge">${safeText(qType)}</span>

      <div class="question-text">
        Q${idx + 1}: ${safeText(q.question)}
      </div>

      ${answerHTML}

      <div class="answer-result" id="result-${idx}" style="display:none; margin-top:12px;"></div>

      <div class="action-btns">
        <button type="button" class="btn-secondary" onclick="toggleSolution(${idx})">
          💡 Final Answer Dekho
        </button>
      </div>

      <div class="solution-box" id="sol-${idx}" style="display:none;">
        <strong>Correct Final Answer:</strong>
        ${safeText(q.correctAnswer || "Answer not available")}

        ${
          q.stepByStepSolution
            ? `
              <br><br>
              <strong>Solution Steps:</strong>
              <div style="white-space:pre-wrap;">
                ${safeText(cleanAIResponse(q.stepByStepSolution))}
              </div>
            `
            : ""
        }
      </div>
    `;

    area.appendChild(card);

    if (isMCQ) {
      q.options.forEach((opt, oIdx) => {
        const btn = card.querySelector(`#opt-${idx}-${oIdx}`);

        if (btn) {
          btn.addEventListener("click", () => {
            if (isTestSubmitted) return;
            selectOption(idx, oIdx, opt);
          });
        }
      });
    } else {
      const textarea = card.querySelector(`#written-answer-${idx}`);

      if (textarea) {
        textarea.addEventListener("input", () => {
          if (isTestSubmitted) return;
          userSelections[idx] = textarea.value;
        });
      }
    }
  });
}

// =========================================
// SELECT MCQ OPTION
// =========================================
function selectOption(qIdx, oIdx, selectedValue) {
  const selectedBtn = document.querySelector(`#opt-${qIdx}-${oIdx}`);
  if (!selectedBtn) return;

  const allBtns = selectedBtn.parentNode.querySelectorAll(".option-btn");

  allBtns.forEach((btn) => {
    btn.classList.remove("selected");
  });

  selectedBtn.classList.add("selected");
  userSelections[qIdx] = selectedValue;
}

window.selectOption = selectOption;

// =========================================
// TOGGLE TEST SOLUTION
// =========================================
function toggleSolution(idx) {
  const box = document.querySelector(`#sol-${idx}`);
  if (!box) return;

  box.style.display = box.style.display === "block" ? "none" : "block";
}

window.toggleSolution = toggleSolution;

// =========================================
// SUBMIT TEST
// =========================================
async function submitFinalTest() {
  if (isTestSubmitted) return;

  if (timerInterval) {
    clearInterval(timerInterval);
  }

  isTestSubmitted = true;

  let attemptedCount = 0;
  let correctCount = 0;
  let wrongCount = 0;
  let mcqCount = 0;
  let writtenCount = 0;

  testQuestions.forEach((q, idx) => {
    const isMCQ = Array.isArray(q.options) && q.options.length > 0;

    if (!isMCQ) {
      writtenCount++;

      const textarea = document.querySelector(`#written-answer-${idx}`);

      if (textarea) {
        userSelections[idx] = textarea.value;
        textarea.disabled = true;
      }
    } else {
      mcqCount++;
    }

    const userAns = String(userSelections[idx] || "").trim();
    const correctAns = String(q.correctAnswer || "").trim();

    if (userAns) attemptedCount++;

    const resultBox = document.querySelector(`#result-${idx}`);

    if (isMCQ) {
      const card = document.querySelector(`#question-card-${idx}`);
      const buttons = card ? card.querySelectorAll(".option-btn") : [];

      buttons.forEach((btn) => {
        btn.disabled = true;

        const btnText = btn.textContent.trim();

        if (isTestAnswerCorrect(btnText, correctAns)) {
          btn.style.background = "#e8f5e9";
          btn.style.borderColor = "#28a745";
          btn.style.color = "#1b5e20";
        }

        if (
          userAns &&
          isTestAnswerCorrect(btnText, userAns) &&
          !isTestAnswerCorrect(userAns, correctAns)
        ) {
          btn.style.background = "#ffebee";
          btn.style.borderColor = "#dc3545";
          btn.style.color = "#b71c1c";
        }
      });

      if (userAns && isTestAnswerCorrect(userAns, correctAns)) {
        correctCount++;

        if (resultBox) {
          resultBox.innerHTML = `<div class="notice success">✅ Correct Answer</div>`;
          resultBox.style.display = "block";
        }
      } else if (userAns) {
        wrongCount++;

        if (resultBox) {
          resultBox.innerHTML = `<div class="notice error">❌ Wrong Answer</div>`;
          resultBox.style.display = "block";
        }
      } else {
        if (resultBox) {
          resultBox.innerHTML = `<div class="notice">⚠️ Not Attempted</div>`;
          resultBox.style.display = "block";
        }
      }
    } else {
      if (userAns && isTestAnswerCorrect(userAns, correctAns)) {
        correctCount++;

        if (resultBox) {
          resultBox.innerHTML = `<div class="notice success">✅ Correct Answer</div>`;
          resultBox.style.display = "block";
        }
      } else if (userAns) {
        if (resultBox) {
          resultBox.innerHTML = `<div class="notice">📝 Written answer submitted. Final answer se match karo.</div>`;
          resultBox.style.display = "block";
        }
      } else {
        if (resultBox) {
          resultBox.innerHTML = `<div class="notice">⚠️ Not Attempted</div>`;
          resultBox.style.display = "block";
        }
      }
    }
  });

  const mins = String(Math.floor(secondsElapsed / 60)).padStart(2, "0");
  const secs = String(secondsElapsed % 60).padStart(2, "0");
  const finalTimeStr = `${mins}:${secs}`;

  const scorePercent =
    testQuestions.length > 0
      ? Math.round((correctCount / testQuestions.length) * 100)
      : 0;

  try {
    if (activeTestId) {
      await pageRequest(`/api/test/submit/${activeTestId}`, {
        method: "POST",
        body: JSON.stringify({
          score: correctCount,
          scorePercent,
          attempted: attemptedCount,
          totalQuestions: testQuestions.length,
          wrongCount,
          mcqCount,
          writtenCount,
          answers: userSelections,
          timeTaken: finalTimeStr
        })
      });
    }

    showScoreBox({
      correctCount,
      scorePercent,
      attemptedCount,
      wrongCount,
      finalTimeStr
    });

    testQuestions.forEach((_, idx) => {
      const sol = document.querySelector(`#sol-${idx}`);
      if (sol) sol.style.display = "block";
    });

    const submitBtn = document.querySelector("#submit-test-btn");

    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.textContent = "✅ Test Submitted";
    }

    await loadProfileBits();
  } catch (err) {
    alert("Score saving error: " + err.message);
  }
}

window.submitFinalTest = submitFinalTest;

// =========================================
// SCORE BOX
// =========================================
function showScoreBox(stats) {
  const scoreBox = document.querySelector("#scoreBox");

  if (!scoreBox) {
    alert(
      `🎉 Test Completed!\nScore: ${stats.correctCount}/${testQuestions.length}\nTime: ${stats.finalTimeStr}`
    );
    return;
  }

  scoreBox.innerHTML = `
    <div class="score-content">
      <div class="score-top">
        <div>
          <h3 class="score-title">🎉 Test Completed</h3>
          <p class="score-subtitle">
            Test submit ho gaya. Niche final answers automatic show ho gaye hain.
          </p>
        </div>

        <div class="score-circle">
          <div class="score-percent">${stats.scorePercent}%</div>
          <div class="score-label">SCORE</div>
        </div>
      </div>

      <div class="score-main-grid">
        <div class="score-mini-card">
          <div class="score-mini-label">Score</div>
          <div class="score-mini-value">${stats.correctCount}/${testQuestions.length}</div>
        </div>

        <div class="score-mini-card">
          <div class="score-mini-label">Attempted</div>
          <div class="score-mini-value">${stats.attemptedCount}/${testQuestions.length}</div>
        </div>

        <div class="score-mini-card">
          <div class="score-mini-label">Wrong</div>
          <div class="score-mini-value">${stats.wrongCount}</div>
        </div>

        <div class="score-mini-card">
          <div class="score-mini-label">Time</div>
          <div class="score-mini-value">${stats.finalTimeStr}</div>
        </div>
      </div>

      <div class="score-note">
        📝 MCQ auto-check hua hai. Written answers me exact match ke basis par check hua hai.
      </div>
    </div>
  `;

  scoreBox.style.display = "block";
  scoreBox.scrollIntoView({ behavior: "smooth", block: "start" });
}

// =========================================
// INIT
// =========================================
document.addEventListener("DOMContentLoaded", async () => {
  await loadProfileBits();
  await loadHistory();

  document.querySelectorAll("[data-tab]").forEach((tab) => {
    tab.addEventListener("click", () => {
      document.querySelectorAll(".tab").forEach((t) => {
        t.classList.remove("active");
      });

      tab.classList.add("active");

      const textDoubtForm = document.querySelector("#textDoubtForm");
      const imageDoubtForm = document.querySelector("#imageDoubtForm");

      if (textDoubtForm) {
        textDoubtForm.classList.toggle("hidden", tab.dataset.tab !== "text");
      }

      if (imageDoubtForm) {
        imageDoubtForm.classList.toggle("hidden", tab.dataset.tab !== "image");
      }
    });
  });

  const textForm = document.querySelector("#textDoubtForm");

  if (textForm) {
    textForm.addEventListener("submit", handleTextDoubtSubmit);
  }

  const imageForm = document.querySelector("#imageDoubtForm");

  if (imageForm) {
    imageForm.addEventListener("submit", handleImageDoubtSubmit);
  }

  const generateBtn = document.querySelector("#generate-btn");

  if (generateBtn) {
    generateBtn.addEventListener("click", (e) => {
      e.preventDefault();
      startTestGeneration();
    });
  }

  const submitBtn = document.querySelector("#submit-test-btn");

  if (submitBtn) {
    submitBtn.addEventListener("click", (e) => {
      e.preventDefault();
      submitFinalTest();
    });
  }
});
