# 🪷 Ganesh Utsav IIT Mandi 2026 — Contribution Portal

A production-quality, **static** donation collection & verification platform for
**Ganesh Utsav 2026, IIT Mandi**, built to run entirely on **GitHub Pages**.

- **Frontend:** HTML5 · CSS3 · Vanilla JavaScript (no build step, no npm)
- **Backend-as-a-Service:** Firebase Authentication + Cloud Firestore
- **Hosting:** GitHub Pages (static site; Firebase web config is public by design)

---

## 1. Project Overview

The portal lets authorized IIT Mandi community members contribute securely to
the festival and lets organizers verify each payment before it becomes public.

**Core flow:** Visitor → Landing → Contribute (mandatory sign-in) → Category
(Student/Faculty/Staff) → Pay via official UPI → Enter transaction reference →
`status = pending` → Admin verifies → `status = verified` → public leaderboard +
stats update.

**Nobody can submit a contribution without authentication.** The Firestore
rules enforce this server-side, and unauthenticated visits to `donate.html` /
`my-contributions.html` redirect to `login.html`.

---

## 2. Features

- Mandatory **Google Sign-In** (with optional email/password for **admins only**)
- Configurable **IIT Mandi email-domain restriction** (easy on/off)
- Contribution flow: category cards, roll number (students only), pre-filled
  name/email, amount, message, UPI **QR + UPI ID**, UTR reference, display-name toggle
- **No card/OTP/UPI-PIN collection** — guest pays via their own UPI app
- **Mandatory payment confirmation** checkbox + UTR before submit
- **Duplicate-transaction safeguard** (best-effort client check; see limitations)
- **My Contributions** — each user sees only their own history with masked UTR
- **Admin dashboard** (SaaS-style): Dashboard, Pending, Verified, Rejected, All,
  Analytics; verify/reject with confirmation modals; CSV export; canvas charts
- **Public leaderboard** (podium + full list, filters, search) reading only the
  public collection
- **Public stats** on the homepage reading only `publicStats/summary`
- Toast notifications, skeleton loaders, button/loading states
- Fully responsive (320px → 1440px), accessible (semantic HTML, ARIA, focus
  states, Escape closes modals, `prefers-reduced-motion`)
- SEO meta + Open Graph tags

---

## 3. Project Structure

```
ganesh-utsav-donation/
├── index.html               Home + public stats
├── login.html               Contributor sign-in (Google)
├── donate.html              Contribution form (auth required)
├── leaderboard.html         Public leaderboard (no login)
├── about.html               About page
├── my-contributions.html    User's own contributions (auth required)
│
├── admin-login.html         Organizer login (email/password)
├── admin.html               Admin dashboard (auth + role gates)
│
├── style.css                Public (festive) + admin (SaaS) themes
├── script.js                Public shared logic (nav, toasts, auth state)
├── index-stats.js           Homepage public stats reader
├── auth-config.js           Email-domain restriction config
├── auth.js                  (see below) — auth-state helper
├── firebase-config.js       PASTE your Firebase web config here
├── payment-config.js        Official UPI ID + QR + instructions
├── login.js / donate.js / leaderboard.js / my-contributions.js
├── admin-login.js / admin.js
│
├── firestore.rules          Security rules (deploy to Firebase)
├── README.md
│
└── assets/
    ├── images/              upi-qr.png (REPLACE), og-banner.png
    └── icons/               favicon.svg
```

> **Note on `auth.js`:** the auth-state logic that the whole site shares lives in
> `script.js` (navbar/session). `auth.js` is intentionally not required — the
> public pages inherit auth handling from `script.js`. If you prefer an explicit
> `auth.js`, add a one-line re-export (see "Optional file" note at the end).

---

## 4. Firebase Setup

