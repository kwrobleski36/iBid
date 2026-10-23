const http = require('http');
const fs = require('fs');
const path = require('path');
const {
  scrapeSamGovLive,
  scrapeUsaSpendingOhioLive,
  scrapeCincinnatiOpenDataLive,
  scrapeFranklinCountyOhioLive,
  scrapeOhioPortalsHeadless,
  inferOhioRegion
} = require('./scraper_engine');

const PORT = process.env.PORT || 3088;
const PUBLIC_DIR = path.join(__dirname, 'public');
const DATA_DIR = path.join(__dirname, 'data');
const BIDS_FILE = path.join(DATA_DIR, 'bids.json');

function ensureDataDir() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
  if (!fs.existsSync(BIDS_FILE)) {
    fs.writeFileSync(BIDS_FILE, '[]', 'utf-8');
  }
}

function readBids() {
  ensureDataDir();
  try {
    const raw = JSON.parse(fs.readFileSync(BIDS_FILE, 'utf-8'));
    const today = new Date().toISOString().slice(0, 10);
    return raw.filter(b => !b.dueDate || b.dueDate >= today);
  } catch (err) {
    console.error('Error reading bids.json:', err);
    return [];
  }
}

function writeBids(bids) {
  ensureDataDir();
  fs.writeFileSync(BIDS_FILE, JSON.stringify(bids, null, 2), 'utf-8');
}

function parseBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', chunk => {
      body += chunk.toString();
      if (body.length > 2 * 1024 * 1024) {
        reject(new Error('Payload too large'));
      }
    });
    req.on('end', () => {
      if (!body) return resolve({});
      try {
        resolve(JSON.parse(body));
      } catch (e) {
        resolve({ raw: body });
      }
    });
    req.on('error', reject);
  });
}

