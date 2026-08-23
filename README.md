# Service Call Workflow

A single-page web app implementing the 6-step service call workflow: intake a service order, generate a report and send it to a technician, track work order status on a Kanban board, attach documents to a job, and maintain a customer database.

Runs entirely in the browser. Data is stored locally in IndexedDB (via Dexie) — no backend, no accounts, nothing leaves the device.

See [PRD.md](./PRD.md) for the full product spec.

## Features

1. **New Service Order** — claim #, customer info, covered item (brand/model/serial), reported problem, appointment preference, authorization limit, repair rate, notes.
2. **Work Orders** — Kanban board (drag between statuses) and a searchable/filterable list view.
3. **Generate Report & Send to Technician** — formatted service report per order, dispatched via a pre-filled `mailto:` link.
4. **Status Tracking** — Pending Scheduling → Scheduled → Quote Needed Approval → Quote Approved → Ready for Invoicing → Closed, with a timestamped activity log per order.
5. **Document Attachments** — attach work orders, invoices, estimates, and photos to any job.
6. **Customer Database** — searchable customer list with full job history per customer.

## Development

```bash
npm install
npm run dev
```

## Build

```bash
npm run build
```

## Deployment

Pushing to `main` triggers `.github/workflows/deploy.yml`, which builds the app and publishes `dist/` to GitHub Pages.