1. Go to the [Firebase Console](https://console.firebase.google.com) and create a
   new project (e.g. `ganesh-utsav-2026`).
2. **Project Settings → General → Your apps → Web (</>)**. Register a web app.
3. Copy the displayed `firebaseConfig` object into `firebase-config.js`
   (replace the `YOUR_*` placeholders).
4. Enable **Cloud Firestore** → **Create database** (production mode is fine;
   the rules in this repo are the guardrails).

---

## 5. Enable Authentication Providers

Firebase Console → **Build → Authentication → Sign-in method**:

**Google → Enable** (primary contributor sign-in).
- Under **Authorized domains**, Firebase automatically allows `*.firebaseapp.com`.
- For GitHub Pages, **add your Pages domain** to the authorized domains list
  (e.g. `yourusername.github.io`). This is required for Google sign-in to work
  from your hosted site. → **Important**: see section 13.

**Email/Password → Enable** (supports email sign-in **and** sign-up for
contributors, plus admin login).
- Contributors can create an account on `login.html` (Create Account tab) using
  their IIT Mandi email. Sign-up is blocked for disallowed domains (see §7).
- **Email/password does NOT grant admin access** — the dashboard is still gated
  separately by the `admins/{uid}` role (`admin-login.html`).

---

## 6. Configure Authorized Domains

Firebase Console → **Authentication → Settings → Authorized domains**. Add:
- `yourusername.github.io` (your GitHub Pages host)

If you use a custom domain (e.g. `gives.ganeshutsav.com`), add that too. **Only
the current deployment host needs to be listed**; Firebase rejects sign-ins from
unlisted origins.

---

## 7. Configure the Allowed IIT Mandi Email Domain

Edit **`auth-config.js`**:

```js
export const AUTH_SETTINGS = {
  restrictEmailDomain: true,          // set false to allow any Google account
  allowedDomains: ["iitmandi.ac.in"], // add all official domains
  restrictedMessage:
    "This contribution portal is restricted to authorized IIT Mandi community members.",
};
```

> ⚠️ **CONFIRM THE OFFICIAL IIT MANDI STUDENT/FACULTY EMAIL DOMAIN BEFORE
> ENABLING RESTRICTION.** Ask the organizing team / institute IT cell whether the
> real domain is `iitmandi.ac.in`, `students.iitmandi.ac.in`, or another suffix,
> and add every official variant to `allowedDomains`.

When restriction is on, a user with a disallowed domain is signed out and shown
the friendly error. When `restrictEmailDomain` is `false`, the same portal works
for any Google account (with the same rule architecture).

---

## 8. Create the First Admin

Because public users must **not** be able to write to `admins`, the very first
admin is created manually. (This is the bootstrap limitation — the rules cannot
bootstrap the first admin by themselves.)

**STEP 1 — Create the Auth user:**
Firebase Console → **Authentication → Users → Add user**. Enter the admin's
**email** and a **password**. (Email/password sign-in must be enabled under
Sign-in method for this to work.)

**STEP 2 — Copy the user UID:**
The **User UID** is shown in the Users list (or "User details").

**STEP 3 — Create `admins/{UID}`:**
Firebase Console → **Firestore Database** → ensure the rules below are deployed
first (or temporarily loosen, then re-deploy). Add a document:
- Collection: `admins`
- Document ID: **the admin UID**
- Fields:
  - `email`: `"admin@example.com"`
  - `role`: `"admin"`
  - `createdAt`: (server timestamp)

**Repeat** for every organizer. After the first one exists, further admins can be
added only by an existing admin via the console (rules block non-admins).

> **Bootstrap limitation:** The very first `admins/{uid}` doc must be created via
> the console (or a one-off Cloud Function), because a normal authenticated user
> can never write to `admins`. This is by design.

---

## 9. Configure Firestore (Collections)

After the first admin is created, the app will create documents as users sign in,
submit, and admins verify:

| Collection             | Writable by            | Notes |
|------------------------|------------------------|-------|
| `users/{uid}`          | own user (profile)     | role forced to `contributor` |
| `contributions/{id}`   | own user (create), admins (all) | status always starts `pending` |
| `admins/{uid}`         | admins only            | role gate for the dashboard |
| `publicLeaderboard/{id}` | admins only            | public safe fields only |
| `publicStats/summary`  | admins only            | verified-only aggregates |

---

## 10. Deploy Firestore Rules

1. **Install the Firebase CLI** (optional but recommended):
   ```bash
   npm install -g firebase-tools
   firebase login
   ```
2. In the project folder, create `firebase.json`:
   ```json
   {
     "firestore": { "rules": "firestore.rules", "indexes": "firestore.indexes.json" }
   }
   ```
3. Deploy:
   ```bash
   firebase use --add      # select your project
   firebase deploy --only firestore:rules
   ```
   (You can also paste `firestore.rules` into the console: **Firestore →
   Rules**.)

The rules in `firestore.rules`:
- **Contributors** can create only their own contribution with `status ==
  'pending'`, `verifiedAt == null`, `verifiedBy == null` — they can never self-
  verify or self-reject.
- **Contributors** read only their own contributions; **admins** read all.
- **Public** reads `publicLeaderboard` and `publicStats`; only **admins** write them.
- **`admins`** is readable/writable only by admins (first one via console).

---

## 11. Add the UPI QR & UPI ID

Edit **`payment-config.js`**:

```js
export const PAYMENT_CONFIG = {
  upiId: "REPLACE_WITH_OFFICIAL_UPI_ID",   // e.g. "ganeshutsav@ybl"
  qrCodePath: "./assets/images/upi-qr.png", // drop the official QR here
  payeeName: "Ganesh Utsav IIT Mandi",
  instructions: "…",
  currencySymbol: "₹",
};
```

- **Upload the official QR** to `assets/images/upi-qr.png` (overwrite the
  placeholder). The QR is rendered on `donate.html`.
- If the QR image is missing, the page gracefully shows the UPI ID text instead.
- **Never** put real card/OTP/UPI-PIN inputs in this app — the contributor pays
  in their own UPI app, then submits the transaction reference.

---

## 12. GitHub Pages Deployment

1. Push this folder to a GitHub repository (e.g. `ganesh-utsav-donation`).
2. **Repo → Settings → Pages → Source → Deploy from a branch → `main` →
   `/ (root)` → Save.**
3. Your site is live at `https://<username>.github.io/ganesh-utsav-donation/`.
4. **Add that URL as an Authorized Domain** in Firebase Auth (section 6) so
   Google Sign-In works.
5. Update the `canonical` / `og:url` in each `<head>` if you use a custom domain.

> All links use **relative paths** (`./`, `../`), so the site works in a
> subfolder like `/ganesh-utsav-donation/` as well as at the domain root.

---

## 13. Firestore Indexes

The app needs a **composite index** for `my-contributions.js`:

```
Collection:   contributions
Fields:       userId (Ascending), submittedAt (Descending)
```

Create it automatically when warned in the console, or add a
`firestore.indexes.json` and deploy:

```json
{
  "indexes": [
    {
      "collectionGroup": "contributions",
      "queryScope": "COLLECTION",
      "fields": [
        { "fieldPath": "userId", "order": "ASCENDING" },
        { "fieldPath": "submittedAt", "order": "DESCENDING" }
      ]
    }
  ],
  "fieldOverrides": []
}
```

The admin dashboard's `contributions` snapshot and status queries are
single-field `==` conditions and need **no** composite index.

---

## 14. Security Limitations (read carefully)

This platform uses **Firebase directly from a static GitHub Pages frontend**.
The Firebase web configuration is **public by design** — hiding it provides no
real security. Actual protection comes from:

- **Firebase Authentication** (verified identity)
- **Firestore Security Rules** (`firestore.rules`) — the real authorization layer
- **Role separation** via the `admins` collection + `isAdmin()` helper
- **Public/private data separation** (public collections vs. private
  `contributions`)

**What this system is NOT:**
- It is **not** equivalent to a banking-grade backend.
- **Client-side duplicate detection is best-effort only.** A determined client
  could bypass the in-browser check. For guaranteed uniqueness of transaction
  references, a server-side enforcer (e.g. a Firestore `transaction`/`create`
  with a composite uniqueness key, or a Cloud Function) is required.
- Admin verification trusts that the admin account is secure. Anyone with admin
  credentials can verify/reject contributions.
- The first `admins` user must be bootstrapped in the **Console** (see §8).

**For high-value financial systems**, we strongly recommend adding trusted
server-side code, e.g. **Firebase Cloud Functions / App Check**, to:
- enforce uniqueness of transaction references server-side,
- re-validate "verified" transitions,
- provide tamper-evident audit logs.

Do not treat this static-only build as a substitute for such measures.

---

## 15. Testing Checklist

- [ ] Unauthenticated visit to `donate.html` → redirected/prompted to log in.
- [ ] Google sign-in works on the live GitHub Pages URL (authorized domains set).
- [ ] Email-domain restriction blocks disallowed domains with the friendly error.
- [ ] Allowed domain user can sign in and the form pre-fills name/email (email
      read-only).
- [ ] Student category reveals Roll Number field; Faculty/Staff don't require it.
- [ ] Submitting without UTR or without the confirmation checkbox is blocked.
- [ ] New contribution appears as **Pending** in admin → **Pending**.
- [ ] Admin **Verify** shows the confirmation modal; confirm sets
      `verified` + creates the public leaderboard entry + updates stats.
- [ ] After verification, the name/amount appears on `leaderboard.html` and the
      homepage stats update (verified-only totals).
- [ ] Admin **Reject** sets `rejected` + reason; the entry never appears publicly
      and counts toward nothing.
- [ ] `my-contributions.html` shows only the signed-in user's rows with masked
      UTR and correct status note per status.
- [ ] A user cannot see another user's contributions (rules block reads).
- [ ] Duplicate UTR for the same user shows the warning toast.
- [ ] CSV export downloads correct, escaped columns.
- [ ] Analytics charts render; status/category counts look right.
- [ ] Responsive: 320/375/425/768/1024/1440 — hamburger, stacked forms, tables
      scroll on small widths, admin sidebar collapses.
- [ ] Accessibility: modals focus, Escape closes, labels present, reduced-motion
      respected.
- [ ] Console (Firestore → Rules) shows **no errors** and allowed/denied test
      cases behave as documented.

---

## 16. Optional File Note (`auth.js`)

The public pages rely on `script.js` for the shared auth-state + navbar, so an
empty/re-export `auth.js` is not required for the app to work. If you want the
file present for clarity, add:

```js
// auth.js — re-export of shared auth helpers (see script.js)
export { initAuth } from "./script.js";
```

That keeps the repo "complete" without duplicating logic.

---

### Final manual steps for the organizer

1. **Paste your Firebase config** into `firebase-config.js`.
2. **Enable Google** and **Email/Password** in Authentication (both needed for
   the login page's sign-in + Create Account tabs; Email/Password is also what
   the admin account uses).
3. **Add your GitHub Pages domain** to Authorized Domains.
4. **Confirm + set the IIT Mandi email domain** in `auth-config.js`.
5. **Create the first admin** (Auth user + `admins/{UID}` doc) in the console.
6. **Deploy `firestore.rules`** (and the index in §13).
7. **Drop the official UPI QR** at `assets/images/upi-qr.png` and set the UPI ID
   in `payment-config.js`.
8. **Deploy to GitHub Pages**, then re-test on the live URL.
