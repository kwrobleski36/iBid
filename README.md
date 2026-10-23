# iBid // BUCKEYE TERMINAL v1.98 (Ohio Edition)

**Retro-Aesthetic Janitorial (`NAICS 561720` / `UNSPSC 76110000`) & Carpet Cleaning (`NAICS 561740`) Bid Aggregator, Live Ohio Recompete Radar, and ISSA-612 Workloading Calculator.**

---

## Key Features (Ohio-Calibrated)

1. **Live Ohio Federal & Municipal API Sync (`[⚡ SYNC LIVE OHIO FEEDS]`)**:
   - **USASpending.gov Ohio API**: Queries live federal custodial and carpet extraction contracts performed in **Ohio (`state: "OH"`)** under NAICS `561720` and `561740` (Wright-Patterson AFB, VA VISN 10 Medical Centers in Cleveland/Columbus/Dayton/Cincinnati/Chillicothe, NASA Glenn, DoD Recruiting Stations) — displaying the incumbent contractor, award amount, and contract end date.
   - **Open Data Cincinnati API (`pid3-z56k`)**: Pulls live municipal janitorial & custodial solicitations directly from the City of Cincinnati Socrata Open Data endpoint with direct links to Bid Booklet PDFs.
   - **SAM.gov API (`state=OH`)**: Optional API key slot for live federal pre-solicitations and sources-sought notices across Ohio.
   - **Curated Ohio Metro Baseline**: Pre-loaded with opportunities from **OhioBuys (State of Ohio DAS)**, **The Ohio State University (BuckeyeBuy)**, **City of Columbus Vendor Services**, **Cuyahoga County Public Library (BidNet Ohio Purchasing Group)**, **Summit County Munis VSS (Akron)**, **Lakota Local School District (DemandStar Ohio)**, **Toledo-Lucas County**, and **CBRE Central Ohio (Polaris/Easton)**.
2. **Ohio Metro Region & Set-Aside Filtering**:
   - Filter by `CENTRAL-OH (Columbus)`, `NORTHEAST-OH (Cleveland/Akron)`, `SOUTHWEST-OH (Cincinnati/Dayton/WPAFB)`, `NORTHWEST-OH (Toledo)`, and `SOUTHEAST-OH`.
   - Filter by **Ohio EDGE / MBE**, **SDVOSB**, **Total Small Business**, **WOSB/WBE**, **SLED Open Bid**, and **Commercial AVL**.
3. **ISSA 612 Janitorial & Carpet Extraction Estimator (`[F2]`)**:
   - Calculates labor hours using industry-standard ISSA 612 production rates (`4,200 SF/hr` open office/VCT, `1,000 SF/hr` restrooms/medical, plus Truckmount Hot-Water, Portable Box Extractor, Low-Moisture CRB Encapsulation, Rotary Bonnet, and VCT Strip & 4-Coat Wax).
   - Factors in Ohio cleaner hourly wages, FICA + **Ohio BWC Workers' Comp** burden, chemicals, and target profit margin — comparing your bid against the incumbent award price.
4. **3 Retro Terminal Themes**:
   - `CRT-88 PHOSPHOR GREEN` (Default)
   - `IBM-3270 AMBER PLASMA`
   - `WIN-95 PAPER LEDGER`

---

## Quick Start (Local)

```bash
node server.js
```
Then open **http://localhost:3088** in your browser.

---

## Deploying Online (Cloudflare Pages, Firebase, GitHub)

### Option A: Cloudflare Pages + Edge Functions (`wrangler.toml` included)
```bash
npx wrangler pages deploy public --project-name=ibid-aggregator
```

### Option B: Firebase Hosting + Firestore (`firebase.json` & `firestore.rules` included)
```bash
npx firebase-tools deploy
```
You can also enter your **Firebase Project ID** and **Web API Key** directly inside the **`[☁ CLOUD / FIREBASE]`** modal in the app to mirror all bid stage updates and estimates to Firestore in real time.

### Option C: GitHub Actions Auto-Deploy
Push to a GitHub repository and add `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID` to your repository secrets — `.github/workflows/deploy.yml` will automatically deploy on every push to `main`.
