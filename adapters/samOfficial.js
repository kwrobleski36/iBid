'use strict';
// Official SAM.gov Opportunities API adapter (api.sam.gov/opportunities/v2/search).
// Budgeted: one sync costs one call per NAICS code, and a persisted daily counter caps total calls
// so a free-tier key (as low as ~10/day) is never exhausted by accident.

const NAICS_CODES = ['561720', '561740'];

function mmddyyyy(d) {
  return `${String(d.getMonth() + 1).padStart(2, '0')}/${String(d.getDate()).padStart(2, '0')}/${d.getFullYear()}`;
}

// usageStore = { load(todayIso) -> { date, calls }, save(usage) }, so the call counter lives in a file
// locally and in KV on the edge. This module has no Node-only imports.
async function scrapeSamOfficial({ apiKey, todayIso, enrich, normalizeDate, usageStore, fetchImpl = fetch, dailyCap }) {
  if (!apiKey) throw new Error('SAM_API_KEY not set');
  const envCap = typeof process !== 'undefined' && process.env ? Number(process.env.SAM_DAILY_CAP) : 0;
  const cap = dailyCap || envCap || 8;
  const usage = (await usageStore.load(todayIso)) || { date: todayIso, calls: 0 };
  if (usage.date !== todayIso) { usage.date = todayIso; usage.calls = 0; }
  const now = new Date();
  const from = new Date(now.getTime() - 120 * 24 * 60 * 60 * 1000);
  const records = [];
  const seen = new Set();

  for (const ncode of NAICS_CODES) {
    if (usage.calls >= cap) throw new Error(`SAM daily call budget reached (${cap})`);
    const qs = new URLSearchParams({
      api_key: apiKey, postedFrom: mmddyyyy(from), postedTo: mmddyyyy(now),
      limit: '1000', offset: '0', ncode, state: 'OH'
    });
    usage.calls += 1;
    try { await usageStore.save(usage); } catch (_) {}
    const res = await fetchImpl(`https://api.sam.gov/opportunities/v2/search?${qs}`, { headers: { Accept: 'application/json' } });
    if (res.status === 429) throw new Error('SAM rate limit hit (429); try again tomorrow');
    if (!res.ok) throw new Error(`SAM API HTTP ${res.status}`);
    const data = await res.json();

    for (const o of data.opportunitiesData || []) {
      if (!o.noticeId || seen.has(o.noticeId) || o.active === 'No') continue;
      const noticeType = o.type || 'Solicitation';
      if (/award|justification|special notice/i.test(noticeType)) continue;
      seen.add(o.noticeId);
      const dueIso = normalizeDate(o.responseDeadLine);
      const pop = o.placeOfPerformance || {};
      const poc = (o.pointOfContact && o.pointOfContact[0]) || {};
      const agency = String(o.fullParentPathName || '').split('.').filter(Boolean).join(' — ') || 'U.S. Federal Government';
      const bid = enrich({
        id: `SAM-${o.noticeId}`,
        solicitationNumber: (o.solicitationNumber || o.noticeId.slice(0, 12)).trim(),
        title: String(o.title || 'Federal Cleaning Solicitation').trim(),
        agency,
        source: 'SAM.GOV',
        noticeType: `OPEN: ${noticeType}`,
        naics: o.naicsCode || ncode,
        psc: o.classificationCode || 'S201',
        setAside: o.typeOfSetAsideDescription || 'Open Federal Solicitation',
        state: pop.state?.code || 'OH',
        city: pop.city?.name || '',
        postedDate: normalizeDate(o.postedDate) || todayIso,
        dueDate: dueIso,
        stage: 'DISCOVERED',
        isLiveSynced: true,
        scopeSummary: `${noticeType.toUpperCase()} (#${o.solicitationNumber || o.noticeId}) issued by ${agency}. See the SAM.gov notice for scope and attachments.`,
        contactName: poc.fullName || 'SAM.gov Contracting Officer',
        contactEmail: poc.email || 'See SAM.gov Notice',
        contactPhone: poc.phone || 'See SAM.gov Notice',
        sourceUrl: o.uiLink || `https://sam.gov/opp/${o.noticeId}/view`
      });
      if (bid) records.push(bid);
    }
  }
  return records;
}

module.exports = { scrapeSamOfficial };
