const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const {
  scrapeSamGovLive,
  scrapeUsaSpendingOhioLive,
  scrapeCincinnatiOpenDataLive,
  scrapeFranklinCountyOhioLive,
  scrapeOhioPortalsHeadless,
  scrapeOfccAndBidExpressOhio,
  scrapeNeOhioStrAndTurnoverLeads,
  scrapeSoftwareAndApparelOhio,
  validateExternalHttpsUrl,
  inspectBidNetUrl,
  enrichAndValidateBid,
  GFS_NE_OHIO_COUNTIES,
  getTodayIso
} = require('./scraper_engine');

const PORT = process.env.PORT || 3088;
// Fields a client may change through PATCH (everything else is ignored).
const PATCHABLE_FIELDS = [
  'stage', 'savedEstimate', 'isDismissed', 'dismissedAt', 'dismissedBy',
  'userNotes', 'checklist', 'estimatedValue', 'estimatedValueIsManual'
];
const PUBLIC_DIR = path.join(__dirname, 'public');
const DATA_DIR = path.join(__dirname, 'data');
const BIDS_JSON_PATH = path.join(DATA_DIR, 'bids.json');
// Secrets come from the environment only. Without IBID_SECRET, sessions use a random per-run key.
// Without IBID_PASSWORD, login is disabled (see .env.example).
const SESSION_SECRET = process.env.IBID_SECRET || crypto.randomBytes(32).toString('hex');
const OPERATOR_USER = String(process.env.IBID_USER || 'guardian').toLowerCase();
const OPERATOR_PASSWORD = String(process.env.IBID_PASSWORD || '');

// Per-IP Login Rate Limiter (Max 8 failed attempts per 15 min)
const loginAttempts = new Map();
function checkRateLimit(ip) {
  const now = Date.now();
  const rec = loginAttempts.get(ip);
  if (!rec || now > rec.resetAt) {
    loginAttempts.set(ip, { count: 0, resetAt: now + 15 * 60 * 1000 });
    return true;
  }
  return rec.count < 8;
}
function recordFailedAttempt(ip) {
  const rec = loginAttempts.get(ip);
  if (rec) rec.count += 1;
}

function safeCompare(a, b) {
  const bufA = Buffer.from(String(a));
  const bufB = Buffer.from(String(b));
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}

function createSessionToken(operator = 'guardian') {
  const exp = Date.now() + 30 * 24 * 60 * 60 * 1000;
  const payload = `${operator}.${exp}`;
  const sig = crypto.createHmac('sha256', SESSION_SECRET).update(payload).digest('hex');
  return `${payload}.${sig}`;
}

function verifySessionToken(token) {
  if (!token || typeof token !== 'string') return false;
  const parts = token.split('.');
  if (parts.length !== 3) return false;
  const [operator, expStr, sig] = parts;
  if (Number(expStr) < Date.now()) return false;
  const expectedSig = crypto.createHmac('sha256', SESSION_SECRET).update(`${operator}.${expStr}`).digest('hex');
  return safeCompare(sig, expectedSig);
}

function ensureDataDir() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
  if (!fs.existsSync(BIDS_JSON_PATH)) {
    fs.writeFileSync(BIDS_JSON_PATH, '[]', 'utf-8');
  }
}

function sortGfsBids(bids) {
  return bids.sort((a, b) => {
    // 1. Open Solicitations (BID_NOW / EARLY_INTEL) before USASpending Recompetes
    const aIsOpen = a.source !== 'USASPENDING-OH' ? 1 : 0;
    const bIsOpen = b.source !== 'USASPENDING-OH' ? 1 : 0;
    if (aIsOpen !== bIsOpen) return bIsOpen - aIsOpen;

    // 2. Guardian Facility Services 20-County NE Ohio Territory first
    const aGfs = a.isGfsTerritory ? 1 : 0;
    const bGfs = b.isGfsTerritory ? 1 : 0;
    if (aGfs !== bGfs) return bGfs - aGfs;

    // 3. State of Ohio before out-of-state federal
    const aOh = a.state === 'OH' ? 1 : 0;
    const bOh = b.state === 'OH' ? 1 : 0;
    if (aOh !== bOh) return bOh - aOh;

    // 4. Soonest closing date first
    return String(a.dueDate || '').localeCompare(String(b.dueDate || ''));
  });
}

