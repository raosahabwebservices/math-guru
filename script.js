// ✅ FIX: URL ko ekdum sahi kiya (math-guru.onrender.com)
const API = window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1"
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
  // ✅ Yahan ensure kar rahe hain ki data sahi format mein ho
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
  el.style.display = "block"; // hidden class ki jagah direct display
}

// =============================
// SAFE FETCH WRAPPER (FIXED)
// =============================
async function request(path, options = {}) {
  const headers = {};

  // Agar body FormData nahi hai, toh JSON header dalo
  if (!(options.body instanceof FormData)) {
    headers["Content-Type"] = "application/json";
  }

  // Token attach karo
  const auth = options.admin ? adminToken() : token();
  if (auth) {
    headers["Authorization"] = `Bearer ${auth}`;
  }

  try {
    const res = await fetch(API + path, {
      ...options,
      headers: { ...headers, ...(options.headers || {}) }
    });

    // Logout if token expired (401 error)
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
// INIT USER (Login Loop Check)
// =============================
async function requireStudent() {
  if (!token()) {
    location.href = "login.html";
    return;
  }
  try {
    const data = await request("/api/profile");
    if (data && data.user) {
        setUser(data);
        return data.user;
    }
  } catch (err) {
    console.log("Auth failed, redirecting...");
    logout();
  }
}

// =============================
// DOM READY
// =============================
document.addEventListener("DOMContentLoaded", () => {
  // Footer Year
  const year = document.querySelector("#year");
  if (year) year.textContent = new Date().getFullYear();

  // Logout Buttons
  document.querySelectorAll("[data-logout]")
    .forEach(b => b.addEventListener("click", (e) => {
        e.preventDefault();
        logout();
    }));

  // Update Username in UI
  const userData = localStorage.getItem("mg_user");
  if (userData) {
    const user = JSON.parse(userData);
    document.querySelectorAll("[data-auth-name]")
      .forEach(el => {
        el.textContent = user.name || "Student";
      });
  }

  // =============================
  // LOGIN FORM FIX
  // =============================
  const login = document.querySelector("#loginForm");
  if (login) {
    login.addEventListener("submit", async e => {
      e.preventDefault();
      const box = document.querySelector("#formMsg");
      const formData = new FormData(login);
      const body = Object.fromEntries(formData.entries());

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
        msg(box, err.message, "error");
      }
    });
  }

  // Same logic for Signup
  const signup = document.querySelector("#signupForm");
  if (signup) {
    signup.addEventListener("submit", async e => {
      e.preventDefault();
      const box = document.querySelector("#formMsg");
      const body = Object.fromEntries(new FormData(signup).entries());

      try {
        const data = await request("/api/signup", {
          method: "POST",
          body: JSON.stringify(body)
        });
        setUser(data);
        location.href = "dashboard.html";
      } catch (err) {
        msg(box, err.message, "error");
      }
    });
  }
});
