/**
 * admin.js — Organizer dashboard.
 *
 * AUTHORIZATION GATE:
 *   The dashboard is ONLY rendered after:
 *     (1) the user is authenticated, AND
 *     (2) admins/{uid} exists with role === "admin".
 *   Until both are true, NO contribution data is fetched or shown.
 *
 * VERIFY:
 *   - sets status:"verified", verifiedAt: serverTimestamp(), verifiedBy: admin UID
 *   - creates publicLeaderboard/{id} with ONLY safe public fields
 *   - recomputes + updates publicStats/summary (verified-only)
 *
 * REJECT:
 *   - sets status:"rejected", rejectionReason, verifiedAt, verifiedBy
 *   - ensures any publicLeaderboard entry is removed (defensive)
 */

import { auth, db } from "./firebase-config.js";
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import {
  collection, onSnapshot, doc, getDoc, getDocs, query, where, limit,
  setDoc, deleteDoc, updateDoc, serverTimestamp, writeBatch,
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { PAYMENT_CONFIG } from "./payment-config.js";

const CATEGORY_LABEL = { student: "Student", faculty: "Faculty", staff: "Staff" };
const currency = (n) => `${PAYMENT_CONFIG.currencySymbol}${Number(n || 0).toLocaleString("en-IN")}`;
const maskTxn = (ref) => { const s = String(ref || ""); return s.length <= 4 ? "****" + s : "XXXXXX" + s.slice(-4); };

let admin = null;               // authorised admin user object
let allContributions = [];      // live cached list (admin can read all)
let activeAF = "all";           // all-table status filter
let currentView = "dashboard";

/* ==================================================================
   AUTH GATE
================================================================== */
async function isAdmin(uid) {
  try {
    const snap = await getDoc(doc(db, "admins", uid));
    return snap.exists() && snap.data().role === "admin";
  } catch { return false; }
}

onAuthStateChanged(auth, async (user) => {
  if (!user) { showDenied(); return; }
  const ok = await isAdmin(user.uid);
  if (!ok) {
    await signOut(auth);
    showDenied();
    return;
  }
  admin = { uid: user.uid, email: user.email };
  enterDashboard();
});

function showDenied() {
  document.body.classList.remove("is-loading");
  const loader = document.getElementById("page-loader");
  if (loader) loader.style.display = "none";
  document.getElementById("admin-app").hidden = true;
  document.getElementById("admin-denied").style.display = "grid";
  document.title = "Access Denied | Ganesh Utsav Admin";
}

function enterDashboard() {
  document.body.classList.remove("is-loading");
  const loader = document.getElementById("page-loader");
  if (loader) loader.style.display = "none";
  document.getElementById("admin-app").hidden = false;

  bindNavigation();
  listenAllContributions();
}

/* ==================================================================
   DATA LISTENER (live)
================================================================== */
function listenAllContributions() {
  try {
    onSnapshot(collection(db, "contributions"), (snap) => {
      allContributions = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      renderAll();
    }, (err) => {
      console.error("Contributions listener failed", err);
      toast("Could not load contributions. Check rules / connection.", "error");
    });
  } catch (e) { console.error(e); }
}

/* ==================================================================
   NAVIGATION + VIEW RENDER
================================================================== */
function bindNavigation() {
  document.querySelectorAll(".adm-nav button[data-view]").forEach((btn) => {
    btn.addEventListener("click", () => setView(btn.dataset.view));
  });
  document.getElementById("logout-btn").addEventListener("click", async () => {
    await signOut(auth);
    window.location.href = "./admin-login.html";
  });
  document.getElementById("adm-hamburger").addEventListener("click", () => {
    const sb = document.getElementById("adm-sidebar");
    sb.classList.toggle("open");
  });
  document.querySelectorAll("[data-jump]").forEach((b) => b.addEventListener("click", () => setView(b.dataset.jump)));
  document.querySelectorAll("[data-af]").forEach((b) => b.addEventListener("click", () => {
    document.querySelectorAll("[data-af]").forEach((x) => x.classList.remove("active"));
    b.classList.add("active");
    activeAF = b.dataset.af;
    renderAllTable();
  }));
  document.getElementById("export-csv").addEventListener("click", exportCSV);
}

const VIEW_TITLES = {
  dashboard: "Dashboard", pending: "Pending", verified: "Verified",
  rejected: "Rejected", all: "All Contributions", analytics: "Analytics",
};

function setView(view) {
  currentView = view;
  document.getElementById("view-title").textContent = VIEW_TITLES[view] || "Dashboard";
  document.querySelectorAll("[data-section]").forEach((s) => (s.hidden = s.dataset.section !== view));
  document.querySelectorAll(".adm-nav button[data-view]").forEach((b) => {
    b.classList.toggle("active", b.dataset.view === view);
  });
  document.getElementById("adm-sidebar").classList.remove("open");
  renderAll(); // ensures the target section reflects latest data
}

function renderAll() {
  renderDashboard();
  renderPending();
  renderVerified();
  renderRejected();
  renderAllTable();
  renderAnalytics();
}

/* ==================================================================
   STATUS HELPERS
================================================================== */
function badge(status) {
  return {
    pending: `<span class="badge badge-pending">Pending</span>`,
    verified: `<span class="badge badge-verified">Verified</span>`,
    rejected: `<span class="badge badge-rejected">Rejected</span>`,
  }[status] || `<span class="badge badge-muted">${esc(status)}</span>`;
}
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;" }[c]));
const fmtDate = (ts) => {
  if (!ts) return "—";
  const d = ts && typeof ts.toDate === "function" ? ts.toDate() : ts.seconds ? new Date(ts.seconds * 1000) : ts instanceof Date ? ts : null;
  return d ? d.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }) : "—";
};
const fmtTime = (ts) => {
  if (!ts) return "—";
  const d = ts && typeof ts.toDate === "function" ? ts.toDate() : ts.seconds ? new Date(ts.seconds * 1000) : ts instanceof Date ? ts : null;
  return d ? d.toLocaleString("en-IN", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" }) : "—";
};

function rowActions(id, status) {
  if (status !== "pending") return `<button class="btn-sm btn-view" data-act="view" data-id="${id}">View</button>`;
  return `
    <button class="btn-sm btn-view" data-act="view" data-id="${id}">View</button>
    <button class="btn-sm btn-verify" data-act="verify" data-id="${id}">Verify</button>
    <button class="btn-sm btn-reject" data-act="reject" data-id="${id}">Reject</button>`;
}

const TABLE_COLS = {
  pending: ["Name", "Email", "Category", "Amount", "Transaction", "Time", "Actions"],
  verified: ["Name", "Category", "Amount", "Verified At", "Verified By", "Actions"],
  rejected: ["Name", "Category", "Amount", "Rejected At", "Reason", "Actions"],
  all: ["Name", "Category", "Amount", "Status", "Time", "Actions"],
  top: ["#", "Name", "Category", "Total Contribution"],
};

/* ==================================================================
   DASHBOARD
================================================================== */
function todayKey(d) { return d ? `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}` : ""; }

function renderDashboard() {
  const pending = allContributions.filter((c) => c.status === "pending");
  const verified = allContributions.filter((c) => c.status === "verified");
  const rejected = allContributions.filter((c) => c.status === "rejected");
  const verifiedAmount = verified.reduce((s, c) => s + Number(c.amount || 0), 0);
  const contributors = new Set(verified.map((c) => c.userId)).size;
  const now = new Date();
  const tk = todayKey(now);
  const today = allContributions.filter((c) => {
    const d = c.submittedAt && typeof c.submittedAt.toDate === "function" ? c.submittedAt.toDate() : null;
    return d ? todayKey(d) === tk : false;
  }).length;

  const vals = {
    "Pending": `<span class="adm-stat"><div class="lbl">Pending</div><div class="val">${pending.length}</div></span>`,
    "Verified": `<span class="adm-stat green"><div class="lbl">Verified</div><div class="val">${verified.length}</div></span>`,
    "Rejected": `<span class="adm-stat red"><div class="lbl">Rejected</div><div class="val">${rejected.length}</div></span>`,
    "Amount": `<span class="adm-stat indigo"><div class="lbl">Total Verified Amount</div><div class="val">${currency(verifiedAmount)}</div></span>`,
    "Contributors": `<span class="adm-stat"><div class="lbl">Total Contributors</div><div class="val">${contributors}</div></span>`,
    "Today": `<span class="adm-stat"><div class="lbl">Today's Submissions</div><div class="val">${today}</div></span>`,
  };
  const grid = document.querySelector('[data-section="dashboard"] .adm-grid-stat');
  grid.innerHTML = Object.values(vals).join("");

  const recent = [...allContributions].sort((a, b) => tsNum(b.submittedAt) - tsNum(a.submittedAt)).slice(0, 6);
  const box = document.getElementById("dashboard-recent");
  box.innerHTML = recent.length
    ? `<div class="adm-table-wrap" style="overflow-x:auto;"><table class="adm-table">
        <thead><tr><th>Name</th><th>Category</th><th>Amount</th><th>Status</th><th>Time</th></tr></thead>
        <tbody>${recent.map((c) => `<tr>
          <td><strong>${esc(c.name)}</strong></td>
          <td>${CATEGORY_LABEL[c.category] || c.category}</td>
          <td class="amount">${currency(c.amount)}</td>
          <td>${badge(c.status)}</td>
          <td>${fmtTime(c.submittedAt)}</td></tr>`).join("")}
        </tbody></table></div>`
    : `<div class="empty-state" style="padding:20px;">No contributions yet.</div>`;
}

const tsNum = (ts) => (ts && typeof ts.toDate === "function" ? ts.toDate().getTime() : ts && ts.seconds ? ts.seconds * 1000 : 0);

/* generic table renderer */
function renderTable(id, rows, cols, cellBuilder) {
  const table = document.getElementById(id);
  const head = table.querySelector("thead");
  const body = table.querySelector("tbody");
  if (!head || !body) return;
  head.innerHTML = `<tr>${cols.map((c) => `<th>${c}</th>`).join("")}</tr>`;
  body.innerHTML = rows.length
    ? rows.map((r, i) => `<tr>${cellBuilder(r, i).map((t) => `<td>${t}</td>`).join("")}</tr>`).join("")
    : `<tr><td colspan="${cols.length}" style="text-align:center;color:var(--adm-muted);padding:24px;">No records.</td></tr>`;
  body.querySelectorAll("[data-act]").forEach((b) => {
    b.addEventListener("click", () => handleAction(b.dataset.act, b.dataset.id));
  });
}

function renderPending() {
  const rows = allContributions.filter((c) => c.status === "pending").sort((a, b) => tsNum(b.submittedAt) - tsNum(a.submittedAt));
  document.getElementById("pending-count").textContent = rows.length;
  renderTable("pending-table", rows, TABLE_COLS.pending, (c) => [
    `<strong>${esc(c.name)}</strong>`, esc(c.email || "—"), CATEGORY_LABEL[c.category] || c.category,
    `<span class="amount">${currency(c.amount)}</span>`,
    `<code>${esc(maskTxn(c.transactionId))}</code>`, fmtTime(c.submittedAt), rowActions(c.id, c.status),
  ]);
}

function renderVerified() {
  const rows = allContributions.filter((c) => c.status === "verified").sort((a, b) => tsNum(b.verifiedAt) - tsNum(a.verifiedAt));
  renderTable("verified-table", rows, TABLE_COLS.verified, (c) => [
    `<strong>${esc(c.name)}</strong>`, CATEGORY_LABEL[c.category] || c.category,
    `<span class="amount">${currency(c.amount)}</span>`, fmtTime(c.verifiedAt),
    esc(c.verifiedBy || "—"), rowActions(c.id, c.status),
  ]);
}

function renderRejected() {
  const rows = allContributions.filter((c) => c.status === "rejected").sort((a, b) => tsNum(b.verifiedAt) - tsNum(a.verifiedAt));
  renderTable("rejected-table", rows, TABLE_COLS.rejected, (c) => [
    `<strong>${esc(c.name)}</strong>`, CATEGORY_LABEL[c.category] || c.category,
    `<span class="amount">${currency(c.amount)}</span>`, fmtTime(c.verifiedAt),
    esc(c.rejectionReason || "—"), rowActions(c.id, c.status),
  ]);
}

function renderAllTable() {
  const rows = allContributions.filter((c) => activeAF === "all" || c.status === activeAF)
    .sort((a, b) => tsNum(b.submittedAt) - tsNum(a.submittedAt));
  renderTable("all-table", rows, TABLE_COLS.all, (c) => [
    `<strong>${esc(c.name)}</strong>`, CATEGORY_LABEL[c.category] || c.category,
    `<span class="amount">${currency(c.amount)}</span>`, badge(c.status), fmtTime(c.submittedAt), rowActions(c.id, c.status),
  ]);
}

/* ==================================================================
   ACTIONS (view / verify / reject)
================================================================== */
async function handleAction(action, id) {
  const c = allContributions.find((x) => x.id === id);
  if (!c) return;
  if (action === "view") openDetail(c);
  else if (action === "verify") openVerify(c);
  else if (action === "reject") openReject(c);
}

function openModal(html) {
  const wrap = document.createElement("div");
  wrap.innerHTML = html;
  const overlay = wrap.firstElementChild;
  document.body.appendChild(overlay);
  overlay.querySelector(".modal").focus();
  const close = () => overlay.remove();
  overlay.addEventListener("click", (e) => { if (e.target === overlay) close(); });
  overlay.querySelectorAll(".modal-close-trigger").forEach((b) => b.addEventListener("click", close));
  overlay.addEventListener("keydown", (e) => { if (e.key === "Escape") close(); });
  return { overlay, close };
}

function openDetail(c) {
  const { overlay, close } = openModal(`
    <div class="modal-overlay" tabindex="-1">
      <div class="modal" role="dialog" aria-modal="true" aria-labelledby="det-title">
        <div class="modal-head"><h3 id="det-title">Contribution Details</h3><button class="modal-close modal-close-trigger" aria-label="Close">×</button></div>
        <div class="modal-body">
          <div class="detail-grid">
            <div class="d-item"><div class="d-label">Name</div><div class="d-value">${esc(c.name)}</div></div>
            <div class="d-item"><div class="d-label">Email</div><div class="d-value">${esc(c.email || "—")}</div></div>
            <div class="d-item"><div class="d-label">Phone</div><div class="d-value">${esc(c.phone || "—")}</div></div>
            <div class="d-item"><div class="d-label">Roll Number</div><div class="d-value">${esc(c.rollNumber || "—")}</div></div>
            <div class="d-item"><div class="d-label">Category</div><div class="d-value">${CATEGORY_LABEL[c.category] || c.category}</div></div>
            <div class="d-item"><div class="d-label">Amount</div><div class="d-value">${currency(c.amount)}</div></div>
            <div class="d-item"><div class="d-label">Transaction Reference</div><div class="d-value"><code>${esc(c.transactionId)}</code></div></div>
            <div class="d-item"><div class="d-label">Status</div><div class="d-value">${badge(c.status)}</div></div>
            <div class="d-item"><div class="d-label">Submitted</div><div class="d-value">${fmtTime(c.submittedAt)}</div></div>
            <div class="d-item"><div class="d-label">Submitted By (admin)</div><div class="d-value">${c.verifiedBy ? esc(c.verifiedBy) : "—"}</div></div>
            <div class="d-item"><div class="d-label">Public Display</div><div class="d-value">${c.displayNamePublic ? "Yes" : "Anonymous"}</div></div>
            <div class="d-item"><div class="d-label">Rejection Reason</div><div class="d-value">${esc(c.rejectionReason || "—")}</div></div>
          </div>
          ${c.message ? `<p style="margin-top:14px;background:#f9fafb;padding:12px;border-radius:10px;font-style:italic;">“${esc(c.message)}”</p>` : ""}
        </div>
        <div class="modal-foot"><button class="btn-sm btn-cancel modal-close-trigger">Close</button></div>
      </div>
    </div>`);
  overlay.querySelector(".modal").addEventListener("click", () => {}); // noop to avoid focus steal
}

function openVerify(c) {
  const { overlay, close } = openModal(`
    <div class="modal-overlay" tabindex="-1">
      <div class="modal confirm-box" role="dialog" aria-modal="true" aria-labelledby="vf-title">
        <div class="modal-head"><h3 id="vf-title">Verify Contribution</h3><button class="modal-close modal-close-trigger" aria-label="Close">×</button></div>
        <div class="modal-body">
          <div class="big">✅</div>
          <div class="confirm-summary">
            <div class="row"><span class="k">Contributor</span><span><strong>${esc(c.name)}</strong></span></div>
            <div class="row"><span class="k">Amount</span><span><strong>${currency(c.amount)}</strong></span></div>
            <div class="row"><span class="k">Transaction Ref</span><span><code>${esc(c.transactionId)}</code></span></div>
            <div class="row"><span class="k">Category</span><span>${CATEGORY_LABEL[c.category] || c.category}</span></div>
          </div>
          <label class="kill-check"><input type="checkbox" id="verify-confirm">
            <span>Have you verified this contribution against the official payment records?</span></label>
        </div>
        <div class="modal-foot">
          <button class="btn-sm btn-cancel modal-close-trigger">Cancel</button>
          <button class="btn-sm btn-confirm" id="verify-go" disabled>Confirm Verification</button>
        </div>
      </div>
    </div>`);
  const box = overlay.querySelector("#verify-confirm");
  const go = overlay.querySelector("#verify-go");
  box.addEventListener("change", () => (go.disabled = !box.checked));
  go.addEventListener("click", async () => {
    go.disabled = true; go.textContent = "Verifying…";
    const ok = await verifyContribution(c);
    close();
    if (ok) toast("Contribution verified ✓", "success");
    else toast("Verification failed. Please try again.", "error");
  });
}

async function verifyContribution(c) {
  if (!admin) return false;
  const batch = writeBatch(db);

  // 1. Update contribution.
  try { await updateDoc(doc(db, "contributions", c.id), {
    status: "verified",
    verifiedAt: serverTimestamp(),
    verifiedBy: admin.uid,
  }); } catch (e) { console.error(e); return false; }

  // 2. Create public leaderboard entry with ONLY safe fields.
  try {
    await setDoc(doc(db, "publicLeaderboard", c.id), {
      contributionId: c.id,
      displayName: c.displayNamePublic === false ? "Anonymous Contributor" : (c.name || "Contributor"),
      category: c.category,
      amount: Number(c.amount || 0),
      verifiedAt: serverTimestamp(),
    });
  } catch (e) { console.error("Leaderboard entry failed", e); }

  // 3. Recompute stats (verified only) + write publicStats/summary.
  await refreshPublicStats();
  return true;
}

async function openReject(c) {
  const { overlay, close } = openModal(`
    <div class="modal-overlay" tabindex="-1">
      <div class="modal confirm-box" role="dialog" aria-modal="true" aria-labelledby="rj-title">
        <div class="modal-head"><h3 id="rj-title">Reject Contribution</h3><button class="modal-close modal-close-trigger" aria-label="Close">×</button></div>
        <div class="modal-body">
          <div class="big">🚫</div>
          <div class="confirm-summary">
            <div class="row"><span class="k">Contributor</span><span><strong>${esc(c.name)}</strong></span></div>
            <div class="row"><span class="k">Amount</span><span><strong>${currency(c.amount)}</strong></span></div>
            <div class="row"><span class="k">Transaction Ref</span><span><code>${esc(c.transactionId)}</code></span></div>
          </div>
          <div class="form-group">
            <label for="reject-reason">Reason for rejection (optional)</label>
            <textarea id="reject-reason" placeholder="e.g. Transaction not found in official records"></textarea>
          </div>
        </div>
        <div class="modal-foot">
          <button class="btn-sm btn-cancel modal-close-trigger">Cancel</button>
          <button class="btn-sm btn-confirm danger" id="reject-go">Confirm Rejection</button>
        </div>
      </div>
    </div>`);
  const reasonInput = overlay.querySelector("#reject-reason");
  const go = overlay.querySelector("#reject-go");
  go.addEventListener("click", async () => {
    go.disabled = true; go.textContent = "Rejecting…";
    const ok = await rejectContribution(c, reasonInput.value.trim());
    close();
    if (ok) toast("Contribution rejected.", "success");
    else toast("Rejection failed. Please try again.", "error");
  });
}

async function rejectContribution(c, reason) {
  if (!admin) return false;
  try {
    await updateDoc(doc(db, "contributions", c.id), {
      status: "rejected",
      rejectionReason: reason || null,
      verifiedAt: serverTimestamp(),
      verifiedBy: admin.uid,
    });
    // Defensive: remove any public leaderboard entry for this contribution.
    try { await deleteDoc(doc(db, "publicLeaderboard", c.id)); } catch {}
    await refreshPublicStats();
    return true;
  } catch (e) { console.error(e); return false; }
}

/* ==================================================================
   PUBLIC STATS (verified-only recompute)
================================================================== */
async function refreshPublicStats() {
  if (!admin) return;
  try {
    const q = query(collection(db, "contributions"), where("status", "==", "verified"));
    const snap = await getDocs(q);
    let totalAmount = 0, studentCount = 0, facultyCount = 0, staffCount = 0;
    const contributors = new Set();
    snap.forEach((d) => {
      const x = d.data();
      totalAmount += Number(x.amount || 0);
      contributors.add(x.userId);
      if (x.category === "student") studentCount++;
      else if (x.category === "faculty") facultyCount++;
      else if (x.category === "staff") staffCount++;
    });
    await setDoc(doc(db, "publicStats", "summary"), {
      totalAmount,
      totalContributors: contributors.size,
      studentCount, facultyCount, staffCount,
      lastUpdated: serverTimestamp(),
    });
  } catch (e) { console.error("Stats refresh failed", e); }
}

/* ==================================================================
   ANALYTICS (lightweight canvas charts)
================================================================== */
function renderAnalytics() {
  const verified = allContributions.filter((c) => c.status === "verified");
  const total = verified.reduce((s, c) => s + Number(c.amount || 0), 0);
  document.getElementById("an-total").textContent = currency(total);
  document.getElementById("an-count").textContent = verified.length;

  // Category breakdown
  const catCounts = { student: verified.filter((c) => c.category === "student").length,
    faculty: verified.filter((c) => c.category === "faculty").length,
    staff: verified.filter((c) => c.category === "staff").length };
  const catTotals = Object.values(catCounts).reduce((a, b) => a + b, 0);

  // Status breakdown
  const statusCounts = {
    pending: allContributions.filter((c) => c.status === "pending").length,
    verified: verified.length,
    rejected: allContributions.filter((c) => c.status === "rejected").length,
  };

  drawDonut("chart-category", "legend-category", [
    { label: "Students", value: catCounts.student, color: "#4f46e5" },
    { label: "Faculty", value: catCounts.faculty, color: "#f2761d" },
    { label: "Staff", value: catCounts.staff, color: "#10b981" },
  ]);

  drawDonut("chart-status", "legend-status", [
    { label: "Pending", value: statusCounts.pending, color: "#d97706" },
    { label: "Verified", value: statusCounts.verified, color: "#16a34a" },
    { label: "Rejected", value: statusCounts.rejected, color: "#dc2626" },
  ]);

  // Top contributors (by verified amount, per user)
  const byUser = {};
  verified.forEach((c) => {
    if (!byUser[c.userId]) byUser[c.userId] = { name: c.name, amount: 0, category: c.category };
    byUser[c.userId].amount += Number(c.amount || 0);
  });
  const top = Object.values(byUser).sort((a, b) => b.amount - a.amount).slice(0, 10);
  renderTable("top-table", top, TABLE_COLS.top, (u, i) => [
    `${i + 1}`, `<strong>${esc(u.name)}</strong>`, CATEGORY_LABEL[u.category] || u.category, `<span class="amount">${currency(u.amount)}</span>`,
  ]);
}

function drawDonut(canvasId, legendId, items) {
  const canvas = document.getElementById(canvasId);
  if (!canvas) return;
  const ctx = canvas.getContext("2d");
  const dpr = window.devicePixelRatio || 1;
  const size = 240;
  canvas.width = size * dpr; canvas.height = size * dpr;
  canvas.style.width = size + "px"; canvas.style.height = size + "px";
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, size, size);

  const total = items.reduce((s, i) => s + i.value, 0);
  const cx = size / 2, cy = size / 2, r = Math.min(size / 2 - 16, 96), thickness = 26;
  let start = -Math.PI / 2;

  if (total === 0) {
    ctx.strokeStyle = "#e5e7eb"; ctx.lineWidth = thickness;
    ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.stroke();
    ctx.fillStyle = "#6b7280"; ctx.font = "700 16px sans-serif"; ctx.textAlign = "center";
    ctx.fillText("No data", cx, cy + 6);
  } else {
    items.forEach((it) => {
      if (!it.value) return;
      const angle = (it.value / total) * Math.PI * 2;
      ctx.strokeStyle = it.color; ctx.lineWidth = thickness; ctx.lineCap = "butt";
      ctx.beginPath(); ctx.arc(cx, cy, r, start, start + angle); ctx.stroke();
      start += angle;
    });
    ctx.fillStyle = "#111827"; ctx.font = "800 22px sans-serif"; ctx.textAlign = "center";
    ctx.fillText(String(total), cx, cy + 8);
  }

  const legend = document.getElementById(legendId);
  if (legend) legend.innerHTML = items.map((it) =>
    `<span class="lg"><span class="sw" style="background:${it.color}"></span>${it.label}: ${it.value}</span>`).join("");
}

