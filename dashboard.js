// =========================================
// 🌐 PAGE CONFIGURATION
// =========================================
// API variable ka naam PAGE_API rakha hai, taaki app.js ke API se conflict na ho
const PAGE_API =
  window.location.hostname === "localhost" ||
  window.location.hostname === "127.0.0.1"
    ? "http://localhost:3000"
    : "https://math-guru.onrender.com";

// =========================================
// HELPERS
// =========================================
function safeText(value) {
  return String(value || "").replace(/[<>&]/g, "");
}

function cleanAIResponse(text) {
  if (!text) return "";

  return String(text)
    .replace(/\\\[|\\\]|\\\(|\\\)/g, "")
    .replace(/\*\*/g, "")
    .replace(/\n\s*\n/g, "\n")
    .replace(/\n{2,}/g, "\n")
    .trim();
}

function getMsgBox(id) {
  return document.querySelector(id);
}

function showMsg(box, text, type = "notice") {
  if (typeof msg === "function") {
    msg(box, text, type);
    return;
  }

  if (!box) return;
  box.className = `notice ${type}`;
  box.textContent = text;
  box.style.display = "block";
}

// =========================================
// SOLUTION NORMALIZER
// =========================================
function normalizeSolution(solution) {
  if (!solution) {
    return {
      understanding: "Question analyzed.",
      formula: "Formula shown in solution steps.",
      solution: "No solution found.",
      finalAnswer: "Check solution steps.",
      hindi: "Upar diye gaye steps dekhein.",
      english: "See the steps above."
    };
  }

  if (typeof solution === "object") {
    return {
      understanding: solution.understanding || "Question analyzed.",
      formula: solution.formula || "Formula shown in solution steps.",
      solution: solution.solution || solution.steps || JSON.stringify(solution, null, 2),
      finalAnswer: solution.finalAnswer || solution.answer || "Check solution steps.",
      hindi: solution.hindi || "Upar diye gaye steps dekhein.",
      english: solution.english || "See the steps above."
    };
  }

  const text = String(solution);

  return {
    understanding: "Question analyzed.",
    formula: "Formula shown in solution steps.",
    solution: text,
    finalAnswer: extractFinalAnswer(text),
    hindi: "Upar diye gaye step-by-step solution ko follow karein.",
    english: "Follow the step-by-step solution above."
  };
}

function extractFinalAnswer(text) {
  const match = String(text).match(/final answer[:\s-]*(.*)/i);
  if (match && match[1]) return match[1].trim();
  return "Check final line in solution.";
}

// =========================================
// SOLUTION RENDER
// =========================================
function renderSolution(doubt) {
  const s = normalizeSolution(doubt?.solution);

  return `
    <div class="sol-container">
      <div class="sol-card">

        <h3 class="sol-title">Question Understanding:</h3>
        <p class="sol-text">${cleanAIResponse(s.understanding)}</p>

        <h3 class="sol-title">Formula Used:</h3>
        <p class="sol-text">${cleanAIResponse(s.formula)}</p>

        <h3 class="sol-title">Step-by-step Solution:</h3>
        <div
          class="sol-steps-box"
          style="white-space: pre-wrap; background:#f9f9f9; padding:15px; border-radius:8px;"
        >${cleanAIResponse(s.solution)}</div>

        <div
          class="final-ans-box"
          style="margin-top:15px; background:#e8f5e9; padding:15px; border-radius:8px; border-left:5px solid #4caf50;"
        >
          <h3 style="margin:0; color:#2e7d32;">Final Answer:</h3>
          <p style="font-size:1.2rem; font-weight:bold; margin:5px 0 0 0;">
            ${cleanAIResponse(s.finalAnswer)}
          </p>
        </div>

        <hr style="margin:20px 0; opacity:0.1;">

        <div class="explanation-grid">
          <div style="margin-bottom:15px;">
            <h3 style="color:#1976d2;">Hindi Explanation:</h3>
            <p>${cleanAIResponse(s.hindi)}</p>
          </div>

          <div>
            <h3 style="color:#1976d2;">English Explanation:</h3>
            <p>${cleanAIResponse(s.english)}</p>
          </div>
        </div>

      </div>
    </div>
  `;
}