// Technical Breakdown of How Real Aggregators & Portals Work
const AGGREGATOR_INTEL = [
  {
    id: 'sam-gov-live',
    name: 'SAM.gov (Internal HAL+JSON API + Opportunity Detail API)',
    tier: 'LIVE CONNECTED — ZERO SAMPLE DATA',
    cost: 'FREE (Scraped via /api/prod/sgs/v1/search + /opps/v2)',
    naicsSupport: 'Exact NAICS 561720 & 561740 + PSC S201',
    sectors: ['Dayton VA (VISN 10)', 'Wright-Patterson AFB', 'USACE Ohio', 'Active National Federal'],
    rating: 9.8,
    liveConnected: true,
    url: 'https://sam.gov/content/opportunities',
    pros: 'Connected LIVE to iBid without needing an API key! Uses SAM.gov internal Angular HAL+JSON endpoints to pull real Solicitation Numbers, Contracting Officer emails/phones, Set-Asides, and direct sam.gov/opp/{id}/view links.',
    cons: 'Square footage is almost always inside the attached Performance Work Statement (PWS) PDF or Price Schedule XLSX on the SAM.gov notice page.',
    cleaningTip: 'Click "OPEN PORTAL / PDF" on any SAM.gov record in iBid to open the exact SAM.gov notice and download the PWS PDF attachment.'
  },
  {
    id: 'bidnet-ohio-live',
    name: 'BidNet Direct — Ohio Purchasing Group (Headless Edge Scraper)',
    tier: 'LIVE HEADLESS SCRAPER',
    cost: 'Free Public Table / $400–$1,800/yr Paid Alerts',
    naicsSupport: 'NIGP 910-39 (Janitorial) & 910-09 (Carpet Cleaning)',
    sectors: ['80+ Participating Ohio Cities, Counties & Special Districts'],
    rating: 9.5,
    liveConnected: true,
    url: 'https://www.bidnetdirect.com/ohio/solicitations/open-bids?keywords=cleaning',
    pros: 'How BidNet works: BidNet gives local Ohio governments free e-procurement software (purchasingGroupId=12555501) and charges vendors for alerts. iBid uses headless Microsoft Edge to pass BidNet\'s AWS WAF challenge and scrape open Ohio solicitations directly.',
    cons: 'Downloading full PDF packets on BidNet requires logging into a free or paid BidNet supplier account.',
    cleaningTip: 'Register a free "Browse Only" supplier account on bidnetdirect.com/ohio so when you click an iBid BidNet link you can download the city\'s PDF packet.'
  },
  {
    id: 'ohiobuys-das-live',
    name: 'OhioBuys — State of Ohio DAS (Headless Edge Scraper)',
    tier: 'LIVE HEADLESS SCRAPER',
    cost: '100% Free Official State Portal',
    naicsSupport: 'UNSPSC 76110000 (Cleaning & Janitorial Services)',
    sectors: ['ODOT', 'Ohio Dept. of Admin Services', 'DRC / DYS / DMH', 'State Facilities'],
    rating: 9.7,
    liveConnected: true,
    url: 'https://ohiobuys.ohio.gov/page.aspx/en/rfp/request_browse_public',
    pros: 'How OhioBuys works: Runs on the Ivalua platform fronted by a browser-verification wall. iBid launches headless Edge to pass the Ivalua check and extract live State of Ohio SRC solicitations and MBE/EDGE set-asides.',
    cons: 'State agencies categorize bids by UNSPSC commodity family rather than federal NAICS codes.',
    cleaningTip: 'Look for "MBE Set Aside" or "EDGE" tags on OhioBuys rows — these restrict competition exclusivamente to certified Ohio small businesses.'
  },
  {
    id: 'usaspending-oh-live',
    name: 'USASpending.gov — Ohio Federal Contract & Recompete API',
    tier: 'LIVE CONNECTED REST API',
    cost: '100% Free Official Federal API',
    naicsSupport: 'Place of Performance = OH + NAICS 561720 & 561740',
    sectors: ['Ohio DoD Recruiting Stations', 'WPAFB', 'VA VISN 10', 'NASA Glenn'],
    rating: 9.6,
    liveConnected: true,
    url: 'https://www.usaspending.gov/search',
    pros: 'How aggregators like HigherGov & GovWin track recompetes: Queries USASpending\'s v2 award endpoint for Ohio NAICS 561720/561740 contracts to reveal the exact incumbent contractor name, exact dollar amount, and expiration date.',
    cons: 'Shows active/awarded contracts (for recompete and incumbent pricing intelligence) rather than pre-solicitation drafts.',
    cleaningTip: 'Use the incumbent award amount as your benchmark ceiling when pricing the recompete in the ISSA-612 calculator.'
  },
  {
    id: 'cincy-opendata-live',
    name: 'City of Cincinnati Open Data (Socrata SODA API pid3-z56k)',
    tier: 'LIVE CONNECTED SODA API',
    cost: '100% Free Municipal JSON API',
    naicsSupport: 'Live SQL Query ($where=project_name like JANITORIAL/CLEANING)',
    sectors: ['City of Cincinnati Public Services', 'Fleet & Neighborhood Ops', 'Recreation'],
    rating: 9.4,
    liveConnected: true,
    url: 'https://data.cincinnati-oh.gov/Thriving-Neighborhoods/Procurement-Opportunities-and-Contract-Awards/pid3-z56k',
    pros: 'Returns real City of Cincinnati janitorial & cleaning bid records complete with direct URLs to official Volume 1 Bid Booklet PDFs, Volume 2 Detailed Provisions PDFs, and Volume 3 Excel pricing sheets.',
    cons: 'Covers City of Cincinnati municipal departments only.',
    cleaningTip: 'Open the attached Volume 2 & Volume 3 PDF/XLSX links on Cincinnati records to see real municipal square footage and room-by-room cleaning schedules.'
  },
  {
    id: 'demandstar-bonfire-opengov',
    name: 'DemandStar / Bonfire / OpenGov (How Other SLED Portals Work)',
    tier: 'E-PROCUREMENT SAAS ECOSYSTEM',
    cost: 'Free Single-Agency Tier / Paid Multi-Region',
    naicsSupport: 'NIGP 910-39 & 910-09',
    sectors: ['Montgomery County (OpenGov)', 'Ohio School Districts (DemandStar)', 'Transit & Universities (Bonfire)'],
    rating: 9.0,
    liveConnected: false,
    url: 'https:// procurement.opengov.com/portal/mcohio',
    pros: 'Each county/school district picks a SaaS vendor (e.g., Montgomery County OH uses OpenGov; many school districts use DemandStar; universities use Bonfire/IonWave).',
    cons: 'Fragmented across 5–6 SaaS vendors; requires either multi-portal scraping or free vendor registration per portal.',
    cleaningTip: 'Paste any OpenGov, Bonfire, or DemandStar solicitation URL into iBid\'s "+ IMPORT / SCRAPE RFP" tool to parse and track it in your pipeline.'
  }
];

