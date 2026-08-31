/**
 * donate.js — Authenticated contribution page.
 *
 * SECURITY GATING:
 *   - donate.html is fully rendered only AFTER Firebase confirms a
 *     signed-in, domain-allowed user. Until then the form is hidden.
 *   - Unauthenticated visitors are redirected to login.html.
 *   - The new contribution is created with status:"pending" only.
 *     The Firestore rules (firestore.rules) enforce this server-side:
 *     a client cannot submit status "verified"/"rejected".
 */

import { auth, db } from "./firebase-config.js";
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import {
  collection, addDoc, query, where, getDocs, limit,
  serverTimestamp,
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { AUTH_SETTINGS } from "./auth-config.js";
import { PAYMENT_CONFIG } from "./payment-config.js";

let currentUser = null;
let selectedCategory = null;

function domainIsAllowed(email) {
  if (!email) return false;
  const at = email.lastIndexOf("@");
  if (at < 0) return false;
  return AUTH_SETTINGS.allowedDomains.some((d) => d.toLowerCase() === email.slice(at + 1).toLowerCase());
}

function renderSignedInBanner(user) {
  document.getElementById("signin-email").textContent = user.email || "";
  document.getElementById("signin-name").textContent = user.displayName || "Contributor";
  const avatar = document.getElementById("signin-avatar");
  if (user.photoURL) avatar.src = user.photoURL;
  else avatar.style.background = "var(--grad-gold)";
}

function prefillForm(user) {
  const nameEl = document.getElementById("d-name");
  nameEl.value = user.displayName || "";
  document.getElementById("d-email").value = user.email || "";
}

function renderPaymentConfig() {
  document.getElementById("payee-name").textContent = PAYMENT_CONFIG.payeeName || "Ganesh Utsav IIT Mandi";
  document.getElementById("upi-id").textContent = PAYMENT_CONFIG.upiId;
  document.getElementById("pay-instructions").innerHTML =
    `<ol>${(PAYMENT_CONFIG.instructions || "")
      .split(/(?<=\.)\s/) // split into sentences on period+space
      .filter(Boolean)
      .map((s) => `<li>${window.escapeHtml(s.trim())}</li>`).join("")}</ol>`;
  const img = document.getElementById("qr-img");
  img.src = PAYMENT_CONFIG.qrCodePath || "./assets/images/upi-qr.png";
  img.onerror = () => {
    img.outerHTML = `<div class="placeholder">QR not configured yet.<br>Login as admin/setup to add it.<br><br>UPI ID:<br><strong>${window.escapeHtml(PAYMENT_CONFIG.upiId)}</strong></div>`;
  };
}

function setupCategoryCards() {
  const grid = document.getElementById("cat-grid");
  const roll = document.getElementById("roll-group");
  const cards = grid.querySelectorAll(".cat-card");

  const select = (card) => {
    cards.forEach((c) => {
      c.classList.remove("selected");
      c.setAttribute("aria-pressed", "false");
    });
    card.classList.add("selected");
    card.setAttribute("aria-pressed", "true");
    selectedCategory = card.dataset.cat;
    roll.hidden = selectedCategory !== "student";
  };

  cards.forEach((card) => {
    card.addEventListener("click", () => select(card));
    card.addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === " ") { e.preventDefault(); select(card); }
    });
  });
}

/* ------------------------------------------------------------------
   Authentication gate
------------------------------------------------------------------ */
function onAuthResolved(user) {
  document.body.classList.remove("is-loading");
  const loader = document.getElementById("page-loader");
  if (loader) loader.style.display = "none";

  if (!user) {
    // Not signed in -> show friendly message, do NOT render the form.
    document.getElementById("auth-loading").style.display = "none";
    document.getElementById("need-login").style.display = "block";
    return;
  }

  if (AUTH_SETTINGS.restrictEmailDomain && !domainIsAllowed(user.email)) {
    document.getElementById("auth-loading").style.display = "none";
    document.getElementById("need-login").style.display = "block";
    const box = document.getElementById("need-login");
    box.querySelector("h2").textContent = AUTH_SETTINGS.restrictedMessage;
    box.querySelector("a").style.display = "none";
    window.showToast(AUTH_SETTINGS.restrictedMessage, "warning", 6000);
    signOut(auth);
    return;
  }

  currentUser = user;
  document.getElementById("auth-loading").style.display = "none";
  document.getElementById("gate").hidden = false;
  prefillForm(user);
  renderSignedInBanner(user);
}

