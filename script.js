const API = window.location.hostname === "localhost"
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
  el.classList.remove("hidden");
}

// =============================
// SAFE FETCH WRAPPER
// =============================
async function request(path, options = {}) {
  const headers = options.body instanceof FormData
    ? {}
    : { "Content-Type": "application/json" };

  const auth = options.admin ? adminToken() : token();
  if (auth) headers.Authorization = `Bearer ${auth}`;

  const res = await fetch(API + path, {
    ...options,
    headers: { ...headers, ...(options.headers || {}) }
  });

  let data = {};
  try {
    data = await res.json();
  } catch {
    throw new Error("Server error or invalid response");
  }

  if (!res.ok) {
    throw new Error(data.message || "Request failed");
  }

  return data;
}

// =============================
// INIT USER
// =============================
async function requireStudent() {
  try {
    const data = await request("/api/profile");
    setUser(data);
    return data.user;
  } catch {
    location.href = "login.html";
  }
}

// =============================
// DOM READY
// =============================
document.addEventListener("DOMContentLoaded", () => {

  const year = document.querySelector("#year");
  if (year) year.textContent = new Date().getFullYear();

  document.querySelectorAll("[data-logout]")
    .forEach(b => b.addEventListener("click", logout));

  const user = JSON.parse(localStorage.getItem("mg_user") || "null");

  document.querySelectorAll("[data-auth-name]")
    .forEach(el => {
      el.textContent = user ? user.name : "Student";
    });

  // =============================
  // SIGNUP
  // =============================
  const signup = document.querySelector("#signupForm");
  if (signup) {
    signup.addEventListener("submit", async e => {
      e.preventDefault();
      const box = document.querySelector("#formMsg");

      try {
        const data = await request("/api/signup", {
          method: "POST",
          body: JSON.stringify(Object.fromEntries(new FormData(signup)))
        });

        setUser(data);
        location.href = "dashboard.html";
      } catch (err) {
        msg(box, err.message, "error");
      }
    });
  }

  // =============================
  // LOGIN
  // =============================
  const login = document.querySelector("#loginForm");
  if (login) {
    login.addEventListener("submit", async e => {
      e.preventDefault();
      const box = document.querySelector("#formMsg");

      try {
        const data = await request("/api/login", {
          method: "POST",
          body: JSON.stringify(Object.fromEntries(new FormData(login)))
        });

        setUser(data);
        location.href = "dashboard.html";
      } catch (err) {
        msg(box, err.message, "error");
      }
    });
  }

  // =============================
  // CONTACT
  // =============================
  const contact = document.querySelector("#contactForm");
  if (contact) {
    contact.addEventListener("submit", async e => {
      e.preventDefault();
      const box = document.querySelector("#contactMsg");

      try {
        const data = await request("/api/contact", {
          method: "POST",
          body: JSON.stringify(Object.fromEntries(new FormData(contact)))
        });

        contact.reset();
        msg(box, data.message, "success");
      } catch (err) {
        msg(box, err.message, "error");
      }
    });
  }

  // =============================
  // UPI QR
  // =============================
  const qr = document.querySelector("#upiQr");
  if (qr) {
    qr.src = `https://api.qrserver.com/v1/create-qr-code/?size=420x420&data=${encodeURIComponent(upiUri)}`;
  }

  const payLink = document.querySelector("#upiPayLink");
  if (payLink) payLink.href = upiUri;
});
