/**
 * login.js — Contributor sign-in / sign-up.
 *
 * Supports BOTH:
 *   (A) Google sign-in (primary)
 *   (B) Email/password sign-in AND sign-up
 *
 * The IIT Mandi email-domain restriction (auth-config.js) applies to BOTH
 * methods: an account whose email domain is not allowed is blocked at
 * sign-up, and any existing user with a disallowed domain is denied +
 * signed out at sign-in.
 */

import { auth } from "./firebase-config.js";
import {
  GoogleAuthProvider, signInWithPopup, signInWithEmailAndPassword,
  createUserWithEmailAndPassword, updateProfile, onAuthStateChanged,
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { AUTH_SETTINGS } from "./auth-config.js";

const REDIRECT_AFTER_LOGIN = "./donate.html";

function domainIsAllowed(email) {
  if (!email) return false;
  const at = email.lastIndexOf("@");
  if (at < 0) return false;
  const domain = email.slice(at + 1).toLowerCase();
  return AUTH_SETTINGS.allowedDomains.some((d) => d.toLowerCase() === domain);
}

function showMsg(text, isError = true) {
  const el = document.getElementById("auth-msg");
  if (el) {
    el.style.color = isError ? "#dc2626" : "#16a34a";
    el.textContent = text;
  }
}

/* ------------------------------------------------------------------
   Tab switching
------------------------------------------------------------------ */
function switchTab(tab) {
  const isSignIn = tab === "signin";
  document.getElementById("signin-panel").hidden = !isSignIn;
  document.getElementById("signup-panel").hidden = isSignIn;
  const siBtn = document.getElementById("tab-signin");
  const suBtn = document.getElementById("tab-signup");
  const active = { background: "#fff", color: "var(--maroon)", boxShadow: "0 1px 4px rgba(0,0,0,0.08)" };
  const idle = { background: "transparent", color: "#8a5a2b", boxShadow: "none" };
  Object.assign(siBtn.style, isSignIn ? active : idle);
  Object.assign(suBtn.style, isSignIn ? idle : active);
  siBtn.setAttribute("aria-selected", String(isSignIn));
  suBtn.setAttribute("aria-selected", String(!isSignIn));
  showMsg("");
}

/* ------------------------------------------------------------------
   Google
------------------------------------------------------------------ */
async function handleGoogleSignIn() {
  const btn = document.getElementById("google-signin");
  btn.disabled = true; btn.style.opacity = 0.6; showMsg("");
  try {
    const provider = new GoogleAuthProvider();
    provider.setCustomParameters({ prompt: "select_account" });
    const result = await signInWithPopup(auth, provider);
    if (!domainAllowedOrDeny(result.user)) return;
    window.showToast("Signed in successfully", "success");
    window.location.href = REDIRECT_AFTER_LOGIN;
  } catch (err) {
    console.error(err);
    showMsg("Sign in failed. Please try again.");
    window.showToast("Could not sign in. Please try again.", "error");
  } finally {
    btn.disabled = false; btn.style.opacity = 1;
  }
}

/* ------------------------------------------------------------------
   Email/password sign-in
------------------------------------------------------------------ */
async function handleEmailSignIn(e) {
  e.preventDefault();
  const email = document.getElementById("si-email").value.trim();
  const password = document.getElementById("si-password").value;
  const btn = document.getElementById("signin-btn");
  showMsg("");

  if (AUTH_SETTINGS.restrictEmailDomain && !domainIsAllowed(email)) {
    showMsg(AUTH_SETTINGS.restrictedMessage);
    window.showToast(AUTH_SETTINGS.restrictedMessage, "warning", 6000);
    return;
  }

  btn.disabled = true; btn.textContent = "Signing in…";
  try {
    const cred = await signInWithEmailAndPassword(auth, email, password);
    if (!domainAllowedOrDeny(cred.user)) { btn.disabled = false; btn.textContent = "Sign In"; return; }
    window.showToast("Signed in successfully", "success");
    window.location.href = REDIRECT_AFTER_LOGIN;
  } catch (err) {
    console.error(err);
    let msg = "Invalid email or password.";
    if (err.code === "auth/user-not-found" || err.code === "auth/wrong-password" || err.code === "auth/invalid-credential") msg = "Invalid email or password.";
    else if (err.code === "auth/invalid-email") msg = "Please enter a valid email address.";
    else if (err.code === "auth/too-many-requests") msg = "Too many attempts. Please try again later.";
    else if (err.code === "auth/invalid-login-credentials") msg = "Invalid email or password.";
    showMsg(msg);
  } finally {
    btn.disabled = false; btn.textContent = "Sign In";
  }
}

/* ------------------------------------------------------------------
   Email/password sign-up
------------------------------------------------------------------ */
async function handleSignUp(e) {
  e.preventDefault();
  const name = document.getElementById("su-name").value.trim();
  const email = document.getElementById("su-email").value.trim();
  const password = document.getElementById("su-password").value;
  const confirm = document.getElementById("su-confirm").value;
  const btn = document.getElementById("signup-btn");
  showMsg("");

  if (!name) { showMsg("Please enter your full name."); return; }
  if (AUTH_SETTINGS.restrictEmailDomain && !domainIsAllowed(email)) {
    showMsg(AUTH_SETTINGS.restrictedMessage);
    window.showToast(AUTH_SETTINGS.restrictedMessage, "warning", 6000);
    return;
  }
  if (password.length < 6) { showMsg("Password must be at least 6 characters."); return; }
  if (password !== confirm) { showMsg("Passwords do not match."); return; }

  btn.disabled = true; btn.textContent = "Creating account…";
  try {
    const cred = await createUserWithEmailAndPassword(auth, email, password);
    // Attach the display name so the profile/navbar shows it.
    try { await updateProfile(cred.user, { displayName: name }); } catch (e2) { console.warn(e2); }
    window.showToast("Account created — welcome! 🎉", "success");
    window.location.href = REDIRECT_AFTER_LOGIN;
  } catch (err) {
    console.error(err);
    let msg = "Could not create the account.";
    if (err.code === "auth/email-already-in-use") msg = "An account with this email already exists. Please sign in.";
    else if (err.code === "auth/invalid-email") msg = "Please enter a valid email address.";
    else if (err.code === "auth/weak-password") msg = "Password must be at least 6 characters.";
    else if (err.code === "auth/operation-not-allowed") msg = "Email/password sign-up is not enabled. Contact the organizer.";
    showMsg(msg);
  } finally {
    btn.disabled = false; btn.textContent = "Create Account";
  }
}

/* Sign out + deny if the (already-authenticated) email domain is disallowed. */
function domainAllowedOrDeny(user) {
  if (!AUTH_SETTINGS.restrictEmailDomain || domainIsAllowed(user.email)) return true;
  showMsg(AUTH_SETTINGS.restrictedMessage);
  window.showToast(AUTH_SETTINGS.restrictedMessage, "warning", 6000);
  auth.signOut();
  return false;
}

/* If already signed in on this page, move them along. */
onAuthStateChanged(auth, (user) => {
  if (user) {
    if (!domainAllowedOrDeny(user)) return;
    window.location.href = REDIRECT_AFTER_LOGIN;
  }
});

document.addEventListener("DOMContentLoaded", () => {
  document.getElementById("tab-signin").addEventListener("click", () => switchTab("signin"));
  document.getElementById("tab-signup").addEventListener("click", () => switchTab("signup"));
  document.getElementById("go-signin").addEventListener("click", () => switchTab("signin"));
  document.getElementById("google-signin").addEventListener("click", handleGoogleSignIn);
  document.getElementById("signin-form").addEventListener("submit", handleEmailSignIn);
  document.getElementById("signup-form").addEventListener("submit", handleSignUp);
  document.getElementById("admin-login-btn").addEventListener("click", () => {
    window.location.href = "./admin-login.html";
  });
});
