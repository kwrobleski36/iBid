/**
 * iBid // REAL-DATA MULTI-PORTAL AGGREGATION & SCRAPER ENGINE
 * STRICT RULES:
 *   1. ZERO SAMPLE DATA — Every record is scraped live from real government/procurement portals.
 *   2. STRICT FUTURE-DATE GATE — Every record MUST have a Closing / Due / Expiration date >= TODAY.
 *      Closed, expired, cancelled, or past-due solicitations are strictly rejected.
 */

const fs = require('fs');

const EDGE_PATHS = [
  'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
  'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe'
];

function findBrowserExecutable() {
  for (const p of EDGE_PATHS) {
    if (fs.existsSync(p)) return p;
  }
  return null;
}

function getTodayIso() {
  const now = new Date();
  const yyyy = now.getFullYear();
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const dd = String(now.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

// Convert MM/DD/YYYY or M/D/YYYY or ISO string to YYYY-MM-DD
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

function isTodayOrFuture(dateStr) {
  const iso = normalizeDateToIso(dateStr);
  if (!iso) return false;
  return iso >= getTodayIso();
}

function inferOhioRegion(text = '', state = 'OH') {
  if (state && state !== 'OH' && state !== 'Ohio') return `NATIONAL (${state})`;
  const t = text.toUpperCase();
  if (/CLEVELAND|CUYAHOGA|AKRON|SUMMIT|PARMA|LORAIN|CANTON|STARK|YOUNGSTOWN|MAHONING|LAKE|MENTOR|MEDINA|KENT/.test(t)) {
    return 'NORTHEAST-OH';
  }
  if (/CINCINNATI|HAMILTON|DAYTON|MONTGOMERY|WRIGHT-PATTERSON|WPAFB|FAIRBORN|GREENE|BUTLER|LAKOTA|MASON|WARREN|TROY|MIAMI|PIQUA|36C250/.test(t)) {
    return 'SOUTHWEST-OH';
  }
  if (/TOLEDO|LUCAS|FINDLAY|BOWLING GREEN|WOOD|SANDUSKY|ERIE|LIMA|ALLEN|MAUMEE/.test(t)) {
    return 'NORTHWEST-OH';
  }
  if (/ATHENS|CHILLICOTHE|ROSS|ZANESVILLE|MUSKINGUM|PORTSMOUTH|SCIOTO|MARIETTA|SOCF|LUCASVILLE|NELSONVILLE|WAYNE NATIONAL|DILLON|HOCKING/.test(t)) {
    return 'SOUTHEAST-OH';
  }
  return 'CENTRAL-OH';
}

// ============================================================================
// 1. LIVE SAM.GOV SCRAPER — STRICTLY OPEN SOLICITATIONS CLOSING >= TODAY
// ============================================================================
async function scrapeSamGovLive() {
  const records = [];
  const today = getTodayIso();

  // Relevance-sorted queries for janitorial, custodial, and carpet cleaning
  const queries = [
    'https://sam.gov/api/prod/sgs/v1/search/?index=opp&page=0&mode=search&size=50&is_active=true&q=%22janitorial%22',
    'https://sam.gov/api/prod/sgs/v1/search/?index=opp&page=0&mode=search&size=50&is_active=true&q=%22custodial%22',
    'https://sam.gov/api/prod/sgs/v1/search/?index=opp&page=0&mode=search&size=50&is_active=true&q=%22carpet+cleaning%22',
    'https://sam.gov/api/prod/sgs/v1/search/?index=opp&page=0&mode=search&size=50&is_active=true&q=S201+cleaning'
  ];

  const candidates = [];
  const seenIds = new Set();

  for (const qUrl of queries) {
    try {
      const res = await fetch(qUrl, {
        headers: {
          Accept: 'application/hal+json',
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)'
        }
      });
      if (!res.ok) continue;
      const data = await res.json();
      for (const item of data._embedded?.results || []) {
        if (!item._id || seenIds.has(item._id) || item.isCanceled) continue;
        const noticeType = item.type?.value || '';
        // Exclude Award Notices and anything without a future responseDate
        if (/award/i.test(noticeType)) continue;
        const respIso = normalizeDateToIso(item.responseDate);
        if (!respIso || respIso < today) continue;

        seenIds.add(item._id);
        candidates.push(item);
      }
    } catch (e) {
      console.error('SAM.gov query error:', e.message);
    }
  }

  // Fetch full opportunity details for each open future-closing solicitation
  for (const item of candidates.slice(0, 22)) {
    try {
      const detRes = await fetch(`https://sam.gov/api/prod/opps/v2/opportunities/${item._id}`, {
        headers: {
          Accept: 'application/hal+json, application/json',
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)'
        }
      });
      if (!detRes.ok) continue;
      const det = await detRes.json();
      const d2 = det.data2 || {};

      const responseIso = normalizeDateToIso(d2.solicitation?.deadlines?.response || item.responseDate);
      if (!responseIso || responseIso < today) continue;

      const solNum = d2.solicitationNumber || item.solicitationNumber || item._id.slice(0, 12);
      const title = (d2.title || item.title || 'Federal Cleaning Solicitation').trim();
      const naicsCodes = (d2.naics || []).flatMap(n => n.code || []);
      const primaryNaics = naicsCodes[0] || (/carpet/i.test(title) ? '561740' : '561720');

      const isCarpet = primaryNaics === '561740' || /carpet|upholstery|rug|floor|mat/i.test(title);
      const isJanitorial = primaryNaics === '561720' || /janitorial|custodial|cleaning|window/i.test(title);
      const category = isCarpet && isJanitorial ? 'COMBO' : (isCarpet ? 'CARPET' : 'JANITORIAL');

      const orgHierarchy = item.organizationHierarchy || [];
      const deptName = orgHierarchy[0]?.name || 'U.S. Federal Government';
      const officeObj = orgHierarchy[orgHierarchy.length - 1] || {};
      const officeName = officeObj.name || '';

      const pop = d2.placeOfPerformance || {};
      const popState = pop.state?.code || pop.state?.name || officeObj.address?.state || 'US';
      const popCity = pop.city?.name || officeObj.address?.city || 'Federal Facility';

      const poc = (d2.pointOfContact && d2.pointOfContact[0]) || {};
      const rawDescHtml = (det.description && det.description[0]?.body) ||
                          (item.descriptions && item.descriptions[0]?.content) ||
                          '';
      const cleanDesc = rawDescHtml
        .replace(/<[^>]+>/g, ' ')
        .replace(/&nbsp;/g, ' ')
        .replace(/&mdash;/g, '—')
        .replace(/\s+/g, ' ')
        .trim();

      let realSqFt = null;
      const sfMatch = cleanDesc.match(/(\d{1,3}(?:,\d{3})+|\d{4,6})\s*(?:sq\.?\s*ft\.?|square\s*feet|sf\b)/i);
      if (sfMatch) {
        realSqFt = parseInt(sfMatch[1].replace(/,/g, ''), 10);
      }

      const noticeType = item.type?.value || 'Solicitation';
      const setAsideCode = d2.solicitation?.setAside || 'Open Federal Solicitation';
      const publishIso = normalizeDateToIso(item.publishDate || det.postedDate) || today;

      const isOhio =
        popState === 'OH' ||
        popState === 'Ohio' ||
        /OHIO|DAYTON|CLEVELAND|COLUMBUS|CINCINNATI|WRIGHT-PATTERSON|36C250|W912QR/i.test(
          `${title} ${officeName} ${popCity} ${cleanDesc}`
        );
      const stateFinal = isOhio ? 'OH' : popState;

      records.push({
        id: `SAM-${item._id}`,
        solicitationNumber: solNum,
        title,
        agency: `${deptName}${officeName ? ' — ' + officeName : ''}`,
        source: 'SAM.GOV',
        noticeType: `OPEN: ${noticeType}`,
        category,
        naics: primaryNaics,
        psc: d2.classificationCode || 'S201',
        setAside: setAsideCode,
        state: stateFinal,
        ohioRegion: inferOhioRegion(`${title} ${popCity} ${officeName}`, stateFinal),
        city: popCity,
        totalSqFt: realSqFt,
        carpetSqFt: realSqFt && isCarpet ? realSqFt : null,
        hardFloorSqFt: null,
        restroomSqFt: null,
        frequency: 'See Official SAM.gov Solicitation Attachments',
        extractionMethod: 'See Official PWS / SOW Attachment',
        estimatedValue: null,
        incumbent: 'ACTIVE OPEN SOLICITATION',
        priorAwardValue: null,
        postedDate: publishIso,
        dueDate: responseIso,
        stage: 'DISCOVERED',
        isLiveSynced: true,
        scopeSummary: cleanDesc
          ? cleanDesc.slice(0, 700)
          : `ACTIVE OPEN SAM.GOV ${noticeType.toUpperCase()} (#${solNum}) — Closing Date: ${responseIso}. Issued by ${deptName} (${officeName}). Click "OPEN OFFICIAL PORTAL / PDF" to view the live solicitation and download the PWS/SOW attachments on SAM.gov.`,
        lineItems: [
          `SAM.gov Notice ID: ${item._id} | Solicitation #: ${solNum}`,
          `Status: ACTIVE OPEN (${noticeType}) | Published: ${publishIso} | Closing Deadline: ${responseIso}`,
          `NAICS: ${naicsCodes.join(', ') || primaryNaics} | PSC: ${d2.classificationCode || 'S201'} | Set-Aside: ${setAsideCode}`
        ],
        contactName: poc.fullName || 'SAM.gov Contracting Officer',
        contactEmail: poc.email || 'See SAM.gov Notice',
        contactPhone: poc.phone || 'See SAM.gov Notice',
        sourceUrl: `https://sam.gov/opp/${item._id}/view`
      });
    } catch (_) {}
  }

  return records;
}