/* ==================================================================
   CSV EXPORT (browser-generated, with proper escaping)
================================================================== */
function csvCell(v) {
  const s = v == null ? "" : String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

function exportCSV() {
  const cols = ["Name", "Email", "Phone", "Roll Number", "Category", "Amount", "Transaction Reference", "Status", "Submitted At", "Verified At", "Verified By", "Rejection Reason"];
  const header = cols.map(csvCell).join(",") + "\n";
  const rows = allContributions
    .filter((c) => activeAF === "all" ? true : c.status === activeAF)
    .map((c) => [c.name, c.email, c.phone, c.rollNumber, c.category, c.amount, c.transactionId, c.status, fmtTime(c.submittedAt), fmtTime(c.verifiedAt), c.verifiedBy, c.rejectionReason]
      .map(csvCell).join(",")).join("\n");

  const blob = new Blob([header + rows], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `ganesh-utsav-contributions-${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
  toast(`Exported ${allContributions.filter((c) => activeAF === "all" ? true : c.status === activeAF).length} rows to CSV`, "success");
}

/* ==================================================================
   TOAST (standalone for admin theme)
================================================================== */
function toast(message, type = "info") {
  let wrap = document.querySelector(".toast-wrap");
  if (!wrap) { wrap = document.createElement("div"); wrap.className = "toast-wrap"; document.body.appendChild(wrap); }
  const el = document.createElement("div");
  el.className = `toast ${type}`;
  el.innerHTML = `<span>${esc(message)}</span><button class="t-close" aria-label="Dismiss">&times;</button>`;
  wrap.appendChild(el);
  const remove = () => { el.classList.add("leaving"); setTimeout(() => el.remove(), 250); };
  el.querySelector(".t-close").addEventListener("click", remove);
  setTimeout(remove, 3800);
}
