let activeTestId = "";
let testQuestions = [];
let timerInterval = null;
let secondsElapsed = 0;
let isTestSubmitted = false;

const userAnswers = {};

/* =========================
   MESSAGE
========================= */
function showTestMsg(text, type = "notice") {
  const box = document.querySelector("#testMsg");

  if (!box) {
    alert(text);
    return;
  }

  box.className = `notice ${type}`;
  box.textContent = text;
  box.style.display = "block";
}

/* =========================
   TEXT HELPERS
========================= */
function safeText(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function normalizeAnswer(value) {
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

function getCorrectAnswer(q) {
  if (!q) return "";
  return String(q.correctAnswer || "").trim();
}

function isAnswerCorrect(userAnswer, correctAnswer) {
  const u = normalizeAnswer(userAnswer);
  const c = normalizeAnswer(correctAnswer);

  if (!u || !c) return false;

  return u === c;
}

/* =========================
   API REQUEST
========================= */
async function apiRequest(path, options = {}) {
  if (typeof request === "function") {
    return await request(path, options);
  }

  const token = localStorage.getItem("mg_token") || "";

  const API_BASE =
    window.location.hostname === "localhost" ||
    window.location.hostname === "127.0.0.1"
      ? "http://localhost:3000/api"
      : "https://math-guru.onrender.com/api";

  const finalPath = path.startsWith("/api")
    ? path.replace("/api", "")
    : path;

  const res = await fetch(API_BASE + finalPath, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${token}`,
      ...(options.headers || {})
    }
  });

  const data = await res.json();

  if (!res.ok) {
    throw new Error(data.message || "Request failed");
  }

  return data;
}

/* =========================
   GENERATE TEST
========================= */
async function startTestGeneration() {
  const token = localStorage.getItem("mg_token");

  if (!token) {
    alert("Pehle login karo.");
    window.location.href = "login.html";
    return;
  }

  const btn = document.querySelector("#generate-btn");

  const classLevel = document.querySelector("#classLevel").value;
  const chapter = document.querySelector("#chapter").value.trim();
  const difficulty = document.querySelector("#difficulty").value;
  const questionType = document.querySelector("#questionType").value;
  const numQuestions = document.querySelector("#numQuestions").value;
  const language = document.querySelector("#language").value;

  if (!chapter) {
    showTestMsg("Chapter/topic enter karo.", "error");
    return;
  }

  const payload = {
    classLevel,
    subject: "Mathematics",
    chapter,
    difficulty,
    questionType,
    numQuestions,
    language
  };

  try {
    btn.disabled = true;
    btn.textContent = "🔄 AI Test ban raha hai...";
    showTestMsg("AI test generate kar raha hai. Please wait...", "notice");

    const data = await apiRequest("/api/test/generate", {
      method: "POST",
      body: JSON.stringify(payload)
    });

    activeTestId = data.testId;
    testQuestions = Array.isArray(data.questions) ? data.questions : [];
    isTestSubmitted = false;

    if (testQuestions.length === 0) {
      throw new Error("AI ne questions return nahi kiye.");
    }

    Object.keys(userAnswers).forEach((key) => delete userAnswers[key]);

    document.querySelector("#setup-container").style.display = "none";
    document.querySelector("#test-container").style.display = "block";
    document.querySelector("#test-status-bar").style.display = "flex";
    document.querySelector("#running-chapter").textContent = `Chapter: ${chapter}`;

    const scoreBox = document.querySelector("#scoreBox");
    if (scoreBox) {
      scoreBox.style.display = "none";
      scoreBox.innerHTML = "";
    }

    const submitBtn = document.querySelector("#submit-test-btn");
    if (submitBtn) {
      submitBtn.disabled = false;
      submitBtn.textContent = "🎯 Test Submit Karo";
    }

    renderQuestions();
    startTimer();

    document.querySelector("#test-container").scrollIntoView({
      behavior: "smooth"
    });

  } catch (err) {
    showTestMsg(err.message, "error");
  } finally {
    btn.disabled = false;
    btn.textContent = "⚡ Test Generate Karo";
  }
}

/* =========================
   TIMER
========================= */
function startTimer() {
  secondsElapsed = 0;

  if (timerInterval) {
    clearInterval(timerInterval);
  }

  timerInterval = setInterval(() => {
    secondsElapsed++;

    const mins = String(Math.floor(secondsElapsed / 60)).padStart(2, "0");
    const secs = String(secondsElapsed % 60).padStart(2, "0");

    const timerBox = document.querySelector("#timer");
    if (timerBox) {
      timerBox.textContent = `⏰ Time: ${mins}:${secs}`;
    }
  }, 1000);
}

/* =========================
   RENDER QUESTIONS
========================= */
function renderQuestions() {
  const area = document.querySelector("#questions-area");
  area.innerHTML = "";

  testQuestions.forEach((q, idx) => {
    userAnswers[idx] = "";

    const card = document.createElement("div");
    card.className = "question-card";
    card.id = `question-card-${idx}`;

    const qType = q.type || "Question";
    const isMCQ = Array.isArray(q.options) && q.options.length > 0;

    let answerHTML = "";

    if (isMCQ) {
      answerHTML = `
        <div class="options-container">
          ${q.options.map((opt, oIdx) => `
            <button
              type="button"
              class="option-btn"
              id="opt-${idx}-${oIdx}"
            >
              ${safeText(opt)}
            </button>
          `).join("")}
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
        <button type="button" class="btn-secondary" onclick="toggleAnswer(${idx})">
          ✅ Final Answer Dekho
        </button>
      </div>

      <div class="solution-box" id="sol-${idx}">
        <strong>Correct Final Answer:</strong>
        ${safeText(getCorrectAnswer(q) || "Answer not available")}
      </div>
    `;

    area.appendChild(card);

    if (isMCQ) {
      q.options.forEach((opt, oIdx) => {
        const btn = card.querySelector(`#opt-${idx}-${oIdx}`);

        btn.addEventListener("click", () => {
          if (isTestSubmitted) return;
          selectOption(idx, oIdx, opt);
        });
      });
    } else {
      const textarea = card.querySelector(`#written-answer-${idx}`);

      textarea.addEventListener("input", () => {
        if (isTestSubmitted) return;
        userAnswers[idx] = textarea.value;
      });
    }
  });
}