// ============================================================================
// 2. HEADLESS EDGE SCRAPER: BIDNET DIRECT OHIO & OHIOBUYS (CLOSING >= TODAY)
// ============================================================================
async function scrapeOhioPortalsHeadless() {
  const records = [];
  const today = getTodayIso();
  const execPath = findBrowserExecutable();
  if (!execPath) return records;

  let puppeteer;
  try {
    puppeteer = require('puppeteer-core');
  } catch (_) {
    return records;
  }

  let browser;
  try {
    browser = await puppeteer.launch({
      executablePath: execPath,
      headless: 'new',
      args: ['--no-sandbox', '--disable-blink-features=AutomationControlled']
    });

    const page = await browser.newPage();
    await page.setUserAgent(
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36 Edg/126.0.0.0'
    );

    // A. Scrape BidNet Direct Ohio across janitorial, carpet, cleaning, and floor keywords
    const bnKeywords = ['janitorial', 'carpet', 'cleaning', 'floor'];
    const seenBnIds = new Set();

    for (const kw of bnKeywords) {
      try {
        await page.goto(`https://www.bidnetdirect.com/ohio/solicitations/open-bids?keywords=${kw}`, {
          waitUntil: 'domcontentloaded',
          timeout: 22000
        });
        await new Promise(r => setTimeout(r, 2200));

        const bnRows = await page.evaluate(() => {
          return Array.from(document.querySelectorAll('tr.mets-table-row')).map(tr => {
            const a = tr.querySelector('a.solicitation-link, a[href*="/solicitations/"]');
            const text = tr.innerText.replace(/\s+/g, ' ').trim();
            const pubMatch = text.match(/Published\s+(\d{2}\/\d{2}\/\d{4})/i);
            const closeMatch = text.match(/Closing\s+(\d{2}\/\d{2}\/\d{4})/i);
            return {
              title: a ? a.innerText.trim() : '',
              href: a ? a.href : '',
              published: pubMatch ? pubMatch[1] : '',
              closing: closeMatch ? closeMatch[1] : ''
            };
          }).filter(r => r.title && r.href);
        });

        for (const row of bnRows) {
          const closeIso = normalizeDateToIso(row.closing);
          // STRICT FUTURE CLOSING CHECK
          if (!closeIso || closeIso < today) continue;

          // Filter out heavy civil/sewer/asphalt/vehicular parts/doors so only real building/janitorial/floor/mat/cleaning bids remain
          if (/sewer|sludge|asphalt|orphan well|quicklime|quick lime|stihl|vehicular|parts kit|exterior doors|partitions and doors|mesh screening|wall covering|park improvements/i.test(row.title)) {
            continue;
          }
          if (!/janitorial|custodial|clean|carpet|floor|mat|mop|scrubber|shelter|career center/i.test(row.title)) {
            continue;
          }

          const idMatch = row.href.match(/\/statewide\/(\d+)\//) || row.href.match(/\/(\d+)\//);
          const solId = idMatch ? idMatch[1] : row.title.replace(/\W+/g, '').slice(0, 16);
          if (seenBnIds.has(solId)) continue;
          seenBnIds.add(solId);

          const pubIso = normalizeDateToIso(row.published) || today;
          const isCarpetOrFloor = /carpet|mat|mop|floor|scrubber/i.test(row.title);
          const isJanitorial = /janitorial|custodial|clean|restroom|shelter|career center/i.test(row.title);
          const category = isCarpetOrFloor && isJanitorial ? 'COMBO' : (isCarpetOrFloor ? 'CARPET' : 'JANITORIAL');
          const naics = category === 'CARPET' ? '561740' : '561720';

          // Infer Ohio city/agency from title if mentioned (e.g., COTA = Columbus, Lorain/Medina, DSCC = Columbus, WPAFB = Dayton, Alum Creek = Delaware)
          let city = 'Ohio';
          let agency = 'Ohio Public Agency (via BidNet Direct Ohio)';
          if (/COTA/i.test(row.title)) {
            city = 'Columbus';
            agency = 'Central Ohio Transit Authority (COTA)';
          } else if (/DSCC/i.test(row.title)) {
            city = 'Columbus';
            agency = 'Defense Supply Center Columbus (DSCC)';
          } else if (/WRIGHT-PATTERSON|WPAFB/i.test(row.title)) {
            city = 'Dayton / WPAFB';
            agency = 'Wright-Patterson AFB (Ohio)';
          } else if (/Lorain\/Medina/i.test(row.title)) {
            city = 'Lorain / Medina';
            agency = 'Lorain/Medina Community Based Correctional Facility';
          } else if (/Alum Creek/i.test(row.title)) {
            city = 'Delaware / Lewis Center';
            agency = 'Ohio DNR — Alum Creek State Park';
          } else if (/R&P/i.test(row.title)) {
            city = 'Columbus';
            agency = 'City of Columbus Recreation & Parks';
          }

          records.push({
            id: `BIDNET-OH-${solId}`,
            solicitationNumber: `BN-OH-${solId}`,
            title: row.title,
            agency,
            source: 'BIDNET-OH',
            noticeType: 'OPEN OHIO SOLICITATION',
            category,
            naics,
            psc: category === 'CARPET' ? 'NIGP 910-09' : 'NIGP 910-39',
            setAside: 'Ohio SLED Open Bid',
            state: 'OH',
            ohioRegion: inferOhioRegion(`${row.title} ${city}`, 'OH'),
            city,
            totalSqFt: null,
            carpetSqFt: null,
            hardFloorSqFt: null,
            restroomSqFt: null,
            frequency: 'See BidNet Direct Ohio Solicitation Packet',
            extractionMethod: 'See BidNet Direct Specification Packet',
            estimatedValue: null,
            incumbent: 'ACTIVE OPEN SOLICITATION',
            priorAwardValue: null,
            postedDate: pubIso,
            dueDate: closeIso,
            stage: 'DISCOVERED',
            isLiveSynced: true,
            scopeSummary: `ACTIVE OPEN OHIO SOLICITATION on BidNet Direct Ohio Purchasing Group — "${row.title}". Published: ${pubIso} (${row.published}), Closing Deadline: ${closeIso} (${row.closing}). Click "OPEN OFFICIAL PORTAL / PDF" to view the live solicitation on BidNet Direct Ohio.`,
            lineItems: [
              `BidNet Direct Ohio ID: #${solId}`,
              `Status: OPEN FOR BIDDING | Published: ${pubIso} | Closing Date: ${closeIso}`,
              `Direct BidNet Ohio URL: ${row.href}`
            ],
            contactName: `${agency} Purchasing`,
            contactEmail: 'See BidNet Ohio Abstract',
            contactPhone: 'See BidNet Ohio Abstract',
            sourceUrl: row.href
          });
        }
      } catch (e) {
        console.error(`BidNet Ohio (${kw}) scrape warning:`, e.message);
      }
    }

    // B. Scrape OhioBuys Public Solicitations (ohiobuys.ohio.gov) closing >= today
    try {
      const pageOb = await browser.newPage();
      await pageOb.setUserAgent(
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36 Edg/126.0.0.0'
      );
      await pageOb.goto('https://ohiobuys.ohio.gov/page.aspx/en/rfp/request_browse_public', {
        waitUntil: 'domcontentloaded',
        timeout: 25000
      });
      await new Promise(r => setTimeout(r, 5500));

      const obRows = await pageOb.evaluate(() => {
        return Array.from(document.querySelectorAll('table tbody tr'))
          .map(tr => {
            const a = tr.querySelector('a[href*="process_manage_extranet"]');
            if (!a) return null;
            const tds = Array.from(tr.querySelectorAll('td')).map(td => td.innerText.trim());
            const srcMatch = tds.find(t => /^SRC\d+/i.test(t));
            if (!srcMatch) return null;
            return {
              srcId: srcMatch,
              title: tds[2] || tds[0] || 'OhioBuys State Solicitation',
              beginDate: tds[4] || tds[3] || '',
              endDate: tds[5] || '',
              commodity: tds[7] || '',
              setAside: tds[8] || 'State of Ohio Open Bid',
              agency: tds[9] || 'State of Ohio Agency',
              status: tds[12] || 'Open for Bidding',
              solType: tds[14] || 'Solicitation',
              href: a.href
            };
          })
          .filter(Boolean);
      });

      for (const r of obRows) {
        const endIso = normalizeDateToIso(r.endDate);
        if (!endIso || endIso < today) continue;
        if (!/open/i.test(r.status)) continue;

        // Filter for facilities, building maintenance, cleaning, janitorial, parks, or correctional/hospital facility work
        if (!/clean|janitor|custod|carpet|floor|maint|building|facility|renovat|park|restroom|waste|trash|hospital|correctional/i.test(
          `${r.title} ${r.commodity} ${r.agency}`
        )) {
          continue;
        }

        const beginIso = normalizeDateToIso(r.beginDate) || today;

        records.push({
          id: `OHIOBUYS-${r.srcId}`,
          solicitationNumber: r.srcId,
          title: r.title,
          agency: `State of Ohio — ${r.agency.replace(/\s+/g, ' ')}`,
          source: 'OHIOBUYS',
          noticeType: `OPEN: ${r.solType}`,
          category: /carpet|floor/i.test(r.title + ' ' + r.commodity) ? 'CARPET' : 'JANITORIAL',
          naics: '561720',
          psc: r.commodity || 'UNSPSC 76110000',
          setAside: r.setAside || 'State of Ohio Open',
          state: 'OH',
          ohioRegion: inferOhioRegion(`${r.agency} ${r.title}`, 'OH'),
          city: 'Ohio Statewide',
          totalSqFt: null,
          carpetSqFt: null,
          hardFloorSqFt: null,
          restroomSqFt: null,
          frequency: 'See OhioBuys Solicitation Documents',
          extractionMethod: 'See OhioBuys Attachment Packet',
          estimatedValue: null,
          incumbent: 'ACTIVE OPEN SOLICITATION',
          priorAwardValue: null,
          postedDate: beginIso,
          dueDate: endIso,
          stage: 'DISCOVERED',
          isLiveSynced: true,
          scopeSummary: `ACTIVE OPEN OHIOBUYS SOLICITATION (${r.srcId}) — "${r.title}". Agency: ${r.agency.replace(/\s+/g, ' ')}. Commodity: ${r.commodity || 'Facility Services'}. Set-Aside: ${r.setAside || 'Open'}. Closing Deadline: ${endIso} (${r.endDate}). Click "OPEN OFFICIAL PORTAL / PDF" to view and bid on OhioBuys.`,
          lineItems: [
            `OhioBuys Solicitation ID: ${r.srcId} | Status: ${r.status} (${r.solType})`,
            `Agency: ${r.agency.replace(/\s+/g, ' ')} | Set-Aside: ${r.setAside || 'Open'}`,
            `Published: ${beginIso} | Closing Deadline: ${endIso} (${r.endDate})`
          ],
          contactName: `${r.agency.split('\n')[0]} Procurement`,
          contactEmail: 'See OhioBuys Solicitation Page',
          contactPhone: 'See OhioBuys Solicitation Page',
          sourceUrl: r.href
        });
      }
    } catch (e) {
      console.error('OhioBuys headless scrape warning:', e.message);
    }
  } finally {
    if (browser) await browser.close();
  }

  return records;
}

// ============================================================================
// 3. LIVE USASPENDING.GOV OHIO — STRICTLY ACTIVE CONTRACTS EXPIRING >= TODAY
// ============================================================================
async function scrapeUsaSpendingOhioLive() {
  const records = [];
  const today = getTodayIso();

  try {
    const payload = {
      fields: [
        'Award ID',
        'Recipient Name',
        'Start Date',
        'End Date',
        'Award Amount',
        'Awarding Agency',
        'Awarding Sub Agency',
        'Description',
        'naics_code',
        'Place of Performance State Code'
      ],
      filters: {
        naics_codes: { require: ['561720', '561740'] },
        place_of_performance_locations: [{ country: 'USA', state: 'OH' }],
        award_type_codes: ['A', 'B', 'C', 'D'],
        time_period: [{ start_date: '2022-01-01', end_date: '2027-12-31' }]
      },
      limit: 35,
      page: 1,
      sort: 'End Date',
      order: 'desc'
    };

    const res = await fetch('https://api.usaspending.gov/api/v2/search/spending_by_award/', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    if (res.ok) {
      const data = await res.json();
      for (const row of data.results || []) {
        const endIso = normalizeDateToIso(row['End Date']);
        // STRICT FUTURE EXPIRATION CHECK: Only include contracts still active (>= today) for upcoming recompetes!
        if (!endIso || endIso < today) continue;

        const awardId = String(row['Award ID'] || '').trim();
        if (!awardId) continue;
        const naics = String(row.naics_code || '561720');
        const desc = String(row.Description || 'JANITORIAL / CUSTODIAL SERVICES').trim();
        const isCarpet = naics === '561740' || /carpet|upholstery|rug|floor/i.test(desc);
        const category = naics === '561740' ? 'CARPET' : (isCarpet ? 'COMBO' : 'JANITORIAL');
        const awardAmt = Number(row['Award Amount']) || null;
        const agency = row['Awarding Agency'] || 'U.S. Federal Agency';
        const subAgency = row['Awarding Sub Agency'] || '';

        let city = 'Ohio';
        const cityMatch = desc.match(/(?:IN|AT)\s+([A-Z][A-Z\s-]{2,18}),?\s*OH\b/i);
        if (cityMatch) city = cityMatch[1].trim();
        else if (/WRIGHT|WPAFB|DAYTON/i.test(desc)) city = 'Dayton / WPAFB';
        else if (/CLEVELAND|GLENN|GRL/i.test(desc)) city = 'Cleveland';
        else if (/COLUMBUS|DSCC/i.test(desc)) city = 'Columbus';
        else if (/TROY/i.test(desc)) city = 'Troy';
        else if (/NELSONVILLE|ATHENS|WAYNE/i.test(desc)) city = 'Nelsonville / Athens';
        else if (/TOLEDO/i.test(desc)) city = 'Toledo';

        records.push({
          id: `USASPEND-OH-${awardId}`,
          solicitationNumber: awardId,
          title: `[UPCOMING RECOMPETE] ${desc}`,
          agency: `${agency}${subAgency ? ' — ' + subAgency : ''}`,
          source: 'USASPENDING-OH',
          noticeType: `ACTIVE CONTRACT (EXPIRES ${endIso})`,
          category,
          naics,
          psc: 'S201',
          setAside: 'Ohio Federal Recompete Target',
          state: 'OH',
          ohioRegion: inferOhioRegion(`${desc} ${city}`, 'OH'),
          city,
          totalSqFt: null,
          carpetSqFt: null,
          hardFloorSqFt: null,
          restroomSqFt: null,
          frequency: `Active Period: ${row['Start Date'] || 'N/A'} to ${endIso}`,
          extractionMethod: 'See Federal Contract File',
          estimatedValue: awardAmt,
          incumbent: row['Recipient Name'] || 'Disclosed on USASpending',
          priorAwardValue: awardAmt,
          postedDate: normalizeDateToIso(row['Start Date']) || today,
          dueDate: endIso,
          stage: 'DISCOVERED',
          isLiveSynced: true,
          scopeSummary: `ACTIVE OHIO FEDERAL CONTRACT EXPIRING ${endIso} (#${awardId}). Currently held by incumbent "${row['Recipient Name'] || 'N/A'}" for $${awardAmt ? awardAmt.toLocaleString() : '0'} under NAICS ${naics} (${desc}). Track this expiration date for the upcoming recompete solicitation.`,
          lineItems: [
            `Federal Award ID: ${awardId} | NAICS: ${naics}`,
            `Current Incumbent: ${row['Recipient Name'] || 'N/A'} ($${awardAmt ? awardAmt.toLocaleString() : '0'})`,
            `Contract Expiration / Recompete Date: ${endIso}`
          ],
          contactName: `${subAgency || agency} Contracting Office`,
          contactEmail: 'See USASpending Award Record',
          contactPhone: 'See USASpending Award Record',
          sourceUrl: row.generated_internal_id
            ? `https://www.usaspending.gov/award/${row.generated_internal_id}`
            : 'https://www.usaspending.gov/search'
        });
      }
    }
  } catch (e) {
    console.error('USASpending Ohio live error:', e.message);
  }
  return records;
}

async function scrapeCincinnatiOpenDataLive() {
  // Note: Only return records from data.cincinnati-oh.gov whose date_due >= today
  const records = [];
  const today = getTodayIso();
  try {
    const url = `https://data.cincinnati-oh.gov/resource/pid3-z56k.json?$where=date_due>='${today}T00:00:00.000'&$limit=10`;
    const res = await fetch(url);
    if (res.ok) {
      const rows = await res.json();
      for (const item of rows || []) {
        const dueIso = normalizeDateToIso(item.date_due);
        if (!dueIso || dueIso < today) continue;
        const projNum = String(item.bid_project_number || '').trim();
        if (!projNum) continue;
        records.push({
          id: `CINCY-OH-${projNum}`,
          solicitationNumber: projNum,
          title: String(item.project_name || 'Cincinnati Solicitation').trim(),
          agency: `City of Cincinnati — ${item.requesting_department || 'Purchasing'}`,
          source: 'CINCY-OH-API',
          noticeType: 'OPEN SOLICITATION',
          category: 'JANITORIAL',
          naics: '561720',
          psc: '910-39',
          setAside: 'City Open Bid',
          state: 'OH',
          ohioRegion: 'SOUTHWEST-OH',
          city: 'Cincinnati',
          totalSqFt: null,
          carpetSqFt: null,
          hardFloorSqFt: null,
          restroomSqFt: null,
          frequency: 'See Bid Booklet',
          extractionMethod: 'See Bid Booklet',
          estimatedValue: null,
          incumbent: 'Open Solicitation',
          priorAwardValue: null,
          postedDate: today,
          dueDate: dueIso,
          stage: 'DISCOVERED',
          isLiveSynced: true,
          scopeSummary: `Open City of Cincinnati Solicitation #${projNum}`,
          lineItems: [`Bid #${projNum} | Closing: ${dueIso}`],
          contactName: item.buyer || 'Cincinnati Purchasing',
          contactEmail: 'purchasing@cincinnati-oh.gov',
          contactPhone: '(513) 352-3209',
          sourceUrl: item.bid_booklet_pdf?.url || 'https://data.cincinnati-oh.gov'
        });
      }
    }
  } catch (_) {}
  return records;
}

async function scrapeFranklinCountyOhioLive() {
  const records = [];
  const today = getTodayIso();
  try {
    const res = await fetch('https://bids.franklincountyohio.gov/', {
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' }
    });
    if (res.ok) {
      const html = await res.text();
      const trs = html.match(/<tr[\s\S]*?<\/tr>/gi) || [];
      for (const tr of trs) {
        const tds = (tr.match(/<td[\s\S]*?<\/td>/gi) || []).map(td =>
          td.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
        );
        if (tds.length < 3) continue;
        const refNum = tds[0];
        const title = tds[1];
        const openDateRaw = tds[2];
        const contact = tds[3] || 'Franklin County Purchasing';

        const dueIso = normalizeDateToIso(openDateRaw);
        if (!dueIso || dueIso < today) continue;

        const hrefMatch = tr.match(/href="([^"]+)"/i);
        const detailUrl = hrefMatch
          ? new URL(hrefMatch[1], 'https://bids.franklincountyohio.gov/').href
          : 'https://bids.franklincountyohio.gov/';

        records.push({
          id: `FRANKLIN-OH-${refNum.replace(/\W+/g, '')}`,
          solicitationNumber: refNum,
          title: `Franklin County: ${title}`,
          agency: 'Franklin County Board of Commissioners (Columbus)',
          source: 'FRANKLIN-CO-OH',
          noticeType: 'OPEN COUNTY SOLICITATION',
          category: /carpet|floor/i.test(title) ? 'CARPET' : 'JANITORIAL',
          naics: '561720',
          psc: 'County Bid',
          setAside: 'Franklin County Open Bid',
          state: 'OH',
          ohioRegion: 'CENTRAL-OH',
          city: 'Columbus',
          totalSqFt: null,
          carpetSqFt: null,
          hardFloorSqFt: null,
          restroomSqFt: null,
          frequency: 'See Franklin County Bid Packet',
          extractionMethod: 'See Franklin County Bid Packet',
          estimatedValue: null,
          incumbent: 'ACTIVE OPEN SOLICITATION',
          priorAwardValue: null,
          postedDate: today,
          dueDate: dueIso,
          stage: 'DISCOVERED',
          isLiveSynced: true,
          scopeSummary: `ACTIVE OPEN FRANKLIN COUNTY SOLICITATION (${refNum}) — "${title}". Opening / Due Date: ${dueIso} (${openDateRaw}). Purchasing Contact: ${contact}.`,
          lineItems: [
            `Franklin County Ref: ${refNum}`,
            `Opening / Closing Date: ${dueIso} (${openDateRaw}) | Contact: ${contact}`
          ],
          contactName: contact,
          contactEmail: 'See Franklin County Portal',
          contactPhone: '(614) 525-3750',
          sourceUrl: detailUrl
        });
      }
    }
  } catch (_) {}
  return records;
}

module.exports = {
  scrapeSamGovLive,
  scrapeUsaSpendingOhioLive,
  scrapeCincinnatiOpenDataLive,
  scrapeFranklinCountyOhioLive,
  scrapeOhioPortalsHeadless,
  inferOhioRegion,
  getTodayIso,
  isTodayOrFuture
};
