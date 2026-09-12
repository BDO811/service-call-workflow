# Service Call Workflow App — PRD

## 1. Summary
A web app that implements the 6-step service call workflow: intake a service order, get it into the system, generate a report and send it to a technician, track work order status, attach documents to a job, and maintain a searchable customer database. Single-user tool, runs entirely in the browser, no backend server, data persists locally via IndexedDB. Deployed as a static site on GitHub Pages.

## 2. Goals
- Cover all 6 steps in the diagram end to end, in one app, with no manual re-entry between steps.
- Fast to use for a single dispatcher/admin entering and tracking service calls.
- Deployable for free with no ongoing hosting cost (GitHub Pages).
- Data stays on the user's device (no third-party server, no accounts).

## 3. Non-goals (v1)
- No real email/SMS delivery to technicians — "send to technician" generates a shareable report (printable PDF-style view + `mailto:` link) instead of actually dispatching mail.
- No multi-user login, roles, or sync across devices — v1 is single-browser local storage.
- No payment/invoicing processing — invoices are tracked as attached documents/status only, not generated or billed.

## 4. Users
- Single admin/dispatcher persona: creates service orders, assigns/sends to technicians, tracks status, manages the customer list.

## 5. Feature mapping (from workflow diagram)

### Step 1 — Service Order Information
Form to capture a new service order: Claim #, Customer Name, Address, Phone, Email, Covered Item, Brand/Model/Serial, Reported Problem, Appointment Preferences, Authorization Limits, Repair Rates, Notes. Linked to an existing customer or creates a new customer record.

### Step 2 — Import Data Into Web Application
Step 1's form *is* the import — data is entered directly into the app and stored immediately (no separate import step needed in a single-app design). Also supports CSV import of service orders for bulk entry.

### Step 3 — Generate Service Report & Send to Technician
From a work order, generate a formatted service report (full job details, customer info, reported problem, appointment window, authorization limits, notes). "Send to technician" opens a pre-filled `mailto:` link (or SMS-style share) and marks the order as "Sent to Technician" with a timestamp.

### Step 4 — Track Work Order Status
Each work order has a status: `Pending Scheduling → Scheduled → Quote Needed Approval → Quote Approved → Ready for Invoicing → Closed`. Kanban board view (drag between columns) plus list view with a status toggle. Status changes are timestamped in an activity log on the order.

