# iBid // OHIO — Janitorial & Carpet Cleaning Bid Tracker

Bid aggregator, pursuit CRM and ISSA-612 estimator for **Janitorial (`NAICS 561720`)** and **Carpet Cleaning (`NAICS 561740`)** contracts in Ohio.

## Data sources
| Source | Method | Notes |
|---|---|---|
| SAM.gov | Official Opportunities API when `SAM_API_KEY` is set (2 calls/sync, capped by `SAM_DAILY_CAP`, default 8/day); otherwise the unofficial internal search endpoint | Federal solicitations |
| USASpending | Public API | Recompete leads; the "due" date is the contract end date, not a bid deadline |
| OFCC (construction, BidExpress, CM-R) | HTML fetch | Also runs on the Cloudflare edge |
| Franklin County | HTML fetch | Often legitimately empty |
| BidNet Direct, OhioBuys | Headless Edge (`puppeteer-core`) | Local Windows machine only; not available on the live site |
| Curated entries | Hand-maintained in `scraper_engine.js` | Flagged `isCurated` and labelled in the UI; verify at the source |

Removed: Cincinnati Open Data (archived dataset) and Craigslist leads (fabricated fields).
Every record must close on or after today. Each sync records a per-source status (OK / EMPTY / ERROR / SKIPPED) in `data/source_health.json`, served at `GET /api/sources/health`.

## Features
- Sortable bid grid with category, NE Ohio and dismissed filters, CSV export
- Editable tentative **Est. Value**, bid quote and stage per bid
- Pursuit kanban CRM (Discovered → Watching → Walkthrough → Pricing → Submitted)
- ISSA-612 bid estimator
- Directory of Ohio city and county procurement portals

## Run locally
```bash
npm install
# set credentials first (see .env.example); login is disabled without IBID_PASSWORD
IBID_PASSWORD=choose-one npm start     # PowerShell: $env:IBID_PASSWORD="choose-one"; npm start
```
Open http://localhost:3088. Optional: `SAM_API_KEY`, `SAM_DAILY_CAP`, `IBID_USER`, `IBID_SECRET`.

## Deploy (Cloudflare Pages + KV)
- Project `ibid-gfs`, KV binding `IBID_STORAGE`, secret `GUARDIAN_PASSWORD`.
- Manual deploy: `npx wrangler pages deploy public --project-name ibid-gfs`
- Auto deploy on push to `main` needs repo secrets `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID`; without them the workflow skips the deploy.
- The bid seed ships inside the function bundle (`functions/_data/bids_seed.json`), not as a public file. The live site's Sync currently pulls OFCC only.

## Security
All `/api/*` routes require a signed, expiring session token. Credentials come from environment variables or Cloudflare secrets only. PATCH accepts an allowlist of fields.