// Master Live Sync: Runs all 4 real scrapers/APIs and merges 100% real records
async function syncAllRealPortals(options = {}) {
  const existingBids = readBids();
  const byId = new Map(existingBids.map(b => [b.id, b]));
  let newlyAddedCount = 0;

  const sourceStats = {
    samGovLive: { status: 'OK', count: 0 },
    ohioPortalsHeadless: { status: 'OK', count: 0 },
    ohioUsaSpending: { status: 'OK', count: 0 },
    cincinnatiOpenData: { status: 'OK', count: 0 },
    franklinCountyOhio: { status: 'OK', count: 0 }
  };

  // Run API scrapers in parallel, plus headless browser scraper if requested or if DB is small
  const runHeadless = options.includeHeadless !== false;

  const [samRecords, usaRecords, cincyRecords, franklinRecords, headlessRecords] = await Promise.all([
    scrapeSamGovLive().catch(e => {
      sourceStats.samGovLive.status = e.message;
      return [];
    }),
    scrapeUsaSpendingOhioLive().catch(e => {
      sourceStats.ohioUsaSpending.status = e.message;
      return [];
    }),
    scrapeCincinnatiOpenDataLive().catch(e => {
      sourceStats.cincinnatiOpenData.status = e.message;
      return [];
    }),
    scrapeFranklinCountyOhioLive().catch(e => {
      sourceStats.franklinCountyOhio.status = e.message;
      return [];
    }),
    runHeadless
      ? scrapeOhioPortalsHeadless().catch(e => {
          sourceStats.ohioPortalsHeadless.status = e.message;
          return [];
        })
      : Promise.resolve([])
  ]);

  sourceStats.samGovLive.count = samRecords.length;
  sourceStats.ohioUsaSpending.count = usaRecords.length;
  sourceStats.cincinnatiOpenData.count = cincyRecords.length;
  sourceStats.franklinCountyOhio.count = franklinRecords.length;
  sourceStats.ohioPortalsHeadless.count = headlessRecords.length;

  const allReal = [
    ...headlessRecords,
    ...franklinRecords,
    ...samRecords,
    ...usaRecords,
    ...cincyRecords
  ];

  const today = new Date().toISOString().slice(0, 10);
  for (const rec of allReal) {
    if (!rec.dueDate || rec.dueDate < today) continue;
    if (!byId.has(rec.id)) {
      newlyAddedCount++;
      byId.set(rec.id, rec);
    } else {
      const prev = byId.get(rec.id);
      byId.set(rec.id, { ...rec, stage: prev.stage || 'DISCOVERED' });
    }
  }

  // Sort: 1) Active Open Ohio Solicitations first, 2) Active Open Federal Solicitations, 3) Future Expiring Ohio Recompetes
  const finalBids = Array.from(byId.values())
    .filter(b => b.dueDate && b.dueDate >= today)
    .sort((a, b) => {
      const aIsOpenSol = a.source !== 'USASPENDING-OH' ? 1 : 0;
      const bIsOpenSol = b.source !== 'USASPENDING-OH' ? 1 : 0;
      if (aIsOpenSol !== bIsOpenSol) return bIsOpenSol - aIsOpenSol;

      const aIsOhio = a.state === 'OH' ? 1 : 0;
      const bIsOhio = b.state === 'OH' ? 1 : 0;
      if (aIsOhio !== bIsOhio) return bIsOhio - aIsOhio;

      return String(a.dueDate).localeCompare(String(b.dueDate));
    });

  writeBids(finalBids);

  return {
    totalBids: finalBids.length,
    newlyAddedCount,
    sourceStats,
    syncedAt: new Date().toISOString()
  };
}

