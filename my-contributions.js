/**
 * my-contributions.js — Authenticated user's own contribution history.
 *
 * SECURITY: The query is filtered by where("userId", "==", currentUser.uid)
 * AND the Firestore rules restrict reads to documents where
 * request.auth.uid == userId. A user can never see another user's data.
 */

import { auth, db } from "./firebase-config.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { collection, query, where, orderBy, onSnapshot } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { AUTH_SETTINGS } from "./auth-config.js";

const CATEGORY_LABEL = { student: "Student", faculty: "Faculty", staff: "Staff" };

function statusBadge(status) {
  const map = {
    pending: `<span class="badge badge-pending">Pending</span>`,
    verified: `<span class="badge badge-verified">Verified ✓</span>`,
    rejected: `<span class="badge badge-rejected">Rejected</span>`,
  };
  return map[status] || `<span class="badge badge-muted">${window.escapeHtml(status)}</span>`;
}

function statusNote(status) {
  const map = {
    pending: "Awaiting organizer verification",
    verified: "Contribution verified ✓",
    rejected: "Please contact the organizing team for clarification.",
  };
  return map[status] || "";
}

function render(rows) {
  const content = document.getElementById("mc-content");
  const body = document.getElementById("mc-body");
  const empty = document.getElementById("mc-empty");
  content.hidden = false;

  if (!rows.length) {
    body.innerHTML = "";
    empty.style.display = "block";
    return;
  }
  empty.style.display = "none";
  body.innerHTML = rows.map((r) => {
    const data = r.data();
    return `<tr>
      <td>${window.formatDate(data.submittedAt)}</td>
      <td>${CATEGORY_LABEL[data.category] || window.escapeHtml(data.category)}</td>
      <td class="amount">${window.currency(data.amount)}</td>
      <td><code>${window.escapeHtml(window.maskTransaction(data.transactionId))}</code></td>
      <td>${statusBadge(data.status)}</td>
      <td style="text-align:right;"><button class="btn-sm btn-view mc-detail" data-id="${r.id}">Details</button></td>
    </tr>`;
  }).join("");

  body.querySelectorAll(".mc-detail").forEach((btn) => {
    btn.addEventListener("click", () => {
      const id = btn.dataset.id;
      const row = rows.find((r) => r.id === id);
      if (row) openDetail(row);
    });
  });
}

function openDetail(row) {
  const data = row.data();
  const confirmedCheck = document.createElement("div");
  confirmedCheck.innerHTML = `
    <div class="modal-overlay" id="mc-modal">
      <div class="modal" role="dialog" aria-modal="true" aria-labelledby="mc-detail-title">
        <div class="modal-head">
          <h3 id="mc-detail-title">Contribution Details</h3>
          <button class="modal-close modal-close-trigger" aria-label="Close">×</button>
        </div>
        <div class="modal-body">
          <div class="detail-grid">
            <div class="d-item"><div class="d-label">Category</div><div class="d-value">${CATEGORY_LABEL[data.category] || ""}</div></div>
            <div class="d-item"><div class="d-label">Amount</div><div class="d-value">${window.currency(data.amount)}</div></div>
            <div class="d-item"><div class="d-label">Submission date</div><div class="d-value">${window.formatDate(data.submittedAt)}</div></div>
            <div class="d-item"><div class="d-label">Transaction reference</div><div class="d-value"><code>${window.escapeHtml(window.maskTransaction(data.transactionId))}</code></div></div>
            <div class="d-item"><div class="d-label">Status</div><div class="d-value">${statusBadge(data.status)}</div></div>
            <div class="d-item"><div class="d-label">Message</div><div class="d-value">${data.message ? window.escapeHtml(data.message) : "—"}</div></div>
          </div>
          <p style="margin-top:14px;color:var(--adm-muted);font-size:.9rem;">${statusNote(data.status)}</p>
        </div>
        <div class="modal-foot">
          <button class="btn-sm btn-cancel modal-close-trigger">Close</button>
        </div>
      </div>
    </div>`;
  document.body.appendChild(confirmedCheck);
  const overlay = confirmedCheck.querySelector(".modal-overlay");

  const close = () => overlay.remove();
  overlay.addEventListener("click", (e) => { if (e.target === overlay) close(); });
  overlay.querySelectorAll(".modal-close-trigger").forEach((b) => b.addEventListener("click", close));
  overlay.addEventListener("keydown", (e) => { if (e.key === "Escape") close(); });
  overlay.querySelector(".modal").focus();
}

function onAuth(user) {
  document.body.classList.remove("is-loading");
  const loader = document.getElementById("page-loader");
  if (loader) loader.style.display = "none";

  if (!user) {
    document.getElementById("auth-loading").style.display = "none";
    document.getElementById("need-login").style.display = "block";
    return;
  }

  document.getElementById("auth-loading").style.display = "none";
  document.getElementById("need-login").style.display = "none";

  // Real-time listener limited to THIS user's contributions.
  const q = query(
    collection(db, "contributions"),
    where("userId", "==", user.uid),
    orderBy("submittedAt", "desc")
  );
  onSnapshot(q, (snap) => render(snap.docs), (err) => {
    console.error(err);
    window.showToast("Could not load your contributions. Please try again.", "error");
    document.getElementById("mc-content").hidden = false;
    document.getElementById("mc-empty").style.display = "block";
  });
}

document.addEventListener("DOMContentLoaded", () => {
  onAuthStateChanged(auth, (user) => {
    if (!user) { onAuth(null); return; }
    if (AUTH_SETTINGS.restrictEmailDomain) {
      const at = (user.email || "").lastIndexOf("@");
      const domain = at >= 0 ? user.email.slice(at + 1).toLowerCase() : "";
      if (!AUTH_SETTINGS.allowedDomains.includes(domain)) {
        onAuth(null);
        return;
      }
    }
    onAuth(user);
  });
});