/* ------------------------------------------------------------------
   Duplicate + validation + submit
------------------------------------------------------------------ */
async function checkDuplicate(user, txn) {
  const norm = String(txn).trim().toLowerCase();
  try {
    // 1) Same user recently submitted the same reference.
    const mine = await getDocs(
      query(collection(db, "contributions"), where("userId", "==", user.uid), limit(50))
    );
    for (const d of mine.docs) {
      const data = d.data();
      if (String(data.transactionId || "").toLowerCase() === norm) {
        return { kind: "user", doc: d };
      }
    }
    // 2) The exact reference was used by anyone (cross-user duplicate).
    const exact = await getDocs(
      query(collection(db, "contributions"), where("transactionId", "==", txn.trim()), limit(1))
    );
    if (!exact.empty) {
      return { kind: "global", doc: exact.docs[0] };
    }
  } catch (e) {
    console.warn("Duplicate check failed (non-fatal)", e);
  }
  return null;
}

function validateForm() {
  if (!selectedCategory) { window.showToast("Please select your category.", "warning"); return false; }
  if (selectedCategory === "student" && !document.getElementById("roll-number").value.trim()) {
    window.showToast("Please enter your roll number.", "warning"); return false;
  }
  const amount = Number(document.getElementById("d-amount").value);
  if (!amount || amount < 1) { window.showToast("Please enter a valid contribution amount.", "warning"); return false; }
  const txn = document.getElementById("d-txn").value.trim();
  if (!txn) { window.showToast("Please enter the transaction reference / UTR.", "warning"); return false; }
  if (!document.getElementById("d-confirm").checked) {
    window.showToast("Please confirm you completed the payment using the official method.", "warning"); return false;
  }
  return true;
}

async function onSubmit() {
  if (!currentUser) return;
  if (!validateForm()) return;

  const btn = document.getElementById("submit-btn");
  const txn = document.getElementById("d-txn").value.trim();

  // Duplicate safeguard (client-side best-effort; see README limitations).
  btn.disabled = true;
  const original = btn.textContent;
  btn.textContent = "Submitting…";
  try {
    const dup = await checkDuplicate(currentUser, txn);
    if (dup) {
      window.showToast("This transaction reference has already been submitted.", "warning", 5000);
      btn.disabled = false; btn.textContent = original;
      return;
    }

    const name = document.getElementById("d-name").value.trim() || currentUser.displayName || "Contributor";
    const rolInfo = selectedCategory === "student" ? document.getElementById("roll-number").value.trim() : null;

    await addDoc(collection(db, "contributions"), {
      userId: currentUser.uid,
      name,
      email: currentUser.email || "",
      phone: document.getElementById("d-phone").value.trim() || null,
      rollNumber: rolInfo,
      category: selectedCategory,
      amount: Number(document.getElementById("d-amount").value),
      message: document.getElementById("d-message").value.trim() || null,
      transactionId: txn,
      displayNamePublic: document.getElementById("d-public").checked,
      status: "pending", // MUST always start as pending (enforced in rules too).
      verifiedAt: null,
      verifiedBy: null,
      rejectionReason: null,
      submittedAt: serverTimestamp(),
    });

    window.showToast("Contribution submitted successfully 🎉", "success", 5000);
    // Reset the payment-confirmation fields (keep user + category sensible defaults).
    document.getElementById("d-txn").value = "";
    document.getElementById("d-confirm").checked = false;
    document.getElementById("d-phone").value = "";
    document.getElementById("d-message").value = "";
    document.getElementById("d-amount").value = "";
  } catch (err) {
    console.error(err);
    window.showToast("Network error. Please try again.", "error");
  } finally {
    btn.disabled = false;
    btn.textContent = "Submit Contribution";
  }
}

/* ------------------------------------------------------------------
   Boot
------------------------------------------------------------------ */
document.addEventListener("DOMContentLoaded", () => {
  renderPaymentConfig();
  setupCategoryCards();
  document.getElementById("submit-btn").addEventListener("click", onSubmit);

  onAuthStateChanged(auth, onAuthResolved);
});
