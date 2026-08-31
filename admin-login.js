/**
 * admin-login.js — Admin (organizer) email/password login.
 *
 * Authentication alone is NOT enough. After sign-in, this module checks
 * that the user's UID exists in the `admins` collection with role "admin".
 * Only then is the user redirected to admin.html.
 */

import { auth, db } from "./firebase-config.js";
import { signInWithEmailAndPassword, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { doc, getDoc } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

function toast(msg, type = "error") {
  // Minimal inline feedback (no shared navbar script on this page).
  const el = document.getElementById("auth-msg");
  if (el) { el.style.color = type === "error" ? "#dc2626" : "#16a34a"; el.textContent = msg; }
}

async function attemptAdminLogin(email, password) {
  const btn = document.getElementById("admin-login-btn");
  btn.disabled = true; btn.textContent = "Signing in…";
  toast("");

  try {
    const cred = await signInWithEmailAndPassword(auth, email, password);
    const authorized = await isAdmin(cred.user.uid);
    if (authorized) {
      toast("Success — redirecting…", "success");
      window.location.href = "./admin.html";
    } else {
      // Authenticated but NOT an admin. Sign out and deny.
      await auth.signOut();
      toast("Access denied. You are not an authorized organizer.");
    }
  } catch (err) {
    console.error(err);
    let msg = "Login failed. Please check your credentials.";
    if (err.code === "auth/wrong-password" || err.code === "auth/user-not-found" || err.code === "auth/invalid-credential") {
      msg = "Invalid email or password.";
    } else if (err.code === "auth/too-many-requests") {
      msg = "Too many attempts. Please try again later.";
    }
    toast(msg);
  } finally {
    btn.disabled = false;
    btn.textContent = "Sign In";
  }
}

async function isAdmin(uid) {
  try {
    const snap = await getDoc(doc(db, "admins", uid));
    return snap.exists() && snap.data().role === "admin";
  } catch (e) {
    console.error("Admin check failed", e);
    return false;
  }
}

// If already signed in as a verified admin, jump straight to the dashboard.
onAuthStateChanged(auth, async (user) => {
  if (user) {
    const ok = await isAdmin(user.uid);
    if (ok) { window.location.href = "./admin.html"; }
    else { await auth.signOut(); }
  }
  document.body.classList.remove("is-loading");
  const loader = document.getElementById("page-loader");
  if (loader) loader.style.display = "none";
});

document.getElementById("admin-login-form").addEventListener("submit", (e) => {
  e.preventDefault();
  const email = document.getElementById("admin-email").value.trim();
  const password = document.getElementById("admin-password").value;
  if (!email || !password) { toast("Please enter email and password."); return; }
  attemptAdminLogin(email, password);
});
