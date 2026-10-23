# iBid // OHIO — Live Janitorial & Carpet Cleaning Bid Aggregator

Live multi-portal bid aggregator and ISSA-612 estimator for **Janitorial (`NAICS 561720` / `UNSPSC 76110000` / `NIGP 910-39`)** and **Carpet Cleaning (`NAICS 561740` / `NIGP 910-09`)** contracts across **Ohio**.

## Key Features
- **100% Real Scraped Data (Zero Sample Data)**:
  - **BidNet Direct Ohio Purchasing Group (`BIDNET-OH`)**: Headless Edge scraper (`puppeteer-core`) that passes the AWS WAF challenge to pull open Ohio local government solicitations.
  - **OhioBuys (`OHIOBUYS`)**: Headless Edge scraper that passes the Ivalua verification check to pull open State of Ohio (`SRC...`) solicitations.
  - **Franklin County Purchasing (`FRANKLIN-CO-OH`)**: Direct HTML table scraper for `bids.franklincountyohio.gov`.
  - **SAM.gov (`SAM.GOV`)**: Unauthenticated HAL+JSON internal API scraper for open federal solicitations (`561720` / `561740`).
  - **USASpending.gov (`USASPENDING-OH`)**: Tracks active Ohio federal janitorial & carpet contracts expiring in the future for recompete bidding.
- **Strict Future-Closing Date Gate**: Every contract in the feed is verified to close or expire on or after today's date.
- **24-Portal Ohio City & County Procurement Directory**: Filterable directory with direct launch links and software platform details (`OpenGov`, `Bonfire`, `Ivalua`, `BidNet`, `Tyler Munis`, `PlanetBids`) for Columbus, Cleveland, Cincinnati, Akron, Dayton, Toledo, Canton, and regional transit/sewer districts.
- **ISSA-612 Bid Estimator & Pursuit Kanban CRM**: Calculate burdened Ohio labor, carpet extraction production rates, chemicals, and monthly/annual bid pricing.

## Quick Start (Pulling at Home)

```bash
git clone https://github.com/kwrobleski36/iBid.git
cd iBid
npm install
npm start
```

Then open **http://localhost:3088** in your browser.
