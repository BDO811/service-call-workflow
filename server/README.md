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

# 2. Create the D1 database (skip if you already ran this — check wrangler.toml,
#    if database_id is already filled in, it's done)
npx wrangler d1 create service-call-workflow-db
```

That last command prints a `database_id` — paste it into `wrangler.toml`,
replacing `REPLACE_WITH_D1_DATABASE_ID`.

```bash
# 3. Run the schema migrations against the real (remote) database.
#    If you already ran db:migrate:remote before today, only run the second
#    one — re-running 0001 against a database that already has it will error
#    ("table already exists").
npm run db:migrate:remote          # inbox_orders table
npm run db:migrate:remote:users    # users table (admin logins)

# 4. Set the session secret (you'll be prompted to type the value)
npx wrangler secret put SESSION_SECRET      # any long random string, e.g. `openssl rand -hex 32`

# 5. Deploy
npm run deploy
```

Deploy prints your Worker's URL — something like
`https://service-call-workflow-api.<your-subdomain>.workers.dev`.

## Admin logins

There's no shared password and no public sign-up — each admin gets their own
email + password, stored (hashed, never in plaintext) in the `users` D1 table.
To add yourself as the first admin:

```bash
node scripts/create-admin.mjs "you@example.com" "your-password" > /tmp/add-admin.sql
npx wrangler d1 execute service-call-workflow-db --remote --file=/tmp/add-admin.sql
rm /tmp/add-admin.sql
```

Run it again with a different email any time you want to add another admin.
The password never leaves your machine — the script only hashes it locally
and prints the INSERT statement for the row.

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

## OCR extraction + auto-notify (Gemini + Gmail SMTP)

Every inbound email is extracted with Gemini (free tier) first — it reads the
email text *and* any image/PDF attachments directly (that's the OCR step:
photographed or scanned dispatch sheets get read the same as plain text), and
falls back automatically to the regex parser if Gemini errors or isn't
configured. Once an order is captured, it auto-emails Jeff and the tech by
sending through Gmail's SMTP relay with an account App Password (see
`server/src/smtp.ts`) — no third-party email API or account, just a Google
account you already have. Both extraction and notify are optional — leave the
keys/vars unset and the app behaves exactly as before (regex-only parsing, no
auto-emails).

1. **Gemini API key** (free): go to https://aistudio.google.com/apikey, create
   a key, then:
   ```bash
   npx wrangler secret put GEMINI_API_KEY
   ```
2. **Gmail App Password** (free, no signup): pick the Google account that
   should send these emails (it can be `jeff@myhomesa.com` if that address is
   Gmail/Google Workspace-hosted, or any other Gmail account — the "To" and
   "From" addresses don't have to match).
   - Turn on 2-Step Verification if it isn't already: https://myaccount.google.com/security
   - Generate an App Password at https://myaccount.google.com/apppasswords
     (choose "Mail" as the app) — copy the 16-character password.
   - `npx wrangler secret put GMAIL_APP_PASSWORD` and paste it.
   - Free within Gmail's own sending limits (500/day personal, 2,000/day
     Workspace) — trivial for this app's volume.
3. **Fill in the business config** in `wrangler.toml` under `[vars]` and
   redeploy:
   - `JEFF_EMAIL` — who currently reviews new orders (e.g. `jeff@myhomesa.com`)
   - `TECH_EMAIL` — the fixed tech recipient (an inbox, or a carrier's
     email-to-SMS gateway like `5551234567@vtext.com` if you want it to land
     as a text) — can be the same address as `JEFF_EMAIL`, they're deduped
   - `GMAIL_USER` — the Gmail address from step 2
4. **Run the new migration** (adds columns tracking how each order was
   extracted and whether the notify emails sent):
   ```bash
   npm run db:migrate:remote:extraction
   ```
5. `npm run deploy`

Any Gemini or Gmail-send failure is caught and logged per-order (visible via
`wrangler tail`) — the order is always saved to D1 first, regardless of
whether extraction fell back to regex or the notify emails failed to send.

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
npm run db:migrate:local:users    # users table, local
cp .dev.vars.example .dev.vars    # then edit SESSION_SECRET
node scripts/create-admin.mjs "you@example.com" "your-password"   # prints INSERT SQL
npx wrangler d1 execute service-call-workflow-db --local --command "<paste the printed INSERT here>"
npm run dev                       # starts the Worker on http://localhost:8787
```

Run `npm run test:parser` to check the email parser against the bundled
Armadillo Home Solutions sample.
