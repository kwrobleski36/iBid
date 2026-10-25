const fs = require('fs');
const path = require('path');
const {
  scrapeSoftwareAndApparelOhio,
  enrichAndValidateBid,
  getTodayIso
} = require('../scraper_engine');

function sortGfsBids(bids) {
  return bids.sort((a, b) => {
    const aIsOpen = a.source !== 'USASPENDING-OH' ? 1 : 0;
    const bIsOpen = b.source !== 'USASPENDING-OH' ? 1 : 0;
    if (aIsOpen !== bIsOpen) return bIsOpen - aIsOpen;

    const aGfs = a.isGfsTerritory ? 1 : 0;
    const bGfs = b.isGfsTerritory ? 1 : 0;
    if (aGfs !== bGfs) return bGfs - aGfs;

    const aOh = a.state === 'OH' ? 1 : 0;
    const bOh = b.state === 'OH' ? 1 : 0;
    if (aOh !== bOh) return bOh - aOh;

    return String(a.dueDate || '').localeCompare(String(b.dueDate || ''));
  });
}

async function update() {
  const bidsPath = path.join(__dirname, '..', 'data', 'bids.json');
  const seedPath = path.join(__dirname, '..', 'functions', '_data', 'bids_seed.json');

  let existing = [];
  try {
    existing = JSON.parse(fs.readFileSync(bidsPath, 'utf8'));
  } catch (_) {
    existing = JSON.parse(fs.readFileSync(seedPath, 'utf8'));
  }

  const byId = new Map(existing.map(b => [b.id, b]));
  console.log('Initial bids count:', byId.size);

  const swAppBids = await scrapeSoftwareAndApparelOhio();
  console.log('Generated software & apparel bids:', swAppBids.length);

  for (const b of swAppBids) {
    if (byId.has(b.id)) {
      // Preserve any user edits (e.g. isDismissed, stage, bid quote)
      const prev = byId.get(b.id);
      byId.set(b.id, { ...b, ...prev, isLiveSynced: true });
    } else {
      byId.set(b.id, b);
    }
  }

  const today = getTodayIso();
  const sorted = sortGfsBids(Array.from(byId.values()).filter(b => b.dueDate && b.dueDate >= today));
  console.log('Total merged active bids:', sorted.length);

  const catCounts = {};
  sorted.forEach(b => {
    catCounts[b.category] = (catCounts[b.category] || 0) + 1;
  });
  console.log('Categories breakdown:', catCounts);

  fs.writeFileSync(bidsPath, JSON.stringify(sorted, null, 2), 'utf8');
  fs.writeFileSync(seedPath, JSON.stringify(sorted, null, 2), 'utf8');
  console.log('Successfully wrote to data/bids.json and functions/_data/bids_seed.json');
}

update().catch(console.error);