function showSolution(doubt) {
  const panel = document.querySelector("#solutionPanel");
  const content = document.querySelector("#solutionContent");

  if (!panel || !content) {
    console.error("solutionPanel or solutionContent missing in HTML");
    return;
  }

  content.innerHTML = renderSolution(doubt);
  panel.classList.remove("hidden");
  panel.scrollIntoView({ behavior: "smooth" });
}

// =========================================
// PROFILE
// =========================================
async function loadProfileBits() {
  try {
    if (typeof window.requireStudent !== "function") {
      console.error("requireStudent missing. app.js must load before this file.");
      return null;
    }

    const user = await window.requireStudent();

    const plan = document.querySelector("#planType");
    const textLeft = document.querySelector("#textLeft");
    const imageLeft = document.querySelector("#imageLeft");
    const testLeft = document.querySelector("#testLeft");

    const limitText = document.querySelector("#limitText");
    const limitImage = document.querySelector("#limitImage");
    const limitTest = document.querySelector("#limitTest");

    if (plan) plan.textContent = user?.premiumActive ? "Premium" : "Free";
    if (textLeft) textLeft.textContent = user?.remainingText ?? 0;
    if (imageLeft) imageLeft.textContent = user?.remainingImage ?? 0;
    if (testLeft) testLeft.textContent = user?.remainingTest ?? 0;

    if (limitText) limitText.textContent = user?.remainingText ?? 0;
    if (limitImage) limitImage.textContent = user?.remainingImage ?? 0;
    if (limitTest) limitTest.textContent = user?.remainingTest ?? 0;

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
    if (typeof request !== "function") {
      list.innerHTML = `<p class="muted">request() missing. app.js pehle load karo.</p>`;
      return;
    }

    const data = await request("/api/doubts/history");

    if (!data?.doubts || data.doubts.length === 0) {
      list.innerHTML = `<p class="muted">No doubts yet. Ask your first doubt.</p>`;
      return;
    }

    list.innerHTML = data.doubts
      .map((d) => {
        return `
          <div
            class="history-item card"
            style="border:1px solid #eee; margin-bottom:10px; padding:15px;"
          >
            <span
              class="badge"
              style="background:#eee; padding:2px 8px; border-radius:4px; font-size:0.8rem;"
            >
              ${safeText(d.type).toUpperCase()}
            </span>

            <h3 style="margin:10px 0; font-size:1rem;">
              ${safeText(d.question || "Image doubt")}
            </h3>

            ${
              d.imagePath
                ? `<img
                    src="${PAGE_API}${d.imagePath}"
                    class="history-img"
                    style="max-height:120px; border-radius:12px; display:block; margin-bottom:10px;"
                  >`
                : ""
            }

            <p class="muted" style="font-size:0.8rem;">
              ${d.createdAt ? new Date(d.createdAt).toLocaleDateString() : ""}
            </p>

            <button
              type="button"
              class="btn small ghost"
              data-view="${d.id}"
              style="margin-top:10px; cursor:pointer;"
            >
              View Solution
            </button>
          </div>
        `;
      })
      .join("");

    list.querySelectorAll("[data-view]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const doubt = data.doubts.find((d) => d.id === btn.dataset.view);
        if (doubt) showSolution(doubt);
      });
    });
  } catch (err) {
    console.error("History Error:", err);
    list.textContent = "Failed to load history";
  }
}