/* =========================
   SELECT MCQ OPTION
========================= */
function selectOption(qIdx, oIdx, selectedValue) {
  const selectedBtn = document.querySelector(`#opt-${qIdx}-${oIdx}`);
  if (!selectedBtn) return;

  const allBtns = selectedBtn.parentNode.querySelectorAll(".option-btn");

  allBtns.forEach((btn) => {
    btn.classList.remove("selected");
  });

  selectedBtn.classList.add("selected");
  userAnswers[qIdx] = selectedValue;
}

/* =========================
   TOGGLE ANSWER
========================= */
function toggleAnswer(idx) {
  const box = document.querySelector(`#sol-${idx}`);
  if (!box) return;

  box.style.display = box.style.display === "block" ? "none" : "block";
}

/* =========================
   MARK MCQ RESULT
========================= */
function markMCQResult(qIdx, q) {
  const selectedAnswer = String(userAnswers[qIdx] || "").trim();
  const correctAnswer = getCorrectAnswer(q);

  const card = document.querySelector(`#question-card-${qIdx}`);
  if (!card) return;

  const buttons = card.querySelectorAll(".option-btn");

  buttons.forEach((btn) => {
    btn.disabled = true;

    const btnText = btn.textContent.trim();

    if (isAnswerCorrect(btnText, correctAnswer)) {
      btn.style.background = "#e8f5e9";
      btn.style.borderColor = "#28a745";
      btn.style.color = "#1b5e20";
    }

    if (
      selectedAnswer &&
      isAnswerCorrect(btnText, selectedAnswer) &&
      !isAnswerCorrect(selectedAnswer, correctAnswer)
    ) {
      btn.style.background = "#ffebee";
      btn.style.borderColor = "#dc3545";
      btn.style.color = "#b71c1c";
    }
  });

  const result = document.querySelector(`#result-${qIdx}`);
  if (!result) return;

  const correct = isAnswerCorrect(selectedAnswer, correctAnswer);

  if (!selectedAnswer) {
    result.innerHTML = `
      <div style="background:#fff8e1;color:#6b4e00;padding:10px;border-radius:8px;font-weight:800;">
        ⚠️ Not Attempted
      </div>
    `;
  } else if (correct) {
    result.innerHTML = `
      <div style="background:#e8f5e9;color:#1b5e20;padding:10px;border-radius:8px;font-weight:800;">
        ✅ Correct Answer
      </div>
    `;
  } else {
    result.innerHTML = `
      <div style="background:#ffebee;color:#b71c1c;padding:10px;border-radius:8px;font-weight:800;">
        ❌ Wrong Answer
      </div>
    `;
  }

  result.style.display = "block";
}

/* =========================
   MARK WRITTEN RESULT
========================= */
function markWrittenResult(qIdx, q) {
  const textarea = document.querySelector(`#written-answer-${qIdx}`);
  const result = document.querySelector(`#result-${qIdx}`);

  const userAnswer = textarea ? textarea.value.trim() : "";
  const correctAnswer = getCorrectAnswer(q);

  userAnswers[qIdx] = userAnswer;

  if (textarea) {
    textarea.disabled = true;
  }

  if (!result) return;

  if (!userAnswer) {
    result.innerHTML = `
      <div style="background:#fff8e1;color:#6b4e00;padding:10px;border-radius:8px;font-weight:800;">
        ⚠️ Not Attempted
      </div>
    `;
  } else if (isAnswerCorrect(userAnswer, correctAnswer)) {
    result.innerHTML = `
      <div style="background:#e8f5e9;color:#1b5e20;padding:10px;border-radius:8px;font-weight:800;">
        ✅ Correct Answer
      </div>
    `;
  } else {
    result.innerHTML = `
      <div style="background:#eef6ff;color:#0d47a1;padding:10px;border-radius:8px;font-weight:800;">
        📝 Written answer submitted. Final answer se match karo.
      </div>
    `;
  }

  result.style.display = "block";
}