// Live URL / Raw Text Scraper for any user-provided solicitation URL
async function parseAndScrapeRfp({ url, rawText, titleOverride }) {
  let extractedText = rawText || '';
  let fetchedTitle = titleOverride || '';

  if (url && /^https?:\/\//i.test(url)) {
    try {
      const res = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/126.0.0.0 Safari/537.36'
        }
      });
      const html = await res.text();
      const titleMatch = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
      if (titleMatch && !fetchedTitle) {
        fetchedTitle = titleMatch[1].replace(/\s+/g, ' ').trim();
      }
      extractedText += '\n' + html
        .replace(/<script[\s\S]*?<\/script>/gi, ' ')
        .replace(/<style[\s\S]*?<\/style>/gi, ' ')
        .replace(/<[^>]+>/g, ' ')
        .replace(/\s+/g, ' ');
    } catch (e) {
      extractedText += `\n[URL Fetch Note: ${e.message}]`;
    }
  }

  const text = (extractedText + ' ' + fetchedTitle).trim();

  let totalSqFt = null;
  const sqFtMatch = text.match(/(\d{1,3}(?:,\d{3})+|\d{4,6})\s*(?:sq\.?\s*ft\.?|square\s*feet|sf\b|cleanable\s*sf)/i);
  if (sqFtMatch) {
    const parsed = parseInt(sqFtMatch[1].replace(/,/g, ''), 10);
    if (parsed >= 500 && parsed <= 10000000) totalSqFt = parsed;
  }

  const hasCarpet = /carpet|extraction|upholstery|rug|encapsulation|bonnet|truckmount|561740/i.test(text);
  const hasJanitorial = /janitorial|custodial|restroom|trash|porter|vct|sanitiz|561720/i.test(text);

  let category = 'JANITORIAL';
  let naics = '561720';
  if (hasCarpet && hasJanitorial) {
    category = 'COMBO';
    naics = '561720';
  } else if (hasCarpet) {
    category = 'CARPET';
    naics = '561740';
  }

  let setAside = 'Open Solicitation';
  if (/\bedge\b|encouraging\s*diversity/i.test(text)) setAside = 'Ohio EDGE Set-Aside';
  else if (/\bmbe\b|minority\s*business/i.test(text)) setAside = 'Ohio MBE Set-Aside';
  else if (/sdvosb|service-disabled\s*veteran/i.test(text)) setAside = 'SDVOSB';
  else if (/\b8\(a\)/i.test(text)) setAside = '8(a)';
  else if (/wosb|wbe|women-owned/i.test(text)) setAside = 'WOSB';
  else if (/small\s*business/i.test(text)) setAside = 'Total Small Business';

  const ohioRegion = inferOhioRegion(text, 'OH');
  const solMatch = text.match(/\b(SRC\d{7,10}|RFQ\d{5,8}|36C\d+[A-Z0-9]+|W91[A-Z0-9-]+|[A-Z0-9]{2,6}[-][A-Z0-9-]{4,18})\b/);
  const solicitationNumber = solMatch ? solMatch[1] : `IMPORT-${Date.now().toString().slice(-5)}`;

  const newBid = {
    id: `USER-SCRAPE-${Date.now()}`,
    solicitationNumber,
    title: fetchedTitle || text.slice(0, 92) || 'Scraped Solicitation',
    agency: 'User Imported / Scraped Source',
    source: url ? new URL(url).hostname.replace(/^www\./, '').toUpperCase().slice(0, 14) : 'DIRECT-PARSE',
    noticeType: 'User Scraped Solicitation',
    category,
    naics,
    psc: 'S201',
    setAside,
    state: 'OH',
    ohioRegion,
    city: 'See Solicitation',
    totalSqFt,
    carpetSqFt: totalSqFt && category === 'CARPET' ? totalSqFt : null,
    hardFloorSqFt: null,
    restroomSqFt: null,
    frequency: 'See Imported Scope Text',
    extractionMethod: 'See Imported Scope Text',
    estimatedValue: null,
    incumbent: 'N/A',
    priorAwardValue: null,
    postedDate: new Date().toISOString().slice(0, 10),
    dueDate: 'See Notice',
    stage: 'WATCHING',
    isLiveSynced: true,
    scopeSummary: extractedText.trim().slice(0, 750) || 'Imported via URL/Text Scraper.',
    lineItems: [
      `Solicitation #: ${solicitationNumber} | Detected NAICS: ${naics}`,
      totalSqFt ? `Extracted Cleanable Area: ${totalSqFt.toLocaleString()} SF` : 'Square Footage: Not stated in snippet (check PDF)',
      `Source URL: ${url || 'Direct Text Paste'}`
    ],
    contactName: 'See Solicitation Notice',
    contactEmail: 'See Solicitation Notice',
    contactPhone: 'See Solicitation Notice',
    sourceUrl: url || '#'
  };

  const bids = readBids();
  bids.unshift(newBid);
  writeBids(bids);
  return newBid;
}

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon'
};

