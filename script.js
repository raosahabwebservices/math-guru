// ✅ URL Setup: Local aur Render dono ke liye perfect
const API = window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1"
  ? "http://localhost:3000"
  : "https://math-guru.onrender.com";

const upiId = "raos38908@okhdfcbank";
const upiUri = `upi://pay?pa=${upiId}&pn=Rao%20Sahab&am=99&cu=INR&tn=MATHS%20GURU%20Premium`;

// =============================
// TOKEN HELPERS
// =============================
function token() { return localStorage.getItem("mg_token") || ""; }
function adminToken() { return localStorage.getItem("mg_admin_token") || ""; }

function setUser(data) {
  if (data.token) {
    localStorage.setItem("mg_token", data.token);
    localStorage.setItem("token", data.token); // ✅ FIXED: Taaki baki pages ko bhi token mil jaye
  }
  if (data.user) localStorage.setItem("mg_user", JSON.stringify(data.user));
}

function logout() {
  localStorage.clear(); 
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
// SAFE FETCH WRAPPER (ENHANCED)
// =============================
async function request(path, options = {}) {
  const headers = {};
  if (!(options.body instanceof FormData)) {
    headers["Content-Type"] = "application/json";
  }

  const auth = options.admin ? adminToken() : token();
  if (auth) headers["Authorization"] = `Bearer ${auth}`;

  try {
    const res = await fetch(API + path, {
      ...options,
      headers: { ...headers, ...(options.headers || {}) }
    });

    const contentType = res.headers.get("content-type");
    if (!contentType || !contentType.includes("application/json")) {
       throw new Error("Server Error: Path not found (404)");
    }

    if (res.status === 401 && !path.includes("/login")) {
       logout();
       return;
    }

    const data = await res.json();
    if (!res.ok) throw new Error(data.message || "Request failed");
    return data;
  } catch (err) {
    console.error("Fetch Error:", err);
    throw err;
  }
}

// =============================
// ⚡ REQUIRE STUDENT (Loop Killer)
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
      // Backwards compliance sync
      localStorage.setItem("token", t);
      return data.user;
    } else {
      throw new Error("Invalid User");
    }
  } catch (err) {
    console.error("Auth check failed:", err);
    logout();
  }
}

window.requireStudent = requireStudent;

// =============================
// DOM READY & FORMS
// =============================
document.addEventListener("DOMContentLoaded", async () => {
  // Footer & Username UI
  const year = document.querySelector("#year");
  if (year) year.textContent = new Date().getFullYear();

  const userData = localStorage.getItem("mg_user");
  if (userData) {
    const user = JSON.parse(userData);
    document.querySelectorAll("[data-auth-name]").forEach(el => {
        el.textContent = user.name || "Student";
    });
  }

  // Logout Handling
  document.querySelectorAll("[data-logout]").forEach(b => b.addEventListener("click", (e) => {
      e.preventDefault();
      logout();
  }));

  // Login Form (Upgraded for Identifier)
  const login = document.querySelector("#loginForm");
  if (login) {
    login.addEventListener("submit", async e => {
      e.preventDefault();
      const box = document.querySelector("#formMsg");
      const body = Object.fromEntries(new FormData(login).entries());
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
      } catch (err) { msg(box, err.message, "error"); }
    });
  }

  // Signup Form (Upgraded for Mobile and Referrals)
  const signup = document.querySelector("#signupForm");
  if (signup) {
    signup.addEventListener("submit", async e => {
      e.preventDefault();
      const box = document.querySelector("#formMsg");
      const body = Object.fromEntries(new FormData(signup).entries());
      try {
        msg(box, "Creating account...", "notice");
        const data = await request("/api/signup", {
          method: "POST",
          body: JSON.stringify(body)
        });
        setUser(data);
        location.href = "dashboard.html";
      } catch (err) { msg(box, err.message, "error"); }
    });
  }

  // 🎁 DYNAMIC REFERRER DETECTION ON SIGNUP PAGE ENTRY
  const urlParams = new URLSearchParams(window.location.search);
  const refCode = urlParams.get('ref');
  
  const banner = document.getElementById("referrer-banner");
  const nameSpan = document.getElementById("referrer-name");
  const hiddenInput = document.getElementById("hidden-ref-code");

  if (refCode && banner && nameSpan) {
    try {
      const data = await request(`/api/referrer/${refCode}`);
      if (data.found) {
        nameSpan.innerText = data.name; 
        banner.classList.remove("hidden"); // Banner open karega
        banner.style.display = "block";   // Block handle check
        if (hiddenInput) hiddenInput.value = refCode; // Code pass inside input
      }
    } catch (err) {
      console.error("Referrer capture failed:", err);
    }
  }
});
  
