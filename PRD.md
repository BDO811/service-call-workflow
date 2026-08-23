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
