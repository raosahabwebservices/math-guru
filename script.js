// ==========================================
// 🌐 VERCEL & PURE MONGODB BACKEND ENGINE SYNC
// ==========================================
// ✅ LIVE VERCEL URL INTEGRATION: Ab Render poori tarah dead hai
const API = window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1"
  ? "http://localhost:3000"
  : "https://math-guru-raosahabwebservices-projects.vercel.app";

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
    localStorage.setItem("token", data.token); // Backward compat sync
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

  // PATH CORRECTION LAYER: Pure MongoDB standard compliance double matching se rokne ke liye
  let cleanPath = path;
  if (!path.startsWith("/api/")) {
    cleanPath = `/api${path.startsWith('/') ? '' : '/'}${path}`;
  }

  try {
    const res = await fetch(API + cleanPath, {
      ...options,
      headers: { ...headers, ...(options.headers || {}) }
    });

    const contentType = res.headers.get("content-type");
    if (!contentType || !contentType.includes("application/json")) {
       throw new Error("Server Response Error: Make sure your Vercel deployment is successful.");
    }

    if (res.status === 401 && !cleanPath.includes("/auth/login")) {
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
window.request = request;

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
    // Backend profile target route call matching with server.js
    const data = await request("/api/profile");
    if (data && data.user) {
      localStorage.setItem("mg_user", JSON.stringify(data.user));
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
document.addEventListener("DOMContentLoaded", () => {
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

  // 🔐 MONGODB ATALS LOGIN FORM ROUTING MATCH
  const login = document.querySelector("#loginForm");
  if (login) {
    login.addEventListener("submit", async e => {
      e.preventDefault();
      const box = document.querySelector("#formMsg");
      const body = Object.fromEntries(new FormData(login).entries());
      try {
        msg(box, "Logging in...", "notice");
        // ✅ FIXED: Changed route path from /api/login to naye MongoDB /api/auth/login standard par
        const data = await request("/api/auth/login", {
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

  // 🎁 MONGODB ATLAS SIGNUP FORM ROUTING MATCH
  const signup = document.querySelector("#signupForm");
  if (signup) {
    signup.addEventListener("submit", async e => {
      e.preventDefault();
      const box = document.querySelector("#formMsg");
      const body = Object.fromEntries(new FormData(signup).entries());
      try {
        msg(box, "Creating account...", "notice");
        // ✅ FIXED: Changed route path from /api/signup to naye MongoDB /api/auth/signup standard par
        const data = await request("/api/auth/signup", {
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
});
      
