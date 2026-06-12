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
  return String(value ?? "")
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

function getScreenshotUrl(filePath) {
  if (!filePath) return "";

  if (String(filePath).startsWith("http")) {
    return filePath;
  }

  const base =
    window.location.hostname === "localhost" ||
    window.location.hostname === "127.0.0.1"
      ? "http://localhost:3000"
      : "https://math-guru.onrender.com";

  return `${base}${filePath}`;
}

function showBox(id, text, type = "notice") {
  const box = document.getElementById(id);
  if (!box) return;

  box.textContent = text;
  box.className = `notice ${type}`;
  box.classList.remove("hidden");
  box.style.display = "block";
}

function hideBox(id) {
  const box = document.getElementById(id);
  if (!box) return;

  box.textContent = "";
  box.classList.add("hidden");
  box.style.display = "none";
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

function getUserClass(user) {
  return user.classLevel || user.className || user.class || "";
}

function getTestLeft(user) {
  return user.testLeft ?? user.remainingTest ?? user.remainingTests ?? "-";
}

// =========================
// ADMIN REQUEST
// =========================

async function adminReq(path, options = {}) {
  const token = adminToken();

  const finalPath = path.startsWith("/api")
    ? path.replace("/api", "")
    : path;

  const headers = {
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...(options.headers || {})
  };

  if (!(options.body instanceof FormData)) {
    headers["Content-Type"] = "application/json";
  }

  const res = await fetch(`${ADMIN_API_BASE}${finalPath}`, {
    ...options,
    headers
  });

  const contentType = res.headers.get("content-type") || "";

  if (!contentType.includes("application/json")) {
    throw new Error("Server route missing or returning HTML. Check server.js admin routes.");
  }

  const data = await res.json();

  if (res.status === 401 || res.status === 403) {
    localStorage.removeItem("mg_admin_token");
    localStorage.removeItem("mg_admin");
    throw new Error(data.message || "Admin login expired. Login again.");
  }

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
function openUserEdit(userId) {
  const user = adminCache.users.find((u) => String(u.id) === String(userId));

  if (!user) {
    alert("User not found");
    return;
  }

  hideBox("editUserMsg");

  document.getElementById("editUserId").value = user.id || "";
  document.getElementById("editName").value = user.name || "";
  document.getElementById("editEmail").value = user.email || "";
  document.getElementById("editMobile").value = user.mobile || "";
  document.getElementById("editClass").value = getUserClass(user) || "";
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
      classLevel: document.getElementById("editClass").value.trim(),
      planId: document.getElementById("editPlanId").value,
      planExpiry: document.getElementById("editPlanExpiry").value,
      premiumActive: document.getElementById("editPlanId").value !== "free",
      paymentStatus:
        document.getElementById("editPlanId").value !== "free"
          ? "approved"
          : "free",
      extraText: Number(document.getElementById("editExtraText").value || 0),
      extraImage: Number(document.getElementById("editExtraImage").value || 0),
      extraTests: Number(document.getElementById("editExtraTests").value || 0),
      status: document.getElementById("editStatus").value,
      adminNote: document.getElementById("editAdminNote").value.trim()
    };

    try {
      await adminReq(`/api/admin/user/${userId}/update`, {
        method: "POST",
        body: JSON.stringify(payload)
      });

      showBox("editUserMsg", "User updated successfully.", "success");
      await loadAdminDashboard();
    } catch (err) {
      showBox("editUserMsg", err.message || "User update failed", "error");
    }
  });
}

async function resetUserUsage() {
  const userId = document.getElementById("editUserId")?.value;

  if (!userId) {
    showBox("editUserMsg", "User ID missing.", "error");
    return;
  }

  if (!confirm("Is user ka usage reset karna hai?")) return;

  try {
    await adminReq(`/api/admin/user/${userId}/reset-usage`, {
      method: "POST"
    });

    showBox("editUserMsg", "Usage reset successfully.", "success");
    await loadAdminDashboard();

    const updatedUser = adminCache.users.find((u) => String(u.id) === String(userId));
    if (updatedUser) openUserEdit(userId);
  } catch (err) {
    showBox("editUserMsg", err.message || "Reset usage failed", "error");
  }
}

async function deleteUserFromEdit() {
  const userId = document.getElementById("editUserId")?.value;

  if (!userId) {
    showBox("editUserMsg", "User ID missing.", "error");
    return;
  }

  await deleteUserById(userId);
}

