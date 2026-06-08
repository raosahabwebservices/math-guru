// ==========================================
// 🌐 MATH GURU FRONTEND API ENGINE
// Vercel Backend + Local Backend Support
// ==========================================

const API =
  window.location.hostname === "localhost" ||
  window.location.hostname === "127.0.0.1"
    ? "http://localhost:3000"
    : "https://math-guru-raosahabwebservices-projects.vercel.app";

const upiId = "raos38908@okhdfcbank";
const upiUri = `upi://pay?pa=${upiId}&pn=Rao%20Sahab&am=99&cu=INR&tn=MATH%20GURU%20Premium`;

// =============================
// TOKEN HELPERS
// =============================
function token() {
  return localStorage.getItem("mg_token") || localStorage.getItem("token") || "";
}

function adminToken() {
  return localStorage.getItem("mg_admin_token") || "";
}

function setUser(data) {
  if (!data) return;

  if (data.token) {
    localStorage.setItem("mg_token", data.token);
    localStorage.setItem("token", data.token); // backward compatibility
  }

  if (data.user) {
    localStorage.setItem("mg_user", JSON.stringify(data.user));
  }
}

function getUser() {
  try {
    return JSON.parse(localStorage.getItem("mg_user") || "{}");
  } catch {
    return {};
  }
}

function logout() {
  localStorage.removeItem("mg_token");
  localStorage.removeItem("token");
  localStorage.removeItem("mg_user");
  localStorage.removeItem("mg_admin_token");

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
// API PATH NORMALIZER
// =============================
function normalizePath(path) {
  if (!path) return "/api";

  // Already correct
  if (path.startsWith("/api/")) return path;

  // Example: "/auth/login" => "/api/auth/login"
  if (path.startsWith("/")) return `/api${path}`;

  // Example: "auth/login" => "/api/auth/login"
  return `/api/${path}`;
}

// =============================
// SAFE FETCH WRAPPER
// =============================
async function request(path, options = {}) {
  const cleanPath = normalizePath(path);

  const headers = {};

  const isFormData = options.body instanceof FormData;

  if (!isFormData) {
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
      throw new Error(
        "Server response JSON nahi hai. Vercel deployment ya API route check karo."
      );
    }

    const data = await res.json();

    if (res.status === 401 && !cleanPath.includes("/auth/login")) {
      logout();
      return;
    }

    if (!res.ok) {
      throw new Error(data.message || "Request failed");
    }

    return data;
  } catch (err) {
    console.error("Fetch Error:", {
      api: API,
      path: cleanPath,
      error: err.message
    });

    throw err;
  }
}

window.request = request;

// =============================
// REQUIRE STUDENT AUTH
// =============================
async function requireStudent() {
  const t = token();

  if (!t) {
    logout();
    return null;
  }

  try {
    const data = await request("/api/profile");

    if (!data || !data.user) {
      throw new Error("Invalid user session");
    }

    localStorage.setItem("mg_user", JSON.stringify(data.user));
    updateUserUI(data.user);

    return data.user;
  } catch (err) {
    console.error("Auth check failed:", err.message);
    logout();
    return null;
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

  document.querySelectorAll("[data-auth-email]").forEach((el) => {
    el.textContent = user.email || "";
  });

  document.querySelectorAll("[data-auth-mobile]").forEach((el) => {
    el.textContent = user.mobile || "";
  });

  document.querySelectorAll("[data-remaining-text]").forEach((el) => {
    el.textContent = user.remainingText ?? 0;
  });

  document.querySelectorAll("[data-remaining-image]").forEach((el) => {
    el.textContent = user.remainingImage ?? 0;
  });

  document.querySelectorAll("[data-remaining-test]").forEach((el) => {
    el.textContent = user.remainingTest ?? 0;
  });
}

// =============================
// DOM READY
// =============================
document.addEventListener("DOMContentLoaded", () => {
  const year = document.querySelector("#year");
  if (year) year.textContent = new Date().getFullYear();

  const savedUser = getUser();
  updateUserUI(savedUser);

  document.querySelectorAll("[data-logout]").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      e.preventDefault();
      logout();
    });
  });

  // =============================
  // LOGIN FORM
  // =============================
  const login = document.querySelector("#loginForm");

  if (login) {
    login.addEventListener("submit", async (e) => {
      e.preventDefault();

      const box = document.querySelector("#formMsg");
      const formData = Object.fromEntries(new FormData(login).entries());

      const identifier =
        formData.identifier ||
        formData.email ||
        formData.mobile ||
        formData.login ||
        "";

      const password = formData.password || "";

      if (!identifier || !password) {
        msg(box, "Email/mobile aur password dono required hain.", "error");
        return;
      }

      const body = {
        identifier,
        password
      };

      try {
        msg(box, "Logging in...", "notice");

        const data = await request("/api/auth/login", {
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
  // =============================
  const signup = document.querySelector("#signupForm");

  if (signup) {
    signup.addEventListener("submit", async (e) => {
      e.preventDefault();

      const box = document.querySelector("#formMsg");
      const formData = Object.fromEntries(new FormData(signup).entries());

      const name = String(formData.name || "").trim();
      const email = String(formData.email || "").trim();
      const mobile = String(formData.mobile || "").trim();
      const password = String(formData.password || "");

      if (!name || !email || !mobile || !password) {
        msg(box, "Name, email, mobile aur password required hain.", "error");
        return;
      }

      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        msg(box, "Valid email enter karo.", "error");
        return;
      }

      const mobileDigits = mobile.replace(/\D/g, "");
      const cleanMobile =
        mobileDigits.length === 12 && mobileDigits.startsWith("91")
          ? mobileDigits.slice(2)
          : mobileDigits;

      if (!/^[6-9]\d{9}$/.test(cleanMobile)) {
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
        mobile: cleanMobile,
        password
      };

      try {
        msg(box, "Creating account...", "notice");

        const data = await request("/api/auth/signup", {
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