const server = http.createServer(async (req, res) => {
  const parsedUrl = new URL(req.url, `http://${req.headers.host}`);
  const pathname = parsedUrl.pathname;

  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PATCH, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-Sam-Api-Key');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    return res.end();
  }

  try {
    if (pathname === '/api/bids' && req.method === 'GET') {
      let bids = readBids();
      if (bids.length === 0) {
        await syncAllRealPortals({ includeHeadless: true });
        bids = readBids();
      }
      res.writeHead(200, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ bids, count: bids.length }));
    }

    if (pathname === '/api/bids' && req.method === 'POST') {
      const body = await parseBody(req);
      const bids = readBids();
      const idx = bids.findIndex(b => b.id === body.id);
      if (idx >= 0) {
        bids[idx] = { ...bids[idx], ...body };
      } else {
        body.id = body.id || `IBID-REAL-${Date.now()}`;
        bids.unshift(body);
      }
      writeBids(bids);
      res.writeHead(200, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ ok: true, bid: body, total: bids.length }));
    }

    if (pathname === '/api/bids/reset' && req.method === 'POST') {
      writeBids([]);
      const syncResult = await syncAllRealPortals({ includeHeadless: true });
      const bids = readBids();
      res.writeHead(200, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ ok: true, bids, total: bids.length, syncResult }));
    }

    if (pathname.startsWith('/api/bids/') && req.method === 'PATCH') {
      const id = decodeURIComponent(pathname.replace('/api/bids/', ''));
      const updates = await parseBody(req);
      const bids = readBids();
      const idx = bids.findIndex(b => b.id === id);
      if (idx === -1) {
        res.writeHead(404, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify({ error: 'Bid not found' }));
      }
      bids[idx] = { ...bids[idx], ...updates };
      writeBids(bids);
      res.writeHead(200, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ ok: true, bid: bids[idx] }));
    }

    if (pathname.startsWith('/api/bids/') && req.method === 'DELETE') {
      const id = decodeURIComponent(pathname.replace('/api/bids/', ''));
      const bids = readBids().filter(b => b.id !== id);
      writeBids(bids);
      res.writeHead(200, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ ok: true, total: bids.length }));
    }

    if (pathname === '/api/sync/live' && req.method === 'POST') {
      const body = await parseBody(req);
      const syncResult = await syncAllRealPortals({
        includeHeadless: body.includeHeadless !== false,
        samApiKey: body.samApiKey || req.headers['x-sam-api-key']
      });
      res.writeHead(200, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify(syncResult));
    }

    if (pathname === '/api/scrape' && req.method === 'POST') {
      const body = await parseBody(req);
      const newBid = await parseAndScrapeRfp(body);
      res.writeHead(200, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ ok: true, bid: newBid }));
    }

    if (pathname === '/api/aggregators' && req.method === 'GET') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ aggregators: AGGREGATOR_INTEL }));
    }

    // Static files
    let filePath = path.join(PUBLIC_DIR, pathname === '/' ? 'index.html' : pathname);
    if (!filePath.startsWith(PUBLIC_DIR)) {
      res.writeHead(403);
      return res.end('Forbidden');
    }

    if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
      const ext = path.extname(filePath).toLowerCase();
      res.writeHead(200, { 'Content-Type': MIME_TYPES[ext] || 'application/octet-stream' });
      return fs.createReadStream(filePath).pipe(res);
    } else {
      const indexHtml = path.join(PUBLIC_DIR, 'index.html');
      if (fs.existsSync(indexHtml)) {
        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
        return fs.createReadStream(indexHtml).pipe(res);
      }
      res.writeHead(404);
      return res.end('Not Found');
    }
  } catch (err) {
    console.error('Server error:', err);
    res.writeHead(500, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: err.message }));
  }
});

server.listen(PORT, () => {
  ensureDataDir();
  console.log('====================================================================');
  console.log('  iBid // BUCKEYE TERMINAL v1.98 — 100% REAL LIVE SCRAPER ENGINE    ');
  console.log('  SAM.GOV HAL+JSON | BIDNET OHIO | OHIOBUYS | USASPENDING | CINCY   ');
  console.log(`  OHIO TERMINAL ONLINE  -->  http://localhost:${PORT}               `);
  console.log('====================================================================');
});
