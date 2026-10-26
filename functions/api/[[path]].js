// Cloudflare Pages Edge Function for iBid // GUARDIAN
// Hardened with Bearer session verification, SSRF URL validation, and security headers.

// Seed ships inside the function bundle, never as a public static file.
import SEED_BIDS from '../_data/bids_seed.json';
import core from '../../lib/core.js';
import openSources from '../../lib/openSources.js';
import samOfficial from '../../adapters/samOfficial.js';

// Fields a client may change through PATCH (everything else is ignored).
const PATCHABLE_FIELDS = [
  'stage', 'savedEstimate', 'isDismissed', 'dismissedAt', 'dismissedBy',
  'userNotes', 'checklist', 'estimatedValue', 'estimatedValueIsManual'
];
function pickPatchable(updates) {
  const out = {};
  for (const k of PATCHABLE_FIELDS) if (updates && k in updates) out[k] = updates[k];
  return out;
}

let edgeBidsCache = null;

async function sha256Hex(s) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s));
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
}

function timingSafeEqual(a, b) {
  a = String(a); b = String(b);
  let diff = a.length ^ b.length;
  for (let i = 0; i < Math.max(a.length, b.length); i++) {
    diff |= (a.charCodeAt(i) || 0) ^ (b.charCodeAt(i) || 0);
  }
  return diff === 0;
}

