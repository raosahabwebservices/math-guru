// =========================
// CONFIG
// =========================

const ADMIN_API_BASE =
  window.location.hostname === "localhost" ||
  window.location.hostname === "127.0.0.1"
    ? "http://localhost:3000/api"
    : "https://math-guru.onrender.com/api";

let adminCache = {
  users: [],
  payments: [],
  doubts: [],
  tests: [],
  contacts: []
};

// =========================
// HELPERS
// =========================

function esc(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function adminToken() {
  return localStorage.getItem("mg_admin_token") || "";
}

function formatDate(value) {
  if (!value) return "-";

  try {
    return new Date(value).toLocaleString();
  } catch {
    return "-";
  }
}

function formatShortDate(value) {
  if (!value) return "-";

  try {
    return new Date(value).toLocaleDateString();
  } catch {
    return "-";
  }
}

function planName(planId) {
  const plans = {
    free: "Free",
    starter: "₹79 Starter",
    popular_3m: "₹199 / 3 Months",
    half_year: "₹349 / 6 Months",
    yearly: "₹699 / Year",
    unlimited: "₹299 Unlimited"
  };

  return plans[planId] || planId || "Free";
}

function getScreenshotUrl(path) {
  if (!path) return "";

  if (path.startsWith("http")) return path;

  const base =
    window.location.hostname === "localhost" ||
    window.location.hostname === "127.0.0.1"
      ? "http://localhost:3000"
      : "https://math-guru.onrender.com";

  return `${base}${path}`;
}

function showBox(id, text, type = "notice") {
  const box = document.getElementById(id);
  if (!box) return;

  box.textContent = text;
  box.className = `notice ${type}`;
  box.classList.remove("hidden");
  box.style.display = "block";
}

function setAdminView(loggedIn) {
  const loginSection = document.getElementById("adminLogin");
  const panelSection = document.getElementById("adminPanel");

  if (loginSection) loginSection.classList.toggle("hidden", loggedIn);
  if (panelSection) panelSection.classList.toggle("hidden", !loggedIn);
}

function openModal(id) {
  const modal = document.getElementById(id);
  if (modal) modal.style.display = "flex";
}

function closeModal(id) {
  const modal = document.getElementById(id);
  if (modal) modal.style.display = "none";
}

// =========================
// ADMIN REQUEST
// =========================

async function adminReq(path, options = {}) {
  const token = adminToken();

  const finalPath = path.startsWith("/api")
    ? path.replace("/api", "")
    : path;

  const res = await fetch(`${ADMIN_API_BASE}${finalPath}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options.headers || {})
    }
  });

  const contentType = res.headers.get("content-type") || "";

  if (!contentType.includes("application/json")) {
    throw new Error("Server route missing or returning HTML. Check server.js admin routes.");
  }

  const data = await res.json();

  if (!res.ok) {
    throw new Error(data.message || "Admin request failed");
  }

  return data;
}

// =========================
// LOGIN / LOGOUT
// =========================

function setupAdminLogin() {
  const form = document.getElementById("adminLoginForm");

  if (!form) return;

  form.addEventListener("submit", async (e) => {
    e.preventDefault();

    const formData = Object.fromEntries(new FormData(form));

    try {
      const data = await adminReq("/api/admin/login", {
        method: "POST",
        body: JSON.stringify(formData)
      });

      localStorage.setItem("mg_admin_token", data.token);
      localStorage.setItem("mg_admin", JSON.stringify(data.admin || {}));

      setAdminView(true);
      await loadAdminDashboard();

    } catch (err) {
      showBox("adminLoginMsg", err.message || "Admin login failed", "error");
    }
  });
}

function setupAdminLogout() {
  const btn = document.getElementById("adminLogout");

  if (!btn) return;

  btn.addEventListener("click", () => {
    localStorage.removeItem("mg_admin_token");
    localStorage.removeItem("mg_admin");
    window.location.href = "admin.html";
  });
}

// =========================
// TABS / MODALS
// =========================

function setupAdminTabs() {
  const tabs = document.querySelectorAll("[data-admin-tab]");
  const sections = document.querySelectorAll(".admin-tab-section");

  tabs.forEach((tab) => {
    tab.addEventListener("click", () => {
      const target = tab.dataset.adminTab;

      tabs.forEach((t) => t.classList.remove("active"));
      tab.classList.add("active");

      sections.forEach((section) => {
        section.classList.add("hidden");
      });

      const activeSection = document.getElementById(`tab-${target}`);
      if (activeSection) {
        activeSection.classList.remove("hidden");
      }
    });
  });
}

function setupModalCloseButtons() {
  document.querySelectorAll("[data-close-modal]").forEach((btn) => {
    btn.addEventListener("click", () => {
      closeModal(btn.dataset.closeModal);
    });
  });

  document.querySelectorAll(".modal-backdrop").forEach((backdrop) => {
    backdrop.addEventListener("click", (e) => {
      if (e.target === backdrop) {
        backdrop.style.display = "none";
      }
    });
  });
}

// =========================
// LOAD DASHBOARD
// =========================

async function loadAdminDashboard() {
  try {
    const data = await adminReq("/api/admin/dashboard");

    adminCache.users = data.users || [];
    adminCache.payments = data.payments || [];
    adminCache.doubts = data.doubts || data.recentDoubts || [];
    adminCache.tests = data.tests || [];
    adminCache.contacts = data.contacts || [];

    renderStats(data);
    renderPayments(adminCache.payments);
    renderUsers(adminCache.users);
    renderDoubts(adminCache.doubts);
    renderTests(adminCache.tests);
    renderContacts(adminCache.contacts);

  } catch (err) {
    console.error("Admin dashboard error:", err);

    localStorage.removeItem("mg_admin_token");
    setAdminView(false);

    showBox("adminLoginMsg", err.message || "Admin session expired. Login again.", "error");
  }
}

function renderStats(data) {
  const users = data.users || [];
  const payments = data.payments || [];
  const doubts = data.doubts || data.recentDoubts || [];

  const totalUsers = data.totalUsers ?? data.stats?.totalUsers ?? users.length;

  const pendingPayments =
    data.pendingPayments ??
    data.stats?.pendingPayments ??
    payments.filter((p) => (p.status || "pending") === "pending").length;

  const premiumUsers =
    data.premiumUsers ??
    data.stats?.premiumUsers ??
    users.filter((u) => u.premiumActive || (u.planId && u.planId !== "free")).length;

  const totalDoubts =
    data.totalDoubts ??
    data.stats?.totalDoubts ??
    doubts.length;

  const statUsers = document.getElementById("statUsers");
  const statPendingPayments = document.getElementById("statPendingPayments");
  const statPremiumUsers = document.getElementById("statPremiumUsers");
  const statDoubts = document.getElementById("statDoubts");

  if (statUsers) statUsers.textContent = totalUsers;
  if (statPendingPayments) statPendingPayments.textContent = pendingPayments;
  if (statPremiumUsers) statPremiumUsers.textContent = premiumUsers;
  if (statDoubts) statDoubts.textContent = totalDoubts;
}

// =========================
// RENDER PAYMENTS
// =========================

function renderPayments(payments) {
  const tbody = document.getElementById("paymentsTable");
  if (!tbody) return;

  if (!payments.length) {
    tbody.innerHTML = `<tr><td colspan="7">No payments found.</td></tr>`;
    return;
  }

  tbody.innerHTML = payments.map((p) => {
    const status = p.status || "pending";
    const userName = p.userName || p.user?.name || "-";
    const userEmail = p.userEmail || p.user?.email || "-";
    const screenshot = p.screenshotPath || p.screenshot || "";

    return `
      <tr>
        <td>
          <strong>${esc(userName)}</strong><br>
          <small>${esc(userEmail)}</small><br>
          <small>ID: ${esc(p.userId || "-")}</small>
        </td>

        <td>
          <strong>${esc(planName(p.planId))}</strong><br>
          ₹${esc(p.amount || 0)}
        </td>

        <td>${esc(p.utr || "-")}</td>

        <td>
          <span class="status ${esc(status)}">${esc(status)}</span>
        </td>

        <td>
          ${
            screenshot
              ? `<button class="mini-btn blue" type="button" onclick="openPaymentReview('${p.id}')">View</button>`
              : "-"
          }
        </td>

        <td>${formatDate(p.createdAt)}</td>

        <td>
          <div class="admin-actions">
            <button class="mini-btn blue" type="button" onclick="openPaymentReview('${p.id}')">Review</button>
            <button class="mini-btn green" type="button" onclick="approvePayment('${p.id}')">Approve</button>
            <button class="mini-btn red" type="button" onclick="rejectPayment('${p.id}')">Reject</button>
          </div>
        </td>
      </tr>
    `;
  }).join("");
}

// =========================
// RENDER USERS
// =========================

function renderUsers(users) {
  const tbody = document.getElementById("usersTable");
  if (!tbody) return;

  if (!users.length) {
    tbody.innerHTML = `<tr><td colspan="7">No users found.</td></tr>`;
    return;
  }

  tbody.innerHTML = users.map((u) => {
    const status = u.status || "active";
    const premium = u.premiumActive || (u.planId && u.planId !== "free");

    return `
      <tr>
        <td>
          <strong>${esc(u.name || "-")}</strong><br>
          <small>${esc(u.email || "-")}</small><br>
          <small>Mobile: ${esc(u.mobile || "-")}</small>
        </td>

        <td>
          Class: ${esc(u.className || u.class || "-")}<br>
          Signup: ${formatShortDate(u.createdAt)}<br>
          ID: ${esc(u.id || "-")}
        </td>

        <td>
          <strong>${esc(planName(u.planId || "free"))}</strong><br>
          Expiry: ${esc(u.planExpiry || "-")}
        </td>

        <td>
          Text: ${esc(u.textLeft ?? u.remainingText ?? "-")}<br>
          Image: ${esc(u.imageLeft ?? u.remainingImage ?? "-")}<br>
          Tests: ${esc(u.testLeft ?? u.remainingTests ?? "-")}
        </td>

        <td>
          Text Used: ${esc(u.textUsed || 0)}<br>
          Image Used: ${esc(u.imageUsed || 0)}<br>
          Tests Used: ${esc(u.testUsed || 0)}
        </td>

        <td>
          <span class="status ${premium ? "approved" : "pending"}">${premium ? "Premium" : "Free"}</span><br>
          <small>${esc(status)}</small>
        </td>

        <td>
          <div class="admin-actions">
            <button class="mini-btn blue" type="button" onclick="openUserDetails('${u.id}')">View</button>
            <button class="mini-btn purple" type="button" onclick="openUserEdit('${u.id}')">Edit</button>
            <button class="mini-btn green" type="button" onclick="manualActivate('${u.id}')">Premium</button>
            <button class="mini-btn red" type="button" onclick="deleteUserById('${u.id}')">Delete</button>
          </div>
        </td>
      </tr>
    `;
  }).join("");
    }
// =========================
// RENDER DOUBTS / TESTS / CONTACTS
// =========================

function renderDoubts(doubts) {
  const box = document.getElementById("adminDoubts");
  if (!box) return;

  if (!doubts.length) {
    box.innerHTML = "No doubts found.";
    return;
  }

  box.innerHTML = doubts.map((d) => `
    <div class="admin-section">
      <strong>${esc(d.userName || d.userEmail || d.userId || "User")}</strong>
      <p>${esc(d.question || "Image doubt")}</p>
      <p class="muted">Type: ${esc(d.type || "-")} | ${formatDate(d.createdAt)}</p>
    </div>
  `).join("");
}

function renderTests(tests) {
  const box = document.getElementById("adminTests");
  if (!box) return;

  if (!tests.length) {
    box.innerHTML = "No tests found.";
    return;
  }

  box.innerHTML = tests.map((t) => `
    <div class="admin-section">
      <strong>${esc(t.chapter || t.title || "Math Test")}</strong>
      <p>
        User: ${esc(t.userName || t.userEmail || t.userId || "-")}<br>
        Score: ${esc(t.score ?? "-")} / ${esc(t.totalQuestions ?? "-")}<br>
        Attempted: ${esc(t.attempted ?? "-")} | Time: ${esc(t.timeTaken || "-")}
      </p>
      <p class="muted">${formatDate(t.createdAt)}</p>
    </div>
  `).join("");
}

function renderContacts(contacts) {
  const box = document.getElementById("contactsList");
  if (!box) return;

  if (!contacts.length) {
    box.innerHTML = "No contact messages found.";
    return;
  }

  box.innerHTML = contacts.map((c) => `
    <div class="admin-section">
      <strong>${esc(c.name || "-")}</strong> — ${esc(c.email || "-")}
      <p>${esc(c.message || "-")}</p>
      <p class="muted">${formatDate(c.createdAt)}</p>
    </div>
  `).join("");
}

// =========================
// PAYMENT ACTIONS
// =========================

function openPaymentReview(paymentId) {
  const payment = adminCache.payments.find((p) => String(p.id) === String(paymentId));

  if (!payment) {
    alert("Payment not found");
    return;
  }

  const userName = payment.userName || payment.user?.name || "-";
  const userEmail = payment.userEmail || payment.user?.email || "-";
  const screenshot = payment.screenshotPath || payment.screenshot || "";

  document.getElementById("paymentId").value = payment.id;
  document.getElementById("paymentUser").value = `${userName} (${userEmail})`;
  document.getElementById("paymentPlan").value = planName(payment.planId);
  document.getElementById("paymentAmount").value = `₹${payment.amount || 0}`;
  document.getElementById("paymentUtr").value = payment.utr || "";
  document.getElementById("paymentAdminNote").value = payment.adminNote || "";

  const box = document.getElementById("paymentScreenshotBox");

  if (box) {
    if (screenshot) {
      const url = getScreenshotUrl(screenshot);
      box.innerHTML = `
        <a href="${url}" target="_blank">
          <img src="${url}" alt="Payment Screenshot">
        </a>
      `;
    } else {
      box.innerHTML = "No screenshot uploaded.";
    }
  }

  openModal("paymentModal");
}

async function approvePayment(paymentId) {
  if (!confirm("Payment approve karke premium activate karna hai?")) return;

  try {
    await adminReq(`/api/admin/payments/${paymentId}/approve`, {
      method: "POST",
      body: JSON.stringify({
        adminNote: document.getElementById("paymentAdminNote")?.value || ""
      })
    });

    closeModal("paymentModal");
    alert("Payment approved. Premium activated.");
    await loadAdminDashboard();

  } catch (err) {
    alert("Approve error: " + err.message);
  }
}

async function rejectPayment(paymentId) {
  if (!confirm("Payment reject karna hai?")) return;

  try {
    await adminReq(`/api/admin/payments/${paymentId}/reject`, {
      method: "POST",
      body: JSON.stringify({
        adminNote: document.getElementById("paymentAdminNote")?.value || ""
      })
    });

    closeModal("paymentModal");
    alert("Payment rejected.");
    await loadAdminDashboard();

  } catch (err) {
    alert("Reject error: " + err.message);
  }
}

function setupPaymentModalButtons() {
  const approveBtn = document.getElementById("approvePaymentBtn");
  const rejectBtn = document.getElementById("rejectPaymentBtn");

  if (approveBtn) {
    approveBtn.addEventListener("click", () => {
      const id = document.getElementById("paymentId").value;
      approvePayment(id);
    });
  }

  if (rejectBtn) {
    rejectBtn.addEventListener("click", () => {
      const id = document.getElementById("paymentId").value;
      rejectPayment(id);
    });
  }
}

// =========================
// USER ACTIONS
// =========================

function openUserDetails(userId) {
  const user = adminCache.users.find((u) => String(u.id) === String(userId));

  if (!user) {
    alert("User not found");
    return;
  }

  const box = document.getElementById("userDetailsContent");

  box.innerHTML = `
    <div class="admin-section">
      <h3>Basic Details</h3>
      <p><strong>Name:</strong> ${esc(user.name || "-")}</p>
      <p><strong>Email:</strong> ${esc(user.email || "-")}</p>
      <p><strong>Mobile:</strong> ${esc(user.mobile || "-")}</p>
      <p><strong>Class:</strong> ${esc(user.className || user.class || "-")}</p>
      <p><strong>User ID:</strong> ${esc(user.id || "-")}</p>
      <p><strong>Created:</strong> ${formatDate(user.createdAt)}</p>
    </div>

    <div class="admin-section">
      <h3>Plan Details</h3>
      <p><strong>Plan:</strong> ${esc(planName(user.planId || "free"))}</p>
      <p><strong>Premium Active:</strong> ${user.premiumActive ? "Yes" : "No"}</p>
      <p><strong>Plan Expiry:</strong> ${esc(user.planExpiry || "-")}</p>
      <p><strong>Payment Status:</strong> ${esc(user.paymentStatus || "-")}</p>
    </div>

    <div class="admin-section">
      <h3>Usage Details</h3>
      <p><strong>Text Used:</strong> ${esc(user.textUsed || 0)}</p>
      <p><strong>Image Used:</strong> ${esc(user.imageUsed || 0)}</p>
      <p><strong>Tests Used:</strong> ${esc(user.testUsed || 0)}</p>
      <p><strong>Extra Text:</strong> ${esc(user.extraText || 0)}</p>
      <p><strong>Extra Image:</strong> ${esc(user.extraImage || 0)}</p>
      <p><strong>Extra Tests:</strong> ${esc(user.extraTests || 0)}</p>
    </div>
  `;

  openModal("userDetailsModal");
}

function openUserEdit(userId) {
  const user = adminCache.users.find((u) => String(u.id) === String(userId));

  if (!user) {
    alert("User not found");
    return;
  }

  document.getElementById("editUserId").value = user.id || "";
  document.getElementById("editName").value = user.name || "";
  document.getElementById("editEmail").value = user.email || "";
  document.getElementById("editMobile").value = user.mobile || "";
  document.getElementById("editClass").value = user.className || user.class || "";
  document.getElementById("editPlanId").value = user.planId || "free";
  document.getElementById("editPlanExpiry").value = user.planExpiry
    ? String(user.planExpiry).slice(0, 10)
    : "";

  document.getElementById("editExtraText").value = user.extraText || 0;
  document.getElementById("editExtraImage").value = user.extraImage || 0;
  document.getElementById("editExtraTests").value = user.extraTests || 0;
  document.getElementById("editStatus").value = user.status || "active";
  document.getElementById("editAdminNote").value = user.adminNote || "";

  openModal("userEditModal");
}

function setupEditUserForm() {
  const form = document.getElementById("editUserForm");

  if (!form) return;

  form.addEventListener("submit", async (e) => {
    e.preventDefault();

    const userId = document.getElementById("editUserId").value;

    const payload = {
      name: document.getElementById("editName").value.trim(),
      email: document.getElementById("editEmail").value.trim(),
      mobile: document.getElementById("editMobile").value.trim(),
      className: document.getElementById("editClass").value.trim(),
      planId: document.getElementById("editPlanId").value,
      planExpiry: document.getElementById("editPlanExpiry").value,
      extraText: Number(document.getElementById("editExtraText").value || 0),
      extraImage: Number(document.getElementById("editExtraImage").value || 0),
      extraTests: Number(document.getElementById("editExtraTests").value || 0),
      status: document.getElementById("editStatus").value,
      adminNote: document.getElementById("editAdminNote").value.trim()
    };

    try {
      await adminReq(`/api/admin/users/${userId}`, {
        method: "PUT",
        body: JSON.stringify(payload)
      });

      showBox("editUserMsg", "User updated successfully.", "success");
      await loadAdminDashboard();

    } catch (err) {
      showBox("editUserMsg", err.message || "User update failed", "error");
    }
  });
}

async function manualActivate(userId) {
  if (!confirm("Is user ko premium manually activate karna hai?")) return;

  try {
    await adminReq(`/api/admin/users/${userId}/activate`, {
      method: "POST",
      body: JSON.stringify({
        planId: "popular_3m"
      })
    });

    alert("Premium activated.");
    await loadAdminDashboard();

  } catch (err) {
    alert("Manual activate error: " + err.message);
  }
}

async function deleteUserById(userId) {
  if (!confirm("User delete karna hai? Ye action risky hai.")) return;

  try {
    await adminReq(`/api/admin/users/${userId}`, {
      method: "DELETE"
    });

    closeModal("userEditModal");
    alert("User deleted.");
    await loadAdminDashboard();

  } catch (err) {
    alert("Delete error: " + err.message);
  }
}

function setupDeleteAndResetButtons() {
  const deleteBtn = document.getElementById("deleteUserBtn");
  const resetBtn = document.getElementById("resetUserUsageBtn");

  if (deleteBtn) {
    deleteBtn.addEventListener("click", () => {
      const userId = document.getElementById("editUserId").value;
      deleteUserById(userId);
    });
  }

  if (resetBtn) {
    resetBtn.addEventListener("click", async () => {
      const userId = document.getElementById("editUserId").value;

      if (!confirm("Is user ka usage reset karna hai?")) return;

      try {
        await adminReq(`/api/admin/users/${userId}/reset-usage`, {
          method: "POST"
        });

        alert("Usage reset done.");
        await loadAdminDashboard();

      } catch (err) {
        alert("Reset error: " + err.message);
      }
    });
  }
}

// =========================
// FILTERS / REFRESH
// =========================

function setupFiltersAndRefresh() {
  const refreshButtons = [
    document.getElementById("refreshPaymentsBtn"),
    document.getElementById("refreshUsersBtn"),
    document.getElementById("refreshDoubtsBtn"),
    document.getElementById("refreshTestsBtn"),
    document.getElementById("refreshContactsBtn")
  ];

  refreshButtons.forEach((btn) => {
    if (btn) btn.addEventListener("click", loadAdminDashboard);
  });

  const applyPaymentFilterBtn = document.getElementById("applyPaymentFilterBtn");
  const applyUserFilterBtn = document.getElementById("applyUserFilterBtn");

  if (applyPaymentFilterBtn) {
    applyPaymentFilterBtn.addEventListener("click", () => {
      const q = document.getElementById("paymentSearch").value.toLowerCase().trim();
      const status = document.getElementById("paymentStatusFilter").value;
      const plan = document.getElementById("paymentPlanFilter").value;

      const filtered = adminCache.payments.filter((p) => {
        const text = `${p.userName || ""} ${p.userEmail || ""} ${p.utr || ""}`.toLowerCase();

        const matchText = !q || text.includes(q);
        const matchStatus = !status || String(p.status || "pending") === status;
        const matchPlan = !plan || String(p.planId || "") === plan;

        return matchText && matchStatus && matchPlan;
      });

      renderPayments(filtered);
    });
  }

  if (applyUserFilterBtn) {
    applyUserFilterBtn.addEventListener("click", () => {
      const q = document.getElementById("userSearch").value.toLowerCase().trim();
      const plan = document.getElementById("userPlanFilter").value;
      const status = document.getElementById("userStatusFilter").value;

      const filtered = adminCache.users.filter((u) => {
        const text = `${u.name || ""} ${u.email || ""} ${u.mobile || ""} ${u.className || ""} ${u.class || ""}`.toLowerCase();

        const isPremium = u.premiumActive || (u.planId && u.planId !== "free");

        const matchText = !q || text.includes(q);
        const matchPlan = !plan || String(u.planId || "free") === plan;

        let matchStatus = true;

        if (status === "premium") matchStatus = Boolean(isPremium);
        else if (status === "free") matchStatus = !isPremium;
        else if (status) matchStatus = String(u.status || "active") === status;

        return matchText && matchPlan && matchStatus;
      });

      renderUsers(filtered);
    });
  }
}

// =========================
// INIT
// =========================

document.addEventListener("DOMContentLoaded", () => {
  setupAdminLogin();
  setupAdminLogout();
  setupAdminTabs();
  setupModalCloseButtons();
  setupPaymentModalButtons();
  setupEditUserForm();
  setupDeleteAndResetButtons();
  setupFiltersAndRefresh();

  if (adminToken()) {
    setAdminView(true);
    loadAdminDashboard();
  } else {
    setAdminView(false);
  }
});