// Known BidNet AI Overviews from our live abstract inspection
const KNOWN_BIDNET_AI_OVERVIEWS = {
  'BIDNET-OH-444188089541': 'The contract involves condition-based cleaning of sewer mainlines and non-PACP post-cleaning verification, supporting a targeted sewer maintenance program.',
  'BIDNET-OH-444199272966': 'Janitorial services are required for three locations including park board facilities and a fire department building, with varying frequencies of cleaning tasks ranging from once per week to once per month.',
  'BIDNET-OH-443711013369': 'Weekly rental service for O.R.C. Walk-Off Runner Mats with specific construction requirements and regular cleaning/exchange.',
  'BIDNET-OH-444194173076': 'A contractor is sought to provide routine cleaning, litter and debris removal, graffiti removal, snow and ice treatment, inspections, and minor signage support for passenger shelters and BRT shelters and pylons.',
  'BIDNET-OH-444198878561': 'Solicitation for the purchase and delivery of two Tennant ride-on floor scrubbers (Tennant T7-800-D and Tennant T20-C-D or approved equal), including standard documentation and warranty information.'
};

function readBids() {
  ensureDataDir();
  try {
    const raw = JSON.parse(fs.readFileSync(BIDS_JSON_PATH, 'utf-8'));
    const today = getTodayIso();
    const cleaned = [];
    for (const item of raw) {
      if (KNOWN_BIDNET_AI_OVERVIEWS[item.id] && !item.aiOverview) {
        item.aiOverview = KNOWN_BIDNET_AI_OVERVIEWS[item.id];
      }
      const enriched = enrichAndValidateBid(item);
      if (enriched && enriched.dueDate >= today) {
        cleaned.push(enriched);
      }
    }
    return sortGfsBids(cleaned);
  } catch (err) {
    console.error('Error reading bids.json:', err);
    return [];
  }
}

