# Service Call Workflow — Email Ingestion Backend

A Cloudflare Worker that parses vendor dispatch emails (like the Armadillo Home
Solutions example) the instant they arrive — even if the app is closed — and
holds them in a D1 database until the frontend pulls them in as reviewable
work orders. See [PRD.md §10](../PRD.md#10-addendum--email-ingestion-added-2026-08-23)
for the architecture and why it's built this way.

**Claude cannot deploy this for you.** Deploying requires a Cloudflare account
login (`wrangler login`, an interactive OAuth flow) or an API token — both are
things only you can authorize. Everything below is code-complete and tested
locally; these are the commands to run yourself.

## One-time setup

```bash
cd server
npm install

# 1. Log into Cloudflare (opens a browser)
npx wrangler login

# 2. Create the D1 database
npx wrangler d1 create service-call-workflow-db
```

That last command prints a `database_id` — paste it into `wrangler.toml`,
replacing `REPLACE_WITH_D1_DATABASE_ID`.

```bash
# 3. Run the schema migration against the real (remote) database
npm run db:migrate:remote

# 4. Set the two secrets (you'll be prompted to type each value)
npx wrangler secret put ADMIN_PASSWORD      # the password the app will ask for
npx wrangler secret put SESSION_SECRET      # any long random string, e.g. `openssl rand -hex 32`

# 5. Deploy
npm run deploy
```

Deploy prints your Worker's URL — something like
`https://service-call-workflow-api.<your-subdomain>.workers.dev`.

## Wire the frontend to it

Set that URL as a **repository variable** (not secret — it's not sensitive) so
the GitHub Actions build picks it up:

```bash
gh variable set VITE_SYNC_API_URL --body "https://service-call-workflow-api.<your-subdomain>.workers.dev"
```

Push anything to `main` (or re-run the "Deploy to GitHub Pages" workflow) and
the live site will pick up the login gate and Email Sync page automatically.
For local dev, put the same value in `.env` at the repo root
(`VITE_SYNC_API_URL=...`), copied from `.env.example`.

## Connecting a real inbox (do this whenever you're ready)

The Worker exposes a native `email()` handler — Cloudflare can deliver mail
straight to it, no polling, no IMAP/Gmail API credentials needed on our side.

1. Point a domain's MX records at Cloudflare (Cloudflare dashboard → your
   domain → **Email** → **Email Routing** → follow the setup steps).
2. Under **Email Routing → Routing rules**, add a rule: an address (e.g.
   `orders@yourdomain.com`) → **Action: Send to a Worker** → select
   `service-call-workflow-api`.
3. Set up your existing inbox to forward matching vendor emails (e.g. an
   Armadillo/etc. dispatch address) to `orders@yourdomain.com` — either a
   filter/forwarding rule in Gmail, or ask the vendor to CC that address.

Once that's live, every matching email is parsed and queued the moment it
arrives, whether or not the app is open. Until then, use the **Email Sync**
page's "paste email to test" panel to try it with real samples.

## Local development

```bash
cd server
npm run db:migrate:local          # sets up a local D1 emulation
cp .dev.vars.example .dev.vars    # then edit ADMIN_PASSWORD / SESSION_SECRET
npm run dev                       # starts the Worker on http://localhost:8787
```

Run `npm run test:parser` to check the email parser against the bundled
Armadillo Home Solutions sample.
