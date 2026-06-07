// ==========================================
// 🌐 SUPABASE & VERCEL BACKEND ROUTING SYNC
// ==========================================
// ✅ LIVE KEY INTEGRATION: Auth aur Session direct Supabase cloud sambhalega
const SUPABASE_URL = "https://twukpvtqwuhbubtcnwdt.supabase.co";
const SUPABASE_ANON_KEY = "Sb_publishable_NXG8cBn1aQja3pdWJDGxXg_MnDyixL6"; 

// 🔥 VERCEL PRODUCTION ENGINE URL
const VERCEL_API_URL = "https://math-guru-raosahabwebservices-projects.vercel.app";

let supabase;
if (window.supabase) {
    supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
}

const upiId = "raos38908@okhdfcbank";
const upiUri = `upi://pay?pa=${upiId}&pn=Rao%20Sahab&am=99&cu=INR&tn=MATHS%20GURU%20Premium`;

// =============================
// TOKEN & SESSION HELPERS
// =============================
function token() { return localStorage.getItem("mg_token") || ""; }
function adminToken() { return localStorage.getItem("mg_admin_token") || ""; }

function setUser(session, profileData) {
  if (session && session.access_token) {
    localStorage.setItem("mg_token", session.access_token);
    localStorage.setItem("token", session.access_token); 
  }
  if (profileData) localStorage.setItem("mg_user", JSON.stringify(profileData));
}