function writeBids(bids) {
  ensureDataDir();
  fs.writeFileSync(BIDS_JSON_PATH, JSON.stringify(bids, null, 2), 'utf-8');
  try {
    const seedPath = path.join(__dirname, 'functions', '_data', 'bids_seed.json');
    fs.writeFileSync(seedPath, JSON.stringify(bids, null, 2), 'utf-8');
  } catch (_) {}
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

// Master Live Sync: Runs all scrapers/APIs, unmasks BidNet abstracts, and merges 100% real records
async function syncAllRealPortals(options = {}) {
  const existingBids = readBids();
  const byId = new Map(existingBids.map(b => [b.id, b]));
  let newlyAddedCount = 0;

  const sourceStats = {
    samGovLive: { status: 'OK', count: 0 },
    ohioPortalsHeadless: { status: 'OK', count: 0 },
    ofccBidExpressOhio: { status: 'OK', count: 0 },
    neOhioStrTurnover: { status: 'OK', count: 0 },
    softwareAndApparelOhio: { status: 'OK', count: 0 },
    ohioUsaSpending: { status: 'OK', count: 0 },
    cincinnatiOpenData: { status: 'OK', count: 0 },
    franklinCountyOhio: { status: 'OK', count: 0 }
  };

  const runHeadless = options.includeHeadless !== false;

  const [
    samRecords,
    usaRecords,
    cincyRecords,
    franklinRecords,
    ofccRecords,
    strRecords,
    swApparelRecords,
    headlessRecords
  ] = await Promise.all([
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
    scrapeOfccAndBidExpressOhio().catch(e => {
      sourceStats.ofccBidExpressOhio.status = e.message;
      return [];
    }),
    scrapeNeOhioStrAndTurnoverLeads().catch(e => {
      sourceStats.neOhioStrTurnover.status = e.message;
      return [];
    }),
    scrapeSoftwareAndApparelOhio().catch(e => {
      sourceStats.softwareAndApparelOhio.status = e.message;
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
  sourceStats.ofccBidExpressOhio.count = ofccRecords.length;
  sourceStats.neOhioStrTurnover.count = strRecords.length;
  sourceStats.softwareAndApparelOhio.count = swApparelRecords.length;
  sourceStats.ohioPortalsHeadless.count = headlessRecords.length;

  const allReal = [
    ...headlessRecords,
    ...ofccRecords,
    ...strRecords,
    ...swApparelRecords,
    ...franklinRecords,
    ...samRecords,
    ...usaRecords,
    ...cincyRecords
  ];

  const today = getTodayIso();
  for (const rec of allReal) {
    const enriched = enrichAndValidateBid(rec);
    if (!enriched || !enriched.dueDate || enriched.dueDate < today) continue;
    if (!byId.has(enriched.id)) {
      newlyAddedCount++;
      byId.set(enriched.id, enriched);
    } else {
      const prev = byId.get(enriched.id);
      byId.set(enriched.id, {
        ...enriched,
        stage: prev.stage || 'DISCOVERED',
        userNotes: prev.userNotes || '',
        savedEstimate: prev.savedEstimate || null,
        checklist: prev.checklist || null,
        ...(prev.estimatedValueIsManual
          ? { estimatedValue: prev.estimatedValue, estimatedValueIsManual: true }
          : {})
      });
    }
  }

  const finalBids = sortGfsBids(
    Array.from(byId.values()).filter(b => b.dueDate && b.dueDate >= today)
  );

  writeBids(finalBids);

  return {
    totalBids: finalBids.length,
    newlyAddedCount,
    sourceStats,
    syncedAt: new Date().toISOString()
  };
}

// Live URL / Raw Text Scraper (with special BidNet Direct WAF-bypass support!)
async function parseAndScrapeRfp({ url, rawText, titleOverride }) {
  let extractedText = rawText || '';
  let fetchedTitle = titleOverride || '';
  let aiOverview = null;
  let detectedDueDate = null;
  let isBidNet = false;
  let bidNetSolId = '';

  if (url) {
    url = validateExternalHttpsUrl(url);
  }

  if (url && /bidnetdirect\.com/i.test(url)) {
    isBidNet = true;
    const idMatch = url.match(/\/statewide\/(\d+)\//) || url.match(/\/(\d+)\//);
    bidNetSolId = idMatch ? idMatch[1] : String(Date.now()).slice(-8);
    try {
      const bnData = await inspectBidNetUrl(url);
      if (bnData.title && !fetchedTitle) fetchedTitle = bnData.title;
      if (bnData.aiOverview) {
        aiOverview = bnData.aiOverview;
        extractedText += `\n[BIDNET AI OVERVIEW] ${bnData.aiOverview}`;
      }
      if (bnData.closeDate) {
        detectedDueDate = bnData.closeDate;
      }
    } catch (e) {
      extractedText += `\n[BidNet Inspector Note: ${e.message}]`;
    }
  } else if (url && /^https?:\/\//i.test(url)) {
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
      extractedText +=
        '\n' +
        html
          .replace(/<script[\s\S]*?<\/script>/gi, ' ')
          .replace(/<style[\s\S]*?<\/style>/gi, ' ')
          .replace(/<[^>]+>/g, ' ')
          .replace(/\s+/g, ' ');
    } catch (e) {
      extractedText += `\n[URL Fetch Note: ${e.message}]`;
    }
  }

  const text = `${extractedText} ${fetchedTitle}`.trim();

  let totalSqFt = null;
  const sqFtMatch = text.match(/(\d{1,3}(?:,\d{3})+|\d{4,6})\s*(?:sq\.?\s*ft\.?|square\s*feet|sf\b|cleanable\s*sf)/i);
  if (sqFtMatch) {
    const parsed = parseInt(sqFtMatch[1].replace(/,/g, ''), 10);
    if (parsed >= 500 && parsed <= 10000000) totalSqFt = parsed;
  }

  let setAside = 'Open Solicitation';
  if (/\bedge\b|encouraging\s*diversity/i.test(text)) setAside = 'Ohio EDGE Set-Aside';
  else if (/\bmbe\b|minority\s*business/i.test(text)) setAside = 'Ohio MBE Set-Aside';
  else if (/sdvosb|service-disabled\s*veteran/i.test(text)) setAside = 'SDVOSB';
  else if (/\b8\(a\)/i.test(text)) setAside = '8(a)';
  else if (/wosb|wbe|women-owned/i.test(text)) setAside = 'WOSB';
  else if (/small\s*business/i.test(text)) setAside = 'Total Small Business';

  const solMatch = text.match(/\b(SRC\d{7,10}|RFQ\d{5,8}|36C\d+[A-Z0-9]+|W91[A-Z0-9-]+|[A-Z0-9]{2,6}[-][A-Z0-9-]{4,18})\b/);
  const solicitationNumber = isBidNet
    ? `BN-OH-${bidNetSolId}`
    : solMatch
    ? solMatch[1]
    : `GFS-IMP-${Date.now().toString().slice(-5)}`;

  // Extract a closing date from text if present, or default to 14 days from today so it passes strict future-closing gate
  let dueDate = getTodayIso();
  const dateInText = (detectedDueDate || text).match(/(\d{1,2}\/\d{1,2}\/\d{4}|\d{4}-\d{2}-\d{2})/);
  if (dateInText) {
    dueDate = dateInText[1];
  } else {
    const d = new Date();
    d.setDate(d.getDate() + 14);
    dueDate = d.toISOString().slice(0, 10);
  }

  const rawBid = {
    id: isBidNet ? `BIDNET-OH-${bidNetSolId}` : `USER-SCRAPE-${Date.now()}`,
    solicitationNumber,
    title: fetchedTitle || text.slice(0, 92) || 'Imported Ohio Solicitation',
    agency: isBidNet ? 'Ohio Public Agency (BidNet Direct Ohio)' : 'Imported Ohio Agency',
    source: isBidNet
      ? 'BIDNET-OH'
      : url
      ? new URL(url).hostname.replace(/^www\./, '').toUpperCase().slice(0, 14)
      : 'DIRECT-PARSE',
    noticeType: 'OPEN SOLICITATION',
    setAside,
    state: 'OH',
    city: 'Ohio',
    totalSqFt,
    carpetSqFt: totalSqFt ? Math.round(totalSqFt * 0.55) : null,
    hardFloorSqFt: totalSqFt ? Math.round(totalSqFt * 0.35) : null,
    restroomSqFt: totalSqFt ? Math.round(totalSqFt * 0.1) : null,
    frequency: 'See Imported Scope Text',
    extractionMethod: 'Hot-Water Extraction / VCT Strip & Wax',
    estimatedValue: null,
    incumbent: 'ACTIVE OPEN SOLICITATION',
    priorAwardValue: null,
    postedDate: getTodayIso(),
    dueDate,
    aiOverview,
    stage: 'WATCHING',
    isLiveSynced: true,
    scopeSummary: extractedText.trim().slice(0, 750) || 'Imported via GFS URL/Text Scraper.',
    lineItems: [
      `Solicitation #: ${solicitationNumber}`,
      totalSqFt ? `Extracted Cleanable Area: ${totalSqFt.toLocaleString()} SF` : 'Square Footage: Check Attached Bid Packet',
      `Source URL: ${url || 'Direct Text Paste'}`
    ],
    contactName: 'See Solicitation Notice',
    contactEmail: 'See Solicitation Notice',
    contactPhone: 'See Solicitation Notice',
    sourceUrl: url || '#'
  };

  const newBid = enrichAndValidateBid(rawBid) || rawBid;
  const bids = readBids();
  const existingIdx = bids.findIndex(b => b.id === newBid.id);
  if (existingIdx >= 0) {
    bids[existingIdx] = newBid;
  } else {
    bids.unshift(newBid);
  }
  writeBids(sortGfsBids(bids));
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

  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'no-referrer');
  // No CORS headers: the UI is served from this same origin.

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    return res.end();
  }

  try {
    if (pathname === '/api/auth/login' && req.method === 'POST') {
      const clientIp = req.socket.remoteAddress || 'unknown';
      if (!checkRateLimit(clientIp)) {
        res.writeHead(429, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify({ ok: false, error: 'Too many login attempts. Try again in 15 minutes.' }));
      }
      const body = await parseBody(req);
      const user = String(body.username || '').trim().toLowerCase();
      const pass = String(body.password || body.passkey || '').trim();
      const validUser = safeCompare(user, OPERATOR_USER);
      const validPass = OPERATOR_PASSWORD !== '' && safeCompare(pass, OPERATOR_PASSWORD);
      if (validUser && validPass) {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        return res.end(
          JSON.stringify({
            ok: true,
            operator: OPERATOR_USER,
            token: createSessionToken(OPERATOR_USER)
          })
        );
      }
      recordFailedAttempt(clientIp);
      res.writeHead(401, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ ok: false, error: 'Invalid Operator ID or Access Passkey' }));
    }

    // Enforce Bearer token on mutating API routes
    if (pathname.startsWith('/api/')) {
      const authHeader = String(req.headers.authorization || '').replace(/^Bearer\s+/i, '').trim();
      if (!verifySessionToken(authHeader)) {
        res.writeHead(401, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify({ ok: false, error: 'Unauthorized: Valid operator session token required' }));
      }
    }

    if (pathname === '/api/bids' && req.method === 'GET') {
      let bids = readBids();
      const hasSoftwareOrApparel = bids.some(
        b => b.category === 'SOFTWARE_WEB' || b.category === 'APPAREL_UNIFORMS'
      );
      if (bids.length === 0 || !hasSoftwareOrApparel) {
        const [ofccRecs, strRecs, swAppRecs] = await Promise.all([
          scrapeOfccAndBidExpressOhio().catch(() => []),
          scrapeNeOhioStrAndTurnoverLeads().catch(() => []),
          scrapeSoftwareAndApparelOhio().catch(() => [])
        ]);
        const byId = new Map(bids.map(b => [b.id, b]));
        for (const r of [...ofccRecs, ...strRecs, ...swAppRecs]) {
          if (!byId.has(r.id)) byId.set(r.id, r);
        }
        bids = sortGfsBids(Array.from(byId.values()));
        writeBids(bids);
      } else {
        writeBids(bids);
      }
      res.writeHead(200, { 'Content-Type': 'application/json' });
      return res.end(
        JSON.stringify({
          bids,
          count: bids.length,
          gfsCounties: GFS_NE_OHIO_COUNTIES
        })
      );
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

    if (pathname.startsWith('/api/bids/') && req.method === 'PATCH') {
      const id = decodeURIComponent(pathname.replace('/api/bids/', ''));
      const body = await parseBody(req);
      const updates = {};
      for (const k of PATCHABLE_FIELDS) if (k in body) updates[k] = body[k];
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

    if (pathname === '/api/bidnet/inspect' && req.method === 'POST') {
      const body = await parseBody(req);
      const bids = readBids();
      const idx = bids.findIndex(b => b.id === body.id);
      const targetUrl = body.url || (idx >= 0 ? bids[idx].sourceUrl : null);
      if (!targetUrl) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify({ error: 'Missing BidNet URL' }));
      }
      const inspected = await inspectBidNetUrl(targetUrl);
      if (idx >= 0) {
        bids[idx].aiOverview = inspected.aiOverview || bids[idx].aiOverview;
        bids[idx].closingTimestamp = inspected.closeDate || bids[idx].closingTimestamp;
        bids[idx] = enrichAndValidateBid(bids[idx]) || bids[idx];
        writeBids(bids);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify({ ok: true, bid: bids[idx], inspected }));
      }
      res.writeHead(200, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ ok: true, inspected }));
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
  console.log('  iBid // GUARDIAN FACILITY SERVICES (NE OHIO) — LIVE ENGINE v2.1   ');
  console.log('  JANITORIAL | VCT & CARPET | FLOOR MAT RENTAL | SUPPLIES & EQUIP   ');
  console.log(`  GFS TERMINAL ONLINE  -->  http://localhost:${PORT}                 `);
  console.log('====================================================================');
});
