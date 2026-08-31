/**
 * script.js — shared logic / interactive behaviour for the PUBLIC site.
 * Loaded as a type=module script on every public page.
 *
 * Responsibilities:
 *   - Dynamic navbar (signed-in vs signed-out user chip + dropdown)
 *   - Global auth-state listener
 *   - Lightweight first-run profile sync (users/{uid})
 *   - Toast notification system (exposed as window.showToast)
 *   - Shared helpers (maskTransaction, formatCurrency, escapeHtml)
 *   - Mobile (hamburger) menu
 */

import { auth, db } from "./firebase-config.js";
import {
  onAuthStateChanged,
  signOut,
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import {
  doc,
  getDoc,
  setDoc,
  serverTimestamp,
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { PAYMENT_CONFIG } from "./payment-config.js";

/* ------------------------------------------------------------------
   Toast system
------------------------------------------------------------------ */
const TOAST_WRAP = document.getElementById("toast-wrap");
if (!TOAST_WRAP) {
  const wrap = document.createElement("div");
  wrap.id = "toast-wrap";
  wrap.className = "toast-wrap";
  wrap.setAttribute("aria-live", "polite");
  document.body.appendChild(wrap);
}

window.showToast = function (message, type = "info", duration = 3800) {
  const wrap = document.getElementById("toast-wrap");
  const el = document.createElement("div");
  el.className = `toast ${type}`;
  el.setAttribute("role", type === "error" ? "alert" : "status");
  el.innerHTML = `<span>${escapeHtml(message)}</span>
    <button class="t-close" aria-label="Dismiss notification">&times;</button>`;
  wrap.appendChild(el);

  const remove = () => {
    el.classList.add("leaving");
    setTimeout(() => el.remove(), 250);
  };
  el.querySelector(".t-close").addEventListener("click", remove);
  const t = setTimeout(remove, duration);
  el.addEventListener("mouseenter", () => clearTimeout(t));
};

/* ------------------------------------------------------------------
   Shared helpers
------------------------------------------------------------------ */
window.escapeHtml = function (s) {
  return String(s ?? "").replace(/[&<>"']/g, (c) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  }[c]));
};

window.maskTransaction = function (ref) {
  if (!ref) return "";
  const str = String(ref);
  if (str.length <= 4) return "****" + str;
  return "XXXXXX" + str.slice(-4);
};

window.currency = (n) => {
  const s = n == null ? "" : Number(n).toLocaleString("en-IN");
  return `${PAYMENT_CONFIG.currencySymbol}${s}`;
};

window.formatDate = function (ts) {
  if (!ts) return "—";
  let d;
  if (ts && typeof ts.toDate === "function") d = ts.toDate();
  else if (ts instanceof Date) d = ts;
  else if (ts && ts.seconds) d = new Date(ts.seconds * 1000);
  else return "—";
  return d.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
};

/* ------------------------------------------------------------------
   Navbar rendering + auth state
------------------------------------------------------------------ */
async function syncProfile(user) {
  // First-run (or every login) profile sync. Only writes safe fields.
  try {
    const ref = doc(db, "users", user.uid);
    const snap = await getDoc(ref);
    const now = serverTimestamp();
    const base = {
      uid: user.uid,
      name: user.displayName || "Contributor",
      email: user.email || "",
      photoURL: user.photoURL || null,
      role: "contributor", // NEVER editable by the user; enforced in rules.
      lastLogin: now,
    };
    if (!snap.exists()) {
      base.createdAt = now;
      await setDoc(ref, base);
    } else {
      const existing = snap.data();
      // Don't overwrite createdAt; only touch non-critical fields.
      await setDoc(
        ref,
        { lastLogin: now, name: user.displayName || existing.name, photoURL: user.photoURL || existing.photoURL },
        { merge: true }
      );
    }
  } catch (e) {
    // Non-fatal: don't block the page on profile sync.
    console.warn("profile sync skipped", e);
  }
}

function renderUserMenu(user) {
  const actions = document.getElementById("nav-actions");
  if (!actions) return;
  if (!user) {
    actions.innerHTML = `
      <a href="./login.html" class="btn-signin">Sign In</a>
      <a href="./donate.html" class="btn-contribute">Contribute</a>`;
    return;
  }

  const initial = (user.displayName || user.email || "U").slice(0, 1).toUpperCase();
  const firstName = (user.displayName || "User").split(" ")[0];

  actions.innerHTML = `
    <a href="./donate.html" class="btn-contribute">Contribute</a>
    <div class="user-chip" id="user-chip" role="button" tabindex="0"
         aria-haspopup="menu" aria-label="Account menu">
      ${user.photoURL
        ? `<img class="avatar" src="${escapeHtml(user.photoURL)}" alt="" referrerpolicy="no-referrer">`
        : `<span class="avatar">${escapeHtml(initial)}</span>`}
      <span class="u-name">${escapeHtml(firstName)}</span>
      <div class="user-menu" id="user-menu" role="menu">
        <a href="./my-contributions.html" role="menuitem">My Contributions</a>
        <button class="logout" data-logout role="menuitem">Sign Out</button>
      </div>
    </div>`;

  const chip = document.getElementById("user-chip");
  const menu = document.getElementById("user-menu");
  const toggle = (open) => menu.classList.toggle("open", open);
  chip.addEventListener("click", (e) => {
    e.stopPropagation();
    toggle(!menu.classList.contains("open"));
  });
  chip.addEventListener("keydown", (e) => {
    if (e.key === "Enter" || e.key === " ") { e.preventDefault(); toggle(!menu.classList.contains("open")); }
    if (e.key === "Escape") toggle(false);
  });
  document.addEventListener("click", (e) => {
    if (!chip.contains(e.target)) toggle(false);
  });
  menu.querySelector("[data-logout]").addEventListener("click", () => doLogout());
}

async function doLogout() {
  try {
    await signOut(auth);
    window.showToast("Signed out successfully", "success");
  } catch (e) {
    window.showToast("Could not sign out. Please try again.", "error");
  }
}

export function initAuth() {
  onAuthStateChanged(auth, (user) => {
    // Remove the page-load splash.
    document.body.classList.remove("is-loading");
    const splash = document.getElementById("page-loader");
    if (splash) splash.style.display = "none";

    renderUserMenu(user);
    if (user) syncProfile(user);

    // Let page-specific code (donate.js etc.) react to auth changes.
    const evt = new CustomEvent("authstatechange", { detail: { user } });
    window.dispatchEvent(evt);
  });
}

/* ------------------------------------------------------------------
   Mobile hamburger
------------------------------------------------------------------ */
function initMobileMenu() {
  const hamburger = document.getElementById("hamburger");
  const navLinks = document.getElementById("nav-links");
  if (!hamburger || !navLinks) return;
  hamburger.addEventListener("click", () => {
    const open = navLinks.classList.toggle("open");
    hamburger.setAttribute("aria-expanded", String(open));
  });
}

/* ------------------------------------------------------------------
   Boot
------------------------------------------------------------------ */
document.addEventListener("DOMContentLoaded", () => {
  initMobileMenu();
  initAuth();
});