function logout() {
  localStorage.clear(); 
  if (supabase) supabase.auth.signOut();
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

// =============================================
// 🧠 SAFE FETCH WRAPPER: VERCEL AI ENGINE HANDSHAKE
// =============================================
// ✅ FIXED: Ab Test Generator aur Doubt Solving direct Vercel backend par hit karenge cleanly!
async function request(path, options = {}) {
  const headers = {
    "Authorization": `Bearer ${token()}` // Supabase User Token send to Vercel for verification
  };
  
  if (!(options.body instanceof FormData)) {
    headers["Content-Type"] = "application/json";
  }

  // Ensure path mapping standard compliance
  let cleanPath = path;
  if (!path.startsWith("/api/")) {
    cleanPath = `/api${path}`;
  }

  try {
    const res = await fetch(`${VERCEL_API_URL}${cleanPath}`, {
      ...options,
      headers: { ...headers, ...(options.headers || {}) }
    });

    const contentType = res.headers.get("content-type");
    if (!contentType || !contentType.includes("application/json")) {
       throw new Error("AI Engine Response Error: Make sure vercel.json is pushed and deployment is live.");
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

// =====================================
// ⚡ REQUIRE STUDENT (Serverless Authentication)
// =====================================
async function requireStudent() {
  const t = token();
  if (!t || !supabase) {
    logout();
    return;
  }

  try {
    const { data: { user }, error } = await supabase.auth.getUser();
    if (error || !user) throw new Error("Session expired");

    const { data: profile, error: pErr } = await supabase
      .from('users')
      .select('*')
      .eq('id', user.id)
      .single();

    if (pErr || !profile) throw new Error("Profile row missing");

    const mappedUser = {
        id: profile.id,
        name: profile.name,
        email: profile.email,
        premiumActive: profile.premium_active,
        remainingText: (profile.premium_active ? 100 : 10) + (profile.text_limit_bonus || 0) - (profile.text_used || 0),
        remainingImage: (profile.premium_active ? 100 : 3) - (profile.image_used || 0)
    };

    localStorage.setItem("mg_user", JSON.stringify(mappedUser));
    localStorage.setItem("token", t);
    return mappedUser;
  } catch (err) {
    console.error("Auth flow check failed:", err);
    logout();
  }
}
window.requireStudent = requireStudent;

function generateRandomCode(name) {
    const prefix = name ? name.substring(0, 4).toUpperCase().replace(/\s+/g, '') : "MG";
    const rand = Math.floor(1000 + Math.random() * 9000);
    return `${prefix}${rand}`;
}

// =====================================
// DOM READY & ACTION INTERFACES
// =====================================
document.addEventListener("DOMContentLoaded", async () => {
  if (!window.supabase) {
     const script = document.createElement('script');
     script.src = "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2";
     script.onload = () => {
         supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
     };
     document.head.appendChild(script);
  }

  const year = document.querySelector("#year");
  if (year) year.textContent = new Date().getFullYear();

  const userData = localStorage.getItem("mg_user");
  if (userData) {
    const user = JSON.parse(userData);
    document.querySelectorAll("[data-auth-name]").forEach(el => {
        el.textContent = user.name || "Student";
    });
  }

  document.querySelectorAll("[data-logout]").forEach(b => b.addEventListener("click", (e) => {
      e.preventDefault();
      logout();
  }));

  // =====================================
  // 🔐 SUPABASE DYNAMIC LOGIN HANDLER
  // =====================================
  const login = document.querySelector("#loginForm");
  if (login) {
    login.addEventListener("submit", async e => {
      e.preventDefault();
      const box = document.querySelector("#formMsg");
      const { identifier, password } = Object.fromEntries(new FormData(login).entries());
      try {
        msg(box, "Logging in...", "notice");
        let targetEmail = identifier.trim();

        if (!identifier.includes("@")) {
            const { data: userRow, error: mobErr } = await supabase
                .from('users')
                .select('email')
                .eq('mobile', identifier.trim())
                .single();
                
            if (mobErr || !userRow) throw new Error("Yeh mobile number registered nahi hai.");
            targetEmail = userRow.email;
        }

        const { data: authData, error: authErr } = await supabase.auth.signInWithPassword({
            email: targetEmail,
            password: password
        });
        if (authErr) throw authErr;

        const { data: profile } = await supabase.from('users').select('*').eq('id', authData.user.id).single();
        const mappedUser = {
            id: profile.id, name: profile.name, email: profile.email, premiumActive: profile.premium_active,
            remainingText: (profile.premium_active ? 100 : 10) + (profile.text_limit_bonus || 0) - (profile.text_used || 0),
            remainingImage: (profile.premium_active ? 100 : 3) - (profile.image_used || 0)
        };

        setUser(authData.session, mappedUser);
        location.href = "dashboard.html";
      } catch (err) { msg(box, err.message, "error"); }
    });
  }

  // =====================================
  // 🎁 SUPABASE DYNAMIC SIGNUP + REFERRAL
  // =====================================
  const signup = document.querySelector("#signupForm");
  if (signup) {
    signup.addEventListener("submit", async e => {
      e.preventDefault();
      const box = document.querySelector("#formMsg");
      const { name, email, mobile, password, referralCode } = Object.fromEntries(new FormData(signup).entries());
      try {
        msg(box, "Creating account...", "notice");

        const { data: authData, error: authErr } = await supabase.auth.signUp({ email, password });
        if (authErr) throw authErr;

        let referredByCode = null;
        let selfBonus = 0;

        if (referralCode) {
            const { data: referrer } = await supabase
                .from('users')
                .select('*')
                .eq('my_referral_code', referralCode.toUpperCase().trim())
                .single();

            if (referrer) {
                referredByCode = referrer.my_referral_code;
                selfBonus = 2; 
                await supabase.from('users').update({ text_limit_bonus: (referrer.text_limit_bonus || 0) + 5 }).eq('id', referrer.id);
            }
        }

        const profileRow = {
            id: authData.user.id, name, email, mobile,
            text_limit_bonus: selfBonus,
            my_referral_code: generateRandomCode(name),
            referred_by: referredByCode
        };

        const { error: insErr } = await supabase.from('users').insert([profileRow]);
        if (insErr) throw insErr;

        const mappedUser = { id: profileRow.id, name, email, premiumActive: false, remainingText: 10 + selfBonus, remainingImage: 3 };
        setUser(authData.session, mappedUser);
        location.href = "dashboard.html";
      } catch (err) { msg(box, err.message, "error"); }
    });
  }

  // 🎁 REFERRER LINK CAPTURE ENGINE
  const urlParams = new URLSearchParams(window.location.search);
  const refCode = urlParams.get('ref');
  const banner = document.getElementById("referrer-banner");
  const nameSpan = document.getElementById("referrer-name");
  const hiddenInput = document.getElementById("hidden-ref-code");

  if (refCode && banner && nameSpan && supabase) {
    try {
      const { data: referrer } = await supabase.from('users').select('name').eq('my_referral_code', refCode.toUpperCase().trim()).single();
      if (referrer) {
        nameSpan.innerText = referrer.name; 
        banner.style.display = "block";
        if (hiddenInput) hiddenInput.value = refCode;
      }
    } catch (err) { console.error(err); }
  }
});
                                                                  