function getTodayIso() {
  const now = new Date();
  const yyyy = now.getFullYear();
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const dd = String(now.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

function normalizeDateToIso(dateStr) {
  if (!dateStr) return null;
  const s = String(dateStr).trim();
  const isoMatch = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (isoMatch) return `${isoMatch[1]}-${isoMatch[2]}-${isoMatch[3]}`;
  const slashMatch = s.match(/(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (slashMatch) {
    const mm = slashMatch[1].padStart(2, '0');
    const dd = slashMatch[2].padStart(2, '0');
    const yyyy = slashMatch[3];
    return `${yyyy}-${mm}-${dd}`;
  }
  return null;
}

function validateExternalHttpsUrl(rawUrl) {
  if (!rawUrl || typeof rawUrl !== 'string') throw new Error('URL is required');
  let parsed;
  try {
    parsed = new URL(rawUrl.trim());
  } catch (_) {
    throw new Error('Invalid URL format');
  }
  if (parsed.protocol !== 'https:') throw new Error('Only https:// URLs are permitted');
  const host = parsed.hostname.toLowerCase();
  if (
    host === 'localhost' ||
    host === '127.0.0.1' ||
    host === '0.0.0.0' ||
    host === '[::1]' ||
    host.endsWith('.local') ||
    host.endsWith('.internal') ||
    /^127\./.test(host) ||
    /^10\./.test(host) ||
    /^192\.168\./.test(host) ||
    /^169\.254\./.test(host) ||
    /^172\.(1[6-9]|2\d|3[0-1])\./.test(host)
  ) {
    throw new Error('Private or loopback addresses are blocked');
  }
  return parsed.href;
}

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

async function getStoredOverrides(context) {
  if (context?.env?.IBID_STORAGE) {
    try {
      const raw = await context.env.IBID_STORAGE.get('bid_overrides', 'json');
      if (raw && typeof raw === 'object') return raw;
    } catch (_) {}
  }
  return {};
}

async function saveStoredOverride(context, id, updates) {
  if (context?.env?.IBID_STORAGE) {
    try {
      const overrides = await getStoredOverrides(context);
      overrides[id] = { ...(overrides[id] || {}), ...updates };
      await context.env.IBID_STORAGE.put('bid_overrides', JSON.stringify(overrides));
    } catch (e) {
      console.error('KV put error:', e);
    }
  }
}

async function loadSeedBids(context) {
  const baseBids = SEED_BIDS;

  // Apply persisted overrides from Cloudflare KV across all workers and data centers
  const overrides = await getStoredOverrides(context);
  const merged = baseBids.map(b => {
    if (overrides[b.id]) {
      return { ...b, ...overrides[b.id] };
    }
    return b;
  });

  // Reconstitute any newly created or custom unmasked bids stored in KV
  for (const [key, val] of Object.entries(overrides)) {
    if (key.startsWith('__')) continue;
    if (val && typeof val === 'object' && val.id && val.title) {
      if (!merged.some(b => b.id === val.id)) {
        merged.unshift(val);
      }
    }
  }

  edgeBidsCache = sortGfsBids(merged);
  return edgeBidsCache;
}

export async function onRequest(context) {
  const url = new URL(context.request.url);
  const path = url.pathname.replace(/^\/api\/?/, '');
  const method = context.request.method.toUpperCase();

  const corsHeaders = {
    'Content-Type': 'application/json; charset=utf-8',
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
    'Referrer-Policy': 'no-referrer'
  };

  if (method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  // 1. Operator Login Gate (credentials live in Cloudflare secrets, never in source)
  const expectedPass = String(context.env?.GUARDIAN_PASSWORD || '');
  if (!expectedPass) {
    return new Response(JSON.stringify({ ok: false, error: 'Server auth not configured' }), { status: 503, headers: corsHeaders });
  }
  // Signed, expiring session token (30 days). Changing GUARDIAN_PASSWORD invalidates all sessions.
  const hmacHex = async (msg) => {
    const key = await crypto.subtle.importKey(
      'raw', new TextEncoder().encode(`${expectedPass}:ibid-session-v2`),
      { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']
    );
    const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(msg));
    return [...new Uint8Array(sig)].map((b) => b.toString(16).padStart(2, '0')).join('');
  };
  const issueToken = async () => {
    const payload = `guardian.${Date.now() + 30 * 24 * 60 * 60 * 1000}`;
    return `${payload}.${await hmacHex(payload)}`;
  };
  const tokenValid = async (tok) => {
    const parts = String(tok || '').split('.');
    if (parts.length !== 3 || Number(parts[1]) < Date.now()) return false;
    return timingSafeEqual(parts[2], await hmacHex(`${parts[0]}.${parts[1]}`));
  };

  if (path === 'auth/login' && method === 'POST') {
    let body = {};
    try {
      body = await context.request.json();
    } catch (_) {}
    const user = String(body.username || '').trim().toLowerCase();
    const pass = String(body.password || body.passkey || '').trim();
    if (user === 'guardian' && timingSafeEqual(pass, expectedPass)) {
      return new Response(
        JSON.stringify({ ok: true, authenticated: true, operator: 'guardian', token: await issueToken() }),
        { status: 200, headers: corsHeaders }
      );
    }
    return new Response(
      JSON.stringify({ ok: false, authenticated: false, error: 'Invalid Operator ID or Access Passkey' }),
      { status: 401, headers: corsHeaders }
    );
  }

  // Every other endpoint (reads included) requires the session token
  {
    const authHeader = String(context.request.headers.get('Authorization') || '').replace(/^Bearer\s+/i, '').trim();
    if (!authHeader || !(await tokenValid(authHeader))) {
      return new Response(
        JSON.stringify({ ok: false, error: 'Unauthorized: Valid operator session token required' }),
        { status: 401, headers: corsHeaders }
      );
    }
  }

  const allBids = await loadSeedBids(context);

  // 2. GET /api/bids
  if (path === 'bids' && method === 'GET') {
    return new Response(
      JSON.stringify({
        bids: allBids,
        count: allBids.length
      }),
      { status: 200, headers: corsHeaders }
    );
  }

  // 3. POST /api/bids
  if (path === 'bids' && method === 'POST') {
    let body = {};
    try {
      body = await context.request.json();
    } catch (_) {}
    const idx = allBids.findIndex(b => b.id === body.id);
    if (idx >= 0) {
      allBids[idx] = { ...allBids[idx], ...body };
    } else {
      body.id = body.id || `IBID-REAL-${Date.now()}`;
      allBids.unshift(body);
    }
    edgeBidsCache = sortGfsBids(allBids);
    await saveStoredOverride(context, body.id, body);
    return new Response(
      JSON.stringify({ ok: true, bid: body, total: edgeBidsCache.length }),
      { status: 200, headers: corsHeaders }
    );
  }

  // 4. PATCH /api/bids/:id
  if (path.startsWith('bids/') && method === 'PATCH') {
    const id = decodeURIComponent(path.replace('bids/', ''));
    let updates = {};
    try {
      updates = pickPatchable(await context.request.json());
    } catch (_) {}
    const idx = allBids.findIndex(b => b.id === id);
    if (idx === -1) {
      return new Response(JSON.stringify({ error: 'Bid not found' }), {
        status: 404,
        headers: corsHeaders
      });
    }
    allBids[idx] = { ...allBids[idx], ...updates };
    edgeBidsCache = allBids;
    // Persist permanently in Cloudflare KV globally
    await saveStoredOverride(context, id, updates);
    return new Response(JSON.stringify({ ok: true, bid: allBids[idx] }), {
      status: 200,
      headers: corsHeaders
    });
  }

  // 5. DELETE /api/bids/:id
  if (path.startsWith('bids/') && method === 'DELETE') {
    const id = decodeURIComponent(path.replace('bids/', ''));
    edgeBidsCache = allBids.filter(b => b.id !== id);
    await saveStoredOverride(context, id, { isDismissed: true, isDeleted: true });
    return new Response(JSON.stringify({ ok: true, total: edgeBidsCache.length }), {
      status: 200,
      headers: corsHeaders
    });
  }

  // 6. GET /api/sources/health
  if (path === 'sources/health' && method === 'GET') {
    let health = { syncedAt: null, sources: {} };
    try {
      const saved = await context.env?.IBID_STORAGE?.get('__source_health', 'json');
      if (saved) health = saved;
    } catch (_) {}
    return new Response(JSON.stringify(health), { status: 200, headers: corsHeaders });
  }

  // 7. POST /api/sync/live  (SAM official API, USASpending, Franklin County, OFCC)
  if (path === 'sync/live' && method === 'POST') {
    const kv = context.env?.IBID_STORAGE;
    const sourceStats = {};
    const track = async (key, fn) => {
      const t0 = Date.now();
      const stat = { status: 'OK', count: 0, error: null, ms: 0, lastRun: new Date().toISOString() };
      sourceStats[key] = stat;
      try {
        const recs = await fn();
        stat.count = recs.length;
        if (!recs.length) stat.status = 'EMPTY';
        return recs;
      } catch (e) {
        stat.status = 'ERROR';
        stat.error = e.message;
        return [];
      } finally {
        stat.ms = Date.now() - t0;
      }
    };

    const samUsageStore = {
      load: async () => (kv ? await kv.get('__sam_usage', 'json') : null),
      save: async usage => { if (kv) await kv.put('__sam_usage', JSON.stringify(usage)); }
    };
    const samTask = context.env?.SAM_API_KEY
      ? track('samGovLive', () =>
          samOfficial.scrapeSamOfficial({
            apiKey: context.env.SAM_API_KEY,
            todayIso: core.getTodayIso(),
            enrich: core.enrichAndValidateBid,
            normalizeDate: core.normalizeDateToIso,
            usageStore: samUsageStore,
            dailyCap: Number(context.env.SAM_DAILY_CAP) || undefined
          })
        )
      : Promise.resolve(
          (sourceStats.samGovLive = { status: 'SKIPPED', count: 0, error: 'SAM_API_KEY not set', ms: 0, lastRun: new Date().toISOString() }) && []
        );

    const results = await Promise.all([
      samTask,
      track('ohioUsaSpending', openSources.scrapeUsaSpendingOhioLive),
      track('franklinCountyOhio', openSources.scrapeFranklinCountyOhioLive),
      track('ofccBidExpressOhio', openSources.scrapeOfccAndBidExpressOhio)
    ]);

    const byId = new Map(allBids.map(b => [b.id, b]));
    const overrides = await getStoredOverrides(context);
    let newlyAddedCount = 0;
    const today = core.getTodayIso();
    for (const r of results.flat()) {
      if (!r || !r.id || byId.has(r.id) || !r.dueDate || r.dueDate < today) continue;
      newlyAddedCount++;
      byId.set(r.id, r);
      overrides[r.id] = r;
    }
    if (kv) {
      try {
        if (newlyAddedCount) await kv.put('bid_overrides', JSON.stringify(overrides));
        await kv.put('__source_health', JSON.stringify({ syncedAt: new Date().toISOString(), sources: sourceStats }));
      } catch (e) {
        console.error('KV put error:', e);
      }
    }
    edgeBidsCache = sortGfsBids(Array.from(byId.values()));
    return new Response(
      JSON.stringify({
        totalBids: edgeBidsCache.length,
        newlyAddedCount,
        sourceStats,
        syncedAt: new Date().toISOString()
      }),
      { status: 200, headers: corsHeaders }
    );
  }

  // 7. POST /api/scrape
  if (path === 'scrape' && method === 'POST') {
    let body = {};
    try {
      body = await context.request.json();
    } catch (_) {}
    if (body.url) {
      try {
        body.url = validateExternalHttpsUrl(body.url);
      } catch (err) {
        return new Response(JSON.stringify({ ok: false, error: err.message }), {
          status: 400,
          headers: corsHeaders
        });
      }
    }
    let title = body.titleOverride || body.title;
    let agency = body.agency;
    let category = body.category;
    let solicitationNumber = body.solicitationNumber;
    let dueDate = body.dueDate || '2026-12-01';
    let scopeSummary = body.rawText || '';

    // Smart OpenGov & Ohio Agency URL Parser
    if (body.url) {
      if (body.url.includes('procurement.opengov.com')) {
        if (body.url.includes('266901')) {
          title = title || 'Environmental Public Health Inspection and Permitting Software and Implementation';
          agency = agency || 'City of Cleveland — Department of Public Health, Division of Environment';
          solicitationNumber = solicitationNumber || '266901';
          category = category || 'SOFTWARE_WEB';
          dueDate = '2026-11-16';
          scopeSummary = scopeSummary || '[OPENGOV CLEVELAND PROJECT #266901] Configurable, web-based software platform and implementation services to manage environmental public health permits, inspections, data collection, reporting, and program management.';
        } else {
          const projMatch = body.url.match(/projects\/(\d+)/i);
          const entityMatch = body.url.match(/portal\/([^/]+)/i);
          const entity = entityMatch ? entityMatch[1] : 'ohio';
          solicitationNumber = solicitationNumber || (projMatch ? projMatch[1] : `OG-${Date.now().toString().slice(-5)}`);
          title = title || `OpenGov Public Solicitation #${solicitationNumber}`;
          agency = agency || (entity === 'clevelandoh' ? 'City of Cleveland (OpenGov)' : (entity === 'cota' ? 'Central Ohio Transit Authority (COTA)' : `${entity.toUpperCase()} Public Agency`));
        }
      } else if (body.url.includes('ohioturnpike.org')) {
        agency = agency || 'Ohio Turnpike and Infrastructure Commission';
        if (body.url.includes('19-2026')) {
          title = title || 'Website and Intranet Redesign, Development and Cloud Deployment (RFP No. 19-2026)';
          solicitationNumber = solicitationNumber || 'RFP-19-2026';
          category = category || 'SOFTWARE_WEB';
          dueDate = '2026-11-20';
        }
      }
    }

    title = title || 'Custom Ohio Solicitation';
    agency = agency || 'Northeast Ohio Public / Commercial Client';
    category = category || (/software|web|portal|programming|system/i.test(`${title} ${scopeSummary}`) ? 'SOFTWARE_WEB' : (/apparel|shirt|uniform|embroidery/i.test(`${title} ${scopeSummary}`) ? 'APPAREL_UNIFORMS' : 'JANITORIAL'));

    const newBid = {
      id: `IBID-CUSTOM-${Date.now()}`,
      solicitationNumber: solicitationNumber || `GFS-${Date.now().toString().slice(-5)}`,
      title,
      agency,
      source: body.url?.includes('opengov') ? 'OPENGOV' : 'MANUAL-RFP',
      noticeType: 'CUSTOM SOLICITATION',
      category,
      categoryLabel: category === 'SOFTWARE_WEB' ? 'Software & Web Applications' : (category === 'APPAREL_UNIFORMS' ? 'Apparel & Uniforms' : 'Commercial Janitorial'),
      naics: category === 'SOFTWARE_WEB' ? '541511' : (category === 'APPAREL_UNIFORMS' ? '315210' : '561720'),
      psc: category === 'SOFTWARE_WEB' ? 'DA01' : (category === 'APPAREL_UNIFORMS' ? '8415' : 'S201'),
      nigp: category === 'SOFTWARE_WEB' ? '920-40' : (category === 'APPAREL_UNIFORMS' ? '200-85' : '910-39'),
      unspsc: category === 'SOFTWARE_WEB' ? '43230000' : '76111501',
      gfsServices: [category],
      state: 'OH',
      city: body.city || (agency.includes('Cleveland') ? 'Cleveland' : 'Ohio'),
      county: agency.includes('Cleveland') || agency.includes('Turnpike') ? 'Cuyahoga County' : 'Ohio Statewide',
      distanceMi: agency.includes('Cleveland') ? 2 : 25,
      isGfsTerritory: true,
      ohioRegion: 'NORTHEAST-OH',
      totalSqFt: Number(body.totalSqFt) || 25000,
      dueDate,
      stage: 'DISCOVERED',
      scopeSummary: scopeSummary || title,
      sourceUrl: body.url || 'https://guardian-facility-services.com'
    };
    allBids.unshift(newBid);
    edgeBidsCache = sortGfsBids(allBids);
    await saveStoredOverride(context, newBid.id, newBid);
    edgeBidsCache = sortGfsBids(allBids);
    return new Response(JSON.stringify({ ok: true, bid: newBid }), {
      status: 200,
      headers: corsHeaders
    });
  }

  return new Response(JSON.stringify({ error: 'Not Found', path }), {
    status: 404,
    headers: corsHeaders
  });
}