/* =========================
   SUBMIT TEST + SCORE
========================= */
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
  let mcqAttempted = 0;
  let mcqWrong = 0;

  let writtenCount = 0;
  let writtenAttempted = 0;
  let writtenCorrect = 0;

  testQuestions.forEach((q, idx) => {
    const isMCQ = Array.isArray(q.options) && q.options.length > 0;

    if (!isMCQ) {
      const textarea = document.querySelector(`#written-answer-${idx}`);
      if (textarea) {
        userAnswers[idx] = textarea.value;
      }
    }

    const answer = String(userAnswers[idx] || "").trim();
    const correctAnswer = getCorrectAnswer(q);

    if (answer.length > 0) {
      attemptedCount++;
    }

    if (isMCQ) {
      mcqCount++;

      if (answer.length > 0) {
        mcqAttempted++;

        if (isAnswerCorrect(answer, correctAnswer)) {
          correctCount++;
        } else {
          wrongCount++;
          mcqWrong++;
        }
      }

      markMCQResult(idx, q);

    } else {
      writtenCount++;

      if (answer.length > 0) {
        writtenAttempted++;

        if (isAnswerCorrect(answer, correctAnswer)) {
          correctCount++;
          writtenCorrect++;
        }
      }

      markWrittenResult(idx, q);
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
      await apiRequest(`/api/test/submit/${activeTestId}`, {
        method: "POST",
        body: JSON.stringify({
          score: correctCount,
          scorePercent,
          attempted: attemptedCount,
          totalQuestions: testQuestions.length,
          wrongCount,
          mcqCount,
          mcqAttempted,
          mcqWrong,
          writtenCount,
          writtenAttempted,
          writtenCorrect,
          answers: userAnswers,
          timeTaken: finalTimeStr
        })
      });
    }

    showScoreBox({
      correctCount,
      scorePercent,
      attemptedCount,
      wrongCount,
      mcqCount,
      mcqAttempted,
      mcqWrong,
      writtenCount,
      writtenAttempted,
      writtenCorrect,
      finalTimeStr
    });

    testQuestions.forEach((_, idx) => {
      const sol = document.querySelector(`#sol-${idx}`);
      if (sol) {
        sol.style.display = "block";
      }
    });

    const submitBtn = document.querySelector("#submit-test-btn");
    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.textContent = "✅ Test Submitted";
    }

  } catch (err) {
    alert("Score saving error: " + err.message);
  }
}

/* =========================
   SCORE BOX UI
========================= */
function showScoreBox(stats) {
  const scoreBox = document.querySelector("#scoreBox");
  if (!scoreBox) return;

  scoreBox.innerHTML = `
    <div class="score-content">
      <div class="score-top">
        <div>
          <h3 class="score-title">🎉 Test Completed</h3>
          <p class="score-subtitle">
            Your test has been submitted. Check your score, attempted questions and final answers below.
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

        <div class="score-mini-card">
          <div class="score-mini-label">MCQ Attempted</div>
          <div class="score-mini-value">${stats.mcqAttempted}/${stats.mcqCount}</div>
        </div>

        <div class="score-mini-card">
          <div class="score-mini-label">MCQ Wrong</div>
          <div class="score-mini-value">${stats.mcqWrong}</div>
        </div>

        <div class="score-mini-card">
          <div class="score-mini-label">Written Attempted</div>
          <div class="score-mini-value">${stats.writtenAttempted}/${stats.writtenCount}</div>
        </div>

        <div class="score-mini-card">
          <div class="score-mini-label">Written Exact</div>
          <div class="score-mini-value">${stats.writtenCorrect}/${stats.writtenCount}</div>
        </div>
      </div>

      <div class="score-note">
        📝 MCQ score automatically calculate hua hai.
        Written questions me exact matching ke basis par score calculate hua hai.
        Final answers niche automatic show ho jayenge.
      </div>
    </div>
  `;

  scoreBox.style.display = "block";
  scoreBox.scrollIntoView({ behavior: "smooth" });
}

/* =========================
   EVENT LISTENERS
========================= */
document.addEventListener("DOMContentLoaded", () => {
  const generateBtn = document.querySelector("#generate-btn");
  const submitBtn = document.querySelector("#submit-test-btn");

  if (generateBtn) {
    generateBtn.addEventListener("click", startTestGeneration);
  }

  if (submitBtn) {
    submitBtn.addEventListener("click", submitFinalTest);
  }
});
