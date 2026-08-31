/**
 * leaderboard.js — Public leaderboard.
 *
 * IMPORTANT: This page reads ONLY the publicLeaderboard collection.
 * It NEVER queries the private `contributions` collection, so private
 * donor data (email, phone, roll no, transaction ref, message) is never
 * fetched by the browser.
 */

import { db } from "./firebase-config.js";
import { collection, onSnapshot, query, orderBy, limit } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

const CATEGORY_LABEL = { student: "Student", faculty: "Faculty", staff: "Staff" };
const MAX_ROWS = 100;

let allEntries = [];
let activeFilter = "all";
let search = "";

function render() {
  const q = search.trim().toLowerCase();
  const filtered = allEntries.filter((e) => {
    if (activeFilter !== "all" && e.category !== activeFilter) return false;
    if (q && !(e.displayName || "").toLowerCase().includes(q)) return false;
    return true;
  });

  // Podium = top 3 of FULL list (not filtered), regardless of filter.
  renderPodium(allEntries);
  renderTable(filtered);
}

function renderPodium(entries) {
  const el = document.getElementById("podium");
  if (!el) return;
  const top = entries.slice(0, 3);
  if (top.length === 0) { el.innerHTML = ""; return; }
  const medal = ["🥇", "🥈", "🥉"];
  const order = [1, 0, 2]; // 2nd place, 1st place, 3rd place for visual podium
  el.innerHTML = order.map((idx) => {
    const e = top[idx];
    if (!e) return "";
    return `<div class="podium-item podium-${idx + 1}">
      <div class="place">${medal[idx]}</div>
      <div class="name">${window.escapeHtml(e.displayName)}</div>
      <div class="amt">${window.currency(e.amount)}</div>
      <div class="bar">${idx + 1}</div>
    </div>`;
  }).join("");
}

function renderTable(entries) {
  const body = document.getElementById("lb-body");
  const empty = document.getElementById("lb-empty");
  if (!body) return;

  if (entries.length === 0) {
    body.innerHTML = `<tr><td colspan="4"><div class="empty-state" style="padding:30px;"><span class="emoji">🙏</span><p>No matching contributors yet.</p></div></td></tr>`;
    empty.style.display = entries.length === 0 && allEntries.length === 0 ? "block" : "none";
    return;
  }
  empty.style.display = "none";
  body.innerHTML = entries.map((e, i) => {
    const rank = allEntries.indexOf(e) + 1; // true overall rank
    const top = rank <= 3;
    return `<tr>
      <td><span class="rank-badge${top ? " top" : ""}">${rank}</span></td>
      <td><strong>${window.escapeHtml(e.displayName)}</strong></td>
      <td>${CATEGORY_LABEL[e.category] || e.category}</td>
      <td class="amount">${window.currency(e.amount)}</td>
    </tr>`;
  }).join("");
}

function bindControls() {
  document.querySelectorAll(".chip-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      document.querySelectorAll(".chip-btn").forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");
      activeFilter = btn.dataset.filter;
      render();
    });
  });
  const searchEl = document.getElementById("lb-search");
  if (searchEl) searchEl.addEventListener("input", () => { search = searchEl.value; render(); });
}

document.addEventListener("DOMContentLoaded", () => {
  bindControls();

  const q = query(
    collection(db, "publicLeaderboard"),
    orderBy("amount", "desc"),
    limit(MAX_ROWS)
  );

  try {
    onSnapshot(q, (snap) => {
      allEntries = snap.docs.map((d) => d.data());
      render();
      document.body.classList.remove("is-loading");
      const loader = document.getElementById("page-loader");
      if (loader) loader.style.display = "none";
    }, (err) => {
      console.error("Leaderboard load failed", err);
      document.body.classList.remove("is-loading");
      const loader = document.getElementById("page-loader");
      if (loader) loader.style.display = "none";
      document.getElementById("lb-empty").style.display = "block";
      document.getElementById("lb-empty").innerHTML = `<span class="emoji">⚠️</span><p>Could not load the leaderboard right now.</p>`;
    });
  } catch (e) {
    console.error(e);
    document.body.classList.remove("is-loading");
  }
});