// =========================================
// TEXT DOUBT SUBMIT
// =========================================
async function handleTextDoubtSubmit(e) {
  e.preventDefault();

  const textForm = e.target;
  const box = getMsgBox("#textMsg");

  const formData = Object.fromEntries(new FormData(textForm).entries());

  const question = String(formData.question || "").trim();
  const language = formData.language || "Hinglish";

  if (!question) {
    showMsg(box, "Pehle maths doubt likho.", "error");
    return;
  }

  const submitBtn = textForm.querySelector("button[type='submit']");

  try {
    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.textContent = "Solving...";
    }

    showMsg(box, "Solving your question...", "notice");

    const data = await request("/api/doubt/text", {
      method: "POST",
      body: JSON.stringify({
        question,
        language
      })
    });

    showMsg(box, "Solved successfully", "success");

    showSolution(data.doubt);

    await loadProfileBits();
    await loadHistory();

    // reset nahi kar rahe, taaki text gayab na ho
    // textForm.reset();

  } catch (err) {
    showMsg(box, err.message, "error");
  } finally {
    if (submitBtn) {
      submitBtn.disabled = false;
      submitBtn.textContent = "Solve Text Doubt";
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

  const fileInput = imageForm.querySelector('input[type="file"][name="image"]');

  if (!fileInput || !fileInput.files || fileInput.files.length === 0) {
    showMsg(box, "Pehle image select karo.", "error");
    return;
  }

  const submitBtn = imageForm.querySelector("button[type='submit']");

  try {
    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.textContent = "Analyzing...";
    }

    showMsg(box, "AI is analyzing the image...", "notice");

    const data = await request("/api/doubt/image", {
      method: "POST",
      body: new FormData(imageForm)
    });

    showMsg(box, "Solved successfully", "success");

    showSolution(data.doubt);

    await loadProfileBits();
    await loadHistory();

    // imageForm.reset();

  } catch (err) {
    showMsg(box, err.message, "error");
  } finally {
    if (submitBtn) {
      submitBtn.disabled = false;
      submitBtn.textContent = "Solve Image Doubt";
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
const userSelections = {};

// =========================================
// TEST GENERATOR
// =========================================
async function startTestGeneration() {
  const btn = document.querySelector("#generate-btn");
  const box = document.querySelector("#testMsg");

  const classLevel = document.querySelector("#classLevel")?.value;
  const chapter = document.querySelector("#chapter")?.value?.trim();
  const difficulty = document.querySelector("#difficulty")?.value || "Medium";
  const questionType = document.querySelector("#questionType")?.value || "Mixed";
  const numQuestions = document.querySelector("#numQuestions")?.value || "5";
  const language = document.querySelector("#language")?.value || "Hinglish";

  if (!chapter) {
    showMsg(box, "Chapter/topic enter karo.", "error");
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
    if (btn) {
      btn.disabled = true;
      btn.textContent = "AI Test ban raha hai...";
    }

    showMsg(box, "AI test generate kar raha hai. Please wait...", "notice");

    const data = await request("/api/test/generate", {
      method: "POST",
      body: JSON.stringify(payload)
    });

    activeTestId = data.testId;
    testQuestions = Array.isArray(data.questions) ? data.questions : [];

    if (testQuestions.length === 0) {
      throw new Error("AI ne questions return nahi kiye.");
    }

    const setupContainer = document.querySelector("#setup-container");
    const testContainer = document.querySelector("#test-container");
    const statusBar = document.querySelector("#test-status-bar");
    const runningChapter = document.querySelector("#running-chapter");

    if (setupContainer) setupContainer.style.display = "none";
    if (testContainer) testContainer.style.display = "block";
    if (statusBar) statusBar.style.display = "flex";
    if (runningChapter) runningChapter.textContent = `Chapter: ${chapter}`;

    renderQuestions();
    startTimer();

    showMsg(box, "Test generated successfully", "success");

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
    userSelections[idx] = null;

    const card = document.createElement("div");
    card.className = "question-card";

    const qType = q.type || "Question";

    let optionsHTML = "";

    if (Array.isArray(q.options) && q.options.length > 0) {
      optionsHTML = `
        <div class="options-container">
          ${q.options
            .map((opt, oIdx) => {
              return `
                <button
                  type="button"
                  class="option-btn"
                  id="opt-${idx}-${oIdx}"
                  onclick="selectOption(${idx}, ${oIdx}, ${JSON.stringify(opt)})"
                >
                  ${safeText(opt)}
                </button>
              `;
            })
            .join("")}
        </div>
      `;
    } else {
      optionsHTML = `
        <p style="color:#718096; font-size:14px; margin-top:10px;">
          ✍️ Is sawal ko notebook par solve karein, fir answer match karein.
        </p>
      `;
    }

    card.innerHTML = `
      <span class="q-type-badge">${safeText(qType)}</span><br>

      <strong>Q${idx + 1}: ${safeText(q.question)}</strong>

      ${optionsHTML}

      <div class="action-btns">
        <button type="button" class="btn-secondary" onclick="toggleSolution(${idx})">
          💡 Step-by-Step Solution
        </button>
      </div>

      <div class="solution-box" id="sol-${idx}" style="display:none;">
        <strong>Correct Answer / Final Output:</strong>
        ${safeText(q.correctAnswer)}<br><br>

        <strong>Solution Steps:</strong>
        <div style="white-space:pre-wrap;">
          ${cleanAIResponse(q.stepByStepSolution)}
        </div>
      </div>
    `;

    area.appendChild(card);
  });
}

// =========================================
// SELECT MCQ OPTION
// =========================================
function selectOption(qIdx, oIdx, selectedValue) {
  const selectedBtn = document.querySelector(`#opt-${qIdx}-${oIdx}`);
  if (!selectedBtn) return;

  const siblings = selectedBtn.parentNode.children;

  for (let btn of siblings) {
    btn.classList.remove("selected");
  }

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
  if (timerInterval) {
    clearInterval(timerInterval);
  }

  let finalScore = 0;
  let mcqCount = 0;

  testQuestions.forEach((q, idx) => {
    if (Array.isArray(q.options) && q.options.length > 0) {
      mcqCount++;

      const selected = String(userSelections[idx] || "").trim();
      const correct = String(q.correctAnswer || "").trim();

      if (selected && selected === correct) {
        finalScore++;
      }
    }
  });

  const mins = String(Math.floor(secondsElapsed / 60)).padStart(2, "0");
  const secs = String(secondsElapsed % 60).padStart(2, "0");
  const finalTimeStr = `${mins}:${secs}`;

  try {
    if (activeTestId) {
      await request(`/api/test/submit/${activeTestId}`, {
        method: "POST",
        body: JSON.stringify({
          score: finalScore,
          timeTaken: finalTimeStr
        })
      });
    }

    if (mcqCount > 0) {
      alert(
        `🎉 Test Completed!\nMCQ Score: ${finalScore} / ${mcqCount}\nTime Taken: ${finalTimeStr}\n\nStep-by-Step Solution open karke answers match kar sakte hain.`
      );
    } else {
      alert(
        `🎉 Test Completed!\nTime Taken: ${finalTimeStr}\n\nSolutions open karke answers match karein.`
      );
    }

    testQuestions.forEach((_, idx) => {
      const sol = document.querySelector(`#sol-${idx}`);
      if (sol) sol.style.display = "block";
    });

    await loadProfileBits();

  } catch (err) {
    alert("Score saving error: " + err.message);
  }
}

window.submitFinalTest = submitFinalTest;

// =========================================
// INIT
// =========================================
document.addEventListener("DOMContentLoaded", async () => {
  await loadProfileBits();
  await loadHistory();

  // Tabs for text/image doubt
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

  // Text form
  const textForm = document.querySelector("#textDoubtForm");
  if (textForm) {
    textForm.addEventListener("submit", handleTextDoubtSubmit);
  }

  // Image form
  const imageForm = document.querySelector("#imageDoubtForm");
  if (imageForm) {
    imageForm.addEventListener("submit", handleImageDoubtSubmit);
  }

  // Test generate button
  const generateBtn = document.querySelector("#generate-btn");
  if (generateBtn) {
    generateBtn.addEventListener("click", (e) => {
      e.preventDefault();
      startTestGeneration();
    });
  }

  // Test submit button
  const submitBtn = document.querySelector("#submit-test-btn");
  if (submitBtn) {
    submitBtn.addEventListener("click", (e) => 
