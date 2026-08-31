/**
 * index-stats.js — Homepage public statistics.
 *
 * IMPORTANT: This reads ONLY the publicStats/summary document that admins
 * maintain. It does NOT query the private `contributions` collection, so
 * public visitors never access private donor data.
 */

import { db } from "./firebase-config.js";
import {
  doc,
  onSnapshot,
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

const STATS_DOC = doc(db, "publicStats", "summary");

function render(stats) {
  const el = document.getElementById("public-stats");
  if (!el) return;
  const data = stats && stats.data ? stats.data() : null;

  const amount = data ? Number(data.totalAmount || 0) : null;
  const contributors = data ? Number(data.totalContributors || 0) : null;
  const students = data ? Number(data.studentCount || 0) : null;
  const facultyStaff = data ? Number((data.facultyCount || 0) + (data.staffCount || 0)) : null;

  el.innerHTML = `
    <div class="stat-card">
      <div class="num">${amount == null ? "—" : window.currency(amount)}</div>
      <div class="lbl">Total raised (verified)</div>
    </div>
    <div class="stat-card">
      <div class="num">${contributors == null ? "—" : contributors}</div>
      <div class="lbl">Contributors</div>
    </div>
    <div class="stat-card">
      <div class="num">${students == null ? "—" : students}</div>
      <div class="lbl">Students</div>
    </div>
    <div class="stat-card">
      <div class="num">${facultyStaff == null ? "—" : facultyStaff}</div>
      <div class="lbl">Faculty &amp; Staff</div>
    </div>`;
}

try {
  onSnapshot(STATS_DOC, (snap) => render(snap), (err) => {
    console.error("Failed to load public stats", err);
    render(null);
  });
} catch (e) {
  console.error("Public stats init error", e);
  render(null);
}