Documents (work orders, invoices, estimates, photos) can be attached to any job (stored as files in IndexedDB, since there's no server to upload to).

### Step 5 — Store in Database
All orders, customers, and attached documents persist locally (IndexedDB). Search/filter by customer, date, technician, status. View full job history per customer or per order.

### Step 6 — Customer Database
Customer list: name, phone, email, service address, job history (linked work orders), notes. Create/edit/delete customers; view all past and open jobs for a customer from their profile.

## 6. Data model
- **Customer**: id, name, phone, email, address, notes, createdAt
- **WorkOrder**: id, claimNumber, customerId, coveredItem { brand, model, serial }, reportedProblem, appointmentPreference, authorizationLimit, repairRate, notes, status, technicianName, technicianContact, sentToTechnicianAt, createdAt, updatedAt, activityLog[{ ts, note }]
- **Document**: id, workOrderId, name, type (work_order | invoice | estimate | photo | other), fileBlob, uploadedAt

## 7. Tech stack
- React + TypeScript + Vite (SPA)
- IndexedDB via Dexie.js for storage
- react-router for navigation (Dashboard, Work Orders, Work Order Detail, Customers, Customer Detail, New Order)
- Plain CSS (no external UI framework dependency) for a lightweight, fast build
- Deployed via GitHub Actions → GitHub Pages on every push to `main`

## 8. Screens
1. **Dashboard** — counts by status, recent activity
2. **New Service Order** — Step 1 form
3. **Work Orders** — list + Kanban (Step 4), filters/search (Step 5)
4. **Work Order Detail** — full info, status toggle, activity log, generate report + send to technician (Step 3), attach documents (Step 4)
5. **Customers** — searchable list (Step 6)
6. **Customer Detail** — contact info, job history, notes

## 9. Success criteria
- Can create a service order, see it appear in Work Orders and on the Customer's profile, move it through every status, attach a document, generate and "send" a report, all without a page reload losing data (persisted across browser sessions).
- App builds and deploys cleanly to GitHub Pages via CI on push to `main`.

## 10. Addendum — Email ingestion (added 2026-08-23)

**Goal:** dispatch emails from vendors (e.g. Armadillo Home Solutions) land automatically as reviewable work orders, without manual re-typing.

**Decisions (confirmed with Amit 2026-08-23):**
- **Inbox**: not connected yet — Amit will wire up the actual forwarding rule later. Everything on the processing side is built and ready ahead of that.
- **Processing mode**: always-on backend, not in-app polling. A small Cloudflare Worker parses and stores incoming emails the instant they arrive, independent of whether the app is open. Chosen over pure client-side polling because "process the moment it arrives" was the explicit requirement.
- **Parser scope**: general-purpose from day one, not Armadillo-only. Built as a label/value + heuristic extractor that degrades gracefully (flags `needsReview`) rather than a rigid per-vendor template.

**Architecture — sync, not migrate:** The existing local-first app (Dexie/IndexedDB, this PRD's original v1 design) stays exactly as it is and remains the system of record for day-to-day use. The Worker backend does **not** replace it. Instead:
1. Inbound email → Cloudflare Email Routing → Worker `email()` handler → general-purpose parser → row written to a D1 table `inbox_orders` (raw text retained, structured fields extracted, `needsReview` flag set if core fields are missing/ambiguous).
2. The frontend, on load and periodically while open, calls the Worker's `/api/inbox-orders` endpoint, pulls any new rows, and creates/updates the matching Customer + WorkOrder in local Dexie (`source: 'email'`, vendor name/email captured, `needsReview` carried over, raw email text preserved for audit), then acks the row so it isn't re-imported.
3. This keeps the always-on guarantee (parsing happens the instant the email arrives, laptop closed or not) while avoiding a full rewrite of the already-shipped, tested app.

**Security note:** the frontend is a public, unauthenticated static site on GitHub Pages. Once real customer PII (names, phones, addresses) starts flowing through a backend that page talks to, an open API would leak that data to anyone who finds the URL. A gate (Worker-issued token, checked on every API call) was added to close that gap — see the addendum below for how it evolved from a single shared password into per-admin email/password logins.

**Deploy dependency:** deploying the Worker requires a Cloudflare account login (`wrangler login`) or an API token — Claude cannot create accounts or complete interactive OAuth on Amit's behalf, so this step is Amit's to run. See README for exact commands.

## 11. Addendum — Per-admin email/password logins (added 2026-08-24)

**Goal:** replace the single shared admin password with real accounts — each admin signs in with their own email and password, from a link in the axiom-hvac.com top bar and footer.

**Decisions:**
- **No public sign-up.** Admin accounts are created by running `server/scripts/create-admin.mjs` locally (hashes the password, prints a SQL `INSERT`, you run it against D1 yourself) — appropriate for a small, known set of admins on an internal tool, not a public product.
- **Storage:** a new `users` table in the same D1 database (`migrations/0002_users.sql`) — `email` (unique), `password_hash`, `password_salt`, `created_at`.
- **Hashing:** PBKDF2-HMAC-SHA256, 100,000 iterations, random 16-byte salt per user, via the Web Crypto API (`server/src/passwords.ts`). No native/WASM dependency, so the exact same code runs in both the Worker and the plain-Node seeding script.
- **Session tokens:** `/api/login` now takes `{ email, password }`, looks the user up in D1, verifies the hash, and issues an HMAC-signed token that carries the verified email as its payload (`server/src/auth.ts`) instead of being tied to a single shared secret string.
- **`ADMIN_PASSWORD` secret retired.** Only `SESSION_SECRET` remains — it signs tokens, it doesn't gate login on its own anymore.

## 12. Addendum — OCR extraction + auto-notify (added 2026-09-12)

**Goal:** the instant a dispatch email lands, it should be fully parsed (including scanned/photographed attachments, not just body text) and automatically emailed to Jeff and the assigned tech — no manual "paste into the test panel" or manual "send to technician" click required for the initial notify.

**Decisions:**
- **Extraction: Gemini, with the existing regex parser as fallback, not a replacement.** Gemini reads the email body and any image/PDF attachments in one call — that doubles as OCR for vendors who send a scanned/photographed dispatch sheet instead of (or in addition to) text in the body. Chosen for its free tier (no cost to start) and native multimodal document understanding, so a separate OCR step isn't needed. If `GEMINI_API_KEY` is unset, or the call fails for any reason, extraction transparently falls back to the original regex parser (`server/src/parser.ts`) — an order is never lost to a flaky or unconfigured extractor. Which path ran is recorded per-order (`extraction_method` column) for debugging.
- **Auto-notify: Gmail SMTP, not a third-party email API.** Cloudflare Workers have no outbound SMTP by default, but do expose raw TCP sockets (`cloudflare:sockets`) — `server/src/smtp.ts` is a small hand-rolled SMTP client that connects to `smtp.gmail.com:465` and authenticates with a Google account App Password. Chosen over Resend/SendGrid/etc. specifically to avoid a new third-party account: it sends through a Google account Amit already owns, free within Gmail's own sending limits (500/day personal, 2,000/day Workspace — far more than this app's volume), no signup or domain verification required.
- **"The tech" recipient is a single fixed address (`TECH_EMAIL`), not per-job.** The technician for a specific job isn't known at intake time — today it's a field a human fills in later on the work order (`WorkOrderDetail.tsx`). Rather than block auto-notify on that, `TECH_EMAIL` is one standing config value (can be a real inbox or a carrier email-to-SMS gateway for a text alert) that gets every new order alongside Jeff — currently both point at `jeff@myhomesa.com` and are deduped so that inbox doesn't get the same email twice. Assigning/confirming the actual field tech per job stays a manual step in the app, unchanged.
- **Order capture is never blocked by extraction or notify failures.** The email is always parsed (regex at worst) and written to `inbox_orders` first; the Jeff/tech emails are sent after, and any failure is caught and recorded (`notify_errors`) rather than losing the order.
- **All of it is opt-in via config.** With `GEMINI_API_KEY`/`GMAIL_APP_PASSWORD`/`GMAIL_USER`/`JEFF_EMAIL`/`TECH_EMAIL` unset, behavior is identical to before this addendum: regex-only parsing, no auto-emails. See `server/README.md` for the setup steps (Amit's to run — same Cloudflare-account-and-API-key constraint as the rest of the backend).
