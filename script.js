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
// DOM READY & FORMS
// =============================
document.addEventListener("DOMContentLoaded", () => {
  const year = document.querySelector("#year");
  if (year) year.textContent = new Date().getFullYear();

  const userData = localStorage.getItem("mg_user");

  if (userData) {
    try {
      const user = JSON.parse(userData);

      document.querySelectorAll("[data-auth-name]").forEach((el) => {
        el.textContent = user.name || "Student";
      });

      document.querySelectorAll("[data-auth-mobile]").forEach((el) => {
        el.textContent = user.mobile || "";
      });
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
  // Email OR Mobile Login
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
        msg(box, err.message, "error");
      }
    });
  }

  // =============================
  // SIGNUP FORM
  // Name + Email + Mobile + Password
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
});
