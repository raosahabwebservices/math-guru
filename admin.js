// =========================
// HELPERS
// =========================
function esc(v) {
  return String(value || "").replace(/[<>&]/g, c => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;" }[c]));
}

function adminToken() {
  return localStorage.getItem("mg_admin_token");
}

// Admin specific request handler
async function adminReq(path, options = {}) {
  const token = adminToken();
  const headers = {
    "Content-Type": "application/json",
    ...(token ? { "Authorization": `Bearer ${token}` } : {})
  };

  const res = await fetch(`${API}${path}`, { ...options, headers });
  
  // Agar response JSON nahi hai (HTML mil gaya), toh error handle karein
  const contentType = res.headers.get("content-type");
  if (!contentType || !contentType.includes("application/json")) {
    throw new Error("Server error: Path not found or Server is down.");
  }

  const data = await res.json();
  if (!res.ok) throw new Error(data.message || "Request failed");
  return data;
}

function setAdminView(loggedIn) {
  const loginSection = document.querySelector("#adminLogin");
  const panelSection = document.querySelector("#adminPanel");
  if (loginSection) loginSection.classList.toggle("hidden", loggedIn);
  if (panelSection) panelSection.classList.toggle("hidden", !loggedIn);
}

// =========================
// ACTIONS
// =========================
async function approvePayment(id, action, userId) {
  try {
    await adminReq(`/api/admin/payment/${id}`, {
      method: "PUT",
      body: JSON.stringify({ action, userId })
    });
    alert("Action successful!");
    await loadAdmin(); // Reload data
  } catch (e) {
    alert("Error: " + e.message);
  }
}

// Manual activation for users
async function manualActivate(userId) {
  if (!confirm("Activate Premium for this user?")) return;
  try {
    await adminReq(`/api/admin/activate/${userId}`, { method: "POST" });
    alert("User activated!");
    await loadAdmin();
  } catch (e) {
    alert("Error: " + e.message);
  }
}

// =========================
// DATA LOADING
// =========================
async function loadAdmin() {
  try {
    setAdminView(true);
    const [dash, pays, contacts] = await Promise.all([
      adminReq("/api/admin/dashboard"),
      adminReq("/api/admin/payments"),
      adminReq("/api/admin/contacts")
    ]);

    // Render Stats
    const stats = document.querySelector("#adminStats");
    if (stats) {
      stats.innerHTML = Object.entries(dash.stats).map(([k, v]) => `
        <div class="card">
          <p class="muted">${k.replace(/([A-Z])/g, " $1").toUpperCase()}</p>
          <div class="kpi">${v}</div>
        </div>
      `).join("");
    }

    // Render Payments
    document.querySelector("#paymentsTable").innerHTML = pays.payments.map(p => `
      <tr>
        <td>${esc(p.userName)}<br><span class="muted">${esc(p.userEmail)}</span></td>
        <td>${esc(p.utr)}</td>
        <td><span class="badge ${p.status}">${p.status}</span></td>
        <td>${p.screenshot ? `<a class="brand" target="_blank" href="${API}${p.screenshot}">View</a>` : "-"}</td>
        <td>
          <button class="btn small" onclick="approvePayment('${p.id}','approve','${p.userId}')">Approve</button>
          <button class="btn small danger" onclick="approvePayment('${p.id}','reject')">Reject</button>
        </td>
      </tr>
    `).join("") || "<tr><td colspan='5'>No payments</td></tr>";

    // Render Users
    document.querySelector("#usersTable").innerHTML = dash.users.map(u => `
      <tr>
        <td>${esc(u.name)}</td>
        <td>${esc(u.email)}</td>
        <td><span class="badge">${u.premiumActive ? "Premium" : "Free"}</span></td>
        <td>Txt: ${u.textUsed || 0}, Img: ${u.imageUsed || 0}</td>
        <td><button class="btn small ghost" onclick="manualActivate('${u.id}')">Activate</button></td>
      </tr>
    `).join("");

    // Render Doubts
    document.querySelector("#adminDoubts").innerHTML = dash.recentDoubts.map(d => `
      <div class="history-item card" style="margin-bottom:10px;">
        <span class="badge">${esc(d.type).toUpperCase()}</span> 
        <strong>${esc(d.question || "Image doubt")}</strong>
        <p class="muted">User ID: ${d.userId} | ${new Date(d.createdAt).toLocaleString()}</p>
      </div>
    `).join("") || "No doubts yet";

    // Render Contacts
    document.querySelector("#contactsList").innerHTML = contacts.contacts.map(c => `
      <div class="history-item card" style="margin-bottom:10px;">
        <strong>${esc(c.name)}</strong> (${esc(c.email)})
        <p>${esc(c.message)}</p>
        <p class="muted">${new Date(c.createdAt).toLocaleString()}</p>
      </div>
    `).join("") || "No messages";

  } catch (e) {
    console.error("Admin Load Error:", e);
    localStorage.removeItem("mg_admin_token");
    setAdminView(false);
  }
}

// =========================
// INIT & LOGIN
// =========================
document.addEventListener("DOMContentLoaded", () => {
  const loginForm = document.querySelector("#adminLoginForm");
  const logoutBtn = document.querySelector("#adminLogout");

  if (loginForm) {
    loginForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      const box = document.querySelector("#adminLoginMsg");
      const formData = Object.fromEntries(new FormData(e.target));

      try {
        // Direct fetch to handle login
        const res = await fetch(`${API}/api/admin/login`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(formData)
        });

        const data = await res.json();
        if (!res.ok) throw new Error(data.message || "Invalid Admin");

        localStorage.setItem("mg_admin_token", data.token);
        await loadAdmin();
      } catch (err) {
        if (box) {
            box.textContent = err.message;
            box.className = "notice error";
            box.classList.remove("hidden");
        }
      }
    });
  }

  if (logoutBtn) {
    logoutBtn.addEventListener("click", () => {
      localStorage.removeItem("mg_admin_token");
      setAdminView(false);
      window.location.reload();
    });
  }

  // Auto-load if token exists
  if (adminToken()) {
    loadAdmin();
  }
});
                               