async function deleteUserById(userId) {
  if (!userId) return;

  if (!confirm("User delete karna hai? Iska account remove ho jayega.")) return;

  try {
    await adminReq(`/api/admin/user/${userId}/delete`, {
      method: "DELETE"
    });

    closeModal("userEditModal");
    alert("User deleted successfully.");
    await loadAdminDashboard();
  } catch (err) {
    showBox("editUserMsg", err.message || "Delete user failed", "error");
    alert("Delete error: " + err.message);
  }
}

async function manualActivate(userId) {
  const user = adminCache.users.find((u) => String(u.id) === String(userId));

  if (!user) {
    alert("User not found");
    return;
  }

  if (!confirm("Is user ko ₹199 / 3 Months premium activate karna hai?")) return;

  const expiry = new Date();
  expiry.setMonth(expiry.getMonth() + 3);

  const payload = {
    name: user.name || "",
    email: user.email || "",
    mobile: user.mobile || "",
    classLevel: getUserClass(user) || "",
    planId: "popular_3m",
    planExpiry: expiry.toISOString().slice(0, 10),
    premiumActive: true,
    paymentStatus: "approved",
    extraText: Number(user.extraText || 0),
    extraImage: Number(user.extraImage || 0),
    extraTests: Number(user.extraTests || 0),
    status: user.status || "active",
    adminNote: "Manual premium activated by admin"
  };

  try {
    await adminReq(`/api/admin/user/${userId}/update`, {
      method: "POST",
      body: JSON.stringify(payload)
    });

    alert("Premium activated successfully.");
    await loadAdminDashboard();
  } catch (err) {
    alert("Premium activation failed: " + err.message);
  }
}

// =========================
// FILTERS / SEARCH
// =========================

function setupUserSearch() {
  const input = document.getElementById("userSearchInput");
  const btn = document.getElementById("userFilterBtn");
  const refreshBtn = document.getElementById("refreshUsersBtn");

  function applySearch() {
    const q = String(input?.value || "").trim().toLowerCase();

    if (!q) {
      renderUsers(adminCache.users);
      return;
    }

    const filtered = adminCache.users.filter((u) => {
      return (
        String(u.name || "").toLowerCase().includes(q) ||
        String(u.email || "").toLowerCase().includes(q) ||
        String(u.mobile || "").toLowerCase().includes(q) ||
        String(u.id || "").toLowerCase().includes(q)
      );
    });

    renderUsers(filtered);
  }

  if (input) {
    input.addEventListener("input", applySearch);
  }

  if (btn) {
    btn.addEventListener("click", applySearch);
  }

  if (refreshBtn) {
    refreshBtn.addEventListener("click", loadAdminDashboard);
  }
}

function setupPaymentFilters() {
  const refreshBtn = document.getElementById("refreshPaymentsBtn");
  const statusSelect = document.getElementById("paymentStatusFilter");

  function applyFilter() {
    const status = String(statusSelect?.value || "").trim();

    if (!status || status === "all") {
      renderPayments(adminCache.payments);
      return;
    }

    const filtered = adminCache.payments.filter((p) => {
      return String(p.status || "pending") === status;
    });

    renderPayments(filtered);
  }

  if (statusSelect) {
    statusSelect.addEventListener("change", applyFilter);
  }

  if (refreshBtn) {
    refreshBtn.addEventListener("click", loadAdminDashboard);
  }
}

// =========================
// GLOBAL FUNCTIONS FOR HTML onclick
// =========================

window.openPaymentReview = openPaymentReview;
window.approvePayment = approvePayment;
window.rejectPayment = rejectPayment;

window.openUserDetails = openUserDetails;
window.openUserEdit = openUserEdit;
window.manualActivate = manualActivate;
window.deleteUserById = deleteUserById;

window.resetUserUsage = resetUserUsage;
window.deleteUserFromEdit = deleteUserFromEdit;

window.loadAdminDashboard = loadAdminDashboard;

// =========================
// INIT
// =========================

document.addEventListener("DOMContentLoaded", async () => {
  setupAdminLogin();
  setupAdminLogout();
  setupAdminTabs();
  setupModalCloseButtons();
  setupPaymentModalButtons();
  setupEditUserForm();
  setupUserSearch();
  setupPaymentFilters();

  const resetBtn = document.getElementById("resetUsageBtn");
  if (resetBtn) {
    resetBtn.addEventListener("click", resetUserUsage);
  }

  const deleteEditBtn = document.getElementById("deleteUserBtn");
  if (deleteEditBtn) {
    deleteEditBtn.addEventListener("click", deleteUserFromEdit);
  }

  if (adminToken()) {
    setAdminView(true);
    await loadAdminDashboard();
  } else {
    setAdminView(false);
  }
});
