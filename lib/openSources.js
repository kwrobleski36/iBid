'use strict';
// Public-API / plain-HTML sources that only need fetch(), so they run locally and on the edge.
const {
  getTodayIso,
  normalizeDateToIso,
  isTodayOrFuture,
  validateExternalHttpsUrl,
  GFS_NE_OHIO_COUNTIES,
  detectGfsTerritory,
  inferOhioRegion,
  unmaskBidNetOrigin,
  isExcludedNoise,
  classifyGfsBid,
  classifyBiddableStage,
  extractWalkthroughInfo,
  enrichAndValidateBid
} = require('./core');

// ============================================================================
// 3. LIVE USASPENDING.GOV OHIO — ACTIVE CONTRACTS EXPIRING >= TODAY (ALL GFS NAICS)
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
        naics_codes: { require: ['561720', '561740', '812332', '423850', '424690'] },
        place_of_performance_locations: [{ country: 'USA', state: 'OH' }],
        award_type_codes: ['A', 'B', 'C', 'D'],
        time_period: [{ start_date: '2022-01-01', end_date: '2027-12-31' }]
      },
      limit: 45,
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
        if (!endIso || endIso < today) continue;

        const awardId = String(row['Award ID'] || '').trim();
        if (!awardId) continue;
        const awardAmt = Number(row['Award Amount']) || 0;
        if (awardAmt <= 0) continue;

        const naics = String(row.naics_code || '561720');
        const desc = String(row.Description || 'JANITORIAL / CUSTODIAL SERVICES').trim();
        if (isExcludedNoise(desc, desc, naics, 'S201', 'OH')) continue;

        const agency = row['Awarding Agency'] || 'U.S. Federal Agency';
        const subAgency = row['Awarding Sub Agency'] || '';

        let city = 'Ohio';
        const cityMatch = desc.match(/(?:IN|AT)\s+([A-Z][A-Z\s-]{2,18}),?\s*OH\b/i);
        if (cityMatch) city = cityMatch[1].trim();
        else if (/CLEVELAND|GLENN|GRC|WADE PARK/i.test(desc)) city = 'Cleveland';
        else if (/AKRON|SEIBERLING/i.test(desc)) city = 'Akron';
        else if (/YOUNGSTOWN|VIENNA/i.test(desc)) city = 'Youngstown / Vienna';
        else if (/CANTON|STARK/i.test(desc)) city = 'Canton';
        else if (/WRIGHT|WPAFB|DAYTON/i.test(desc)) city = 'Dayton / WPAFB';
        else if (/COLUMBUS|DSCC|WYLIE|KINNEARY/i.test(desc)) city = 'Columbus';
        else if (/ZANESVILLE/i.test(desc)) city = 'Zanesville';
        else if (/KENTON/i.test(desc)) city = 'Kenton';
        else if (/WILMINGTON/i.test(desc)) city = 'Wilmington';
        else if (/DELAWARE/i.test(desc)) city = 'Delaware';
        else if (/PORTAGE/i.test(desc)) city = 'Ravenna / Portage';

        let realSqFt = null;
        const sfMatch = desc.match(/(\d{1,3}(?:,\d{3})+|\d{4,6})\s*(?:SQUARE\s*FEET|SQ\.?\s*FT\.?)/i);
        if (sfMatch) {
          realSqFt = parseInt(sfMatch[1].replace(/,/g, ''), 10);
        }

        const enriched = enrichAndValidateBid({
          id: `USASPEND-OH-${awardId}`,
          solicitationNumber: awardId,
          title: `[UPCOMING RECOMPETE] ${desc}`,
          agency: `${agency}${subAgency ? ' — ' + subAgency : ''}`,
          source: 'USASPENDING-OH',
          noticeType: `ACTIVE CONTRACT (EXPIRES ${endIso})`,
          naics,
          psc: 'S201',
          setAside: 'Ohio Federal Recompete Target',
          state: 'OH',
          city,
          totalSqFt: realSqFt,
          carpetSqFt: realSqFt ? Math.round(realSqFt * 0.55) : null,
          hardFloorSqFt: realSqFt ? Math.round(realSqFt * 0.35) : null,
          restroomSqFt: realSqFt ? Math.round(realSqFt * 0.1) : null,
          frequency: `Active Period: ${row['Start Date'] || 'N/A'} to ${endIso}`,
          extractionMethod: 'See Federal Contract File',
          estimatedValue: awardAmt,
          incumbent: row['Recipient Name'] || 'Disclosed on USASpending',
          priorAwardValue: awardAmt,
          postedDate: normalizeDateToIso(row['Start Date']) || today,
          dueDate: endIso,
          stage: 'DISCOVERED',
          isLiveSynced: true,
          scopeSummary: `ACTIVE OHIO FEDERAL CONTRACT EXPIRING ${endIso} (#${awardId}). Currently held by incumbent "${row['Recipient Name'] || 'N/A'}" for $${awardAmt.toLocaleString()} under NAICS ${naics} (${desc}). Track this expiration date for the upcoming recompete solicitation.`,
          lineItems: [
            `Federal Award ID: ${awardId} | NAICS: ${naics}`,
            `Current Incumbent: ${row['Recipient Name'] || 'N/A'} ($${awardAmt.toLocaleString()})`,
            `Contract Expiration / Recompete Date: ${endIso}`
          ],
          contactName: `${subAgency || agency} Contracting Office`,
          contactEmail: 'See USASpending Award Record',
          contactPhone: 'See USASpending Award Record',
          sourceUrl: row.generated_internal_id
            ? `https://www.usaspending.gov/award/${row.generated_internal_id}`
            : 'https://www.usaspending.gov/search'
        });

        if (enriched) records.push(enriched);
      }
    }
  } catch (e) {
    console.error('USASpending Ohio live error:', e.message);
    throw e;
  }
  return records;
}

async function scrapeFranklinCountyOhioLive() {
  const records = [];
  const today = getTodayIso();
  try {
    const res = await fetch('https://bids.franklincountyohio.gov/', {
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' }
    });
    if (!res.ok) throw new Error(`Franklin County HTTP ${res.status}`);
    {
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

        const enriched = enrichAndValidateBid({
          id: `FRANKLIN-OH-${refNum.replace(/\W+/g, '')}`,
          solicitationNumber: refNum,
          title: `Franklin County: ${title}`,
          agency: 'Franklin County Board of Commissioners (Columbus)',
          source: 'FRANKLIN-CO-OH',
          noticeType: 'OPEN COUNTY SOLICITATION',
          naics: '561720',
          psc: 'S201',
          setAside: 'Franklin County Open Bid',
          state: 'OH',
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
        if (enriched) records.push(enriched);
      }
    }
  } catch (e) {
    throw new Error(`Franklin County: ${e.message}`);
  }
  return records;
}

// ============================================================================
// 5. LIVE OFCC CONSTRUCTION BIDDING, BIDEXPRESS & CM-R RFQ SCRAPER (OHIO)
// ============================================================================
async function scrapeOfccAndBidExpressOhio() {
  const records = [];
  const today = getTodayIso();

  // A. Scrape OFCC Construction Bidding (Direct Solicitations + BidExpress Links)
  try {
    const bidUrl = 'https://ofcc.ohio.gov/wps/portal/gov/ofcc/project-opportunities/construction-bidding';
    const res = await fetch(bidUrl, {
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' }
    });
    if (res.ok) {
      const html = await res.text();
      const m = html.match(/id="js-placeholder-json-data"[^>]*>([\s\S]*?)<\//i);
      if (m) {
        const rawJson = m[1].replace(/&quot;/g, '"').replace(/\r\n/g, '');
        const parsed = JSON.parse(rawJson);
        const rows = (parsed.data || []).slice(2);
        for (const r of rows.slice(0, 35)) {
          const bidDateRaw = String(r[1] || '').trim();
          const dueIso = normalizeDateToIso(bidDateRaw);
          if (!dueIso || dueIso < today) continue;

          const projNum = String(r[2] || '').trim();
          const owner = String(r[3] || 'Ohio Public Facility Owner')
            .replace(/\?/g, ' ')
            .replace(/\s+/g, ' ')
            .trim();
          const projName = String(r[4] || 'Ohio Construction Project')
            .replace(/&amp;/g, '&')
            .replace(/\?/g, '—')
            .replace(/\s+/g, ' ')
            .trim();
          const cityCounty = String(r[5] || 'Ohio').trim();
          const solPdfUrl = String(r[9] || '').trim();
          const bidExpressUrl = String(r[11] || '').trim();

          if (isExcludedNoise(projName, `${owner} ${cityCounty}`, '236220', 'Z2AA', 'OH')) continue;

          const enriched = enrichAndValidateBid({
            id: `OFCC-BID-${projNum.replace(/\W+/g, '')}`,
            solicitationNumber: projNum,
            title: `[OFCC / BIDEXPRESS CONSTRUCTION ITB] ${projName} (${owner})`,
            agency: `${owner} — Ohio Facilities Construction Commission (OFCC)`,
            source: 'OFCC-BIDEXPRESS',
            noticeType: 'OPEN CONSTRUCTION ITB / CSI 01-74-23',
            naics: '236220',
            psc: 'Z2AA',
            setAside: 'State of Ohio / EDGE Subcontracting',
            state: 'OH',
            city: cityCounty,
            totalSqFt: 28000,
            carpetSqFt: 14000,
            hardFloorSqFt: 11000,
            restroomSqFt: 3000,
            frequency: 'Phase 1 Rough + Phase 2 Final + Phase 3 VCT/Glass Clean (CSI 01 74 23)',
            extractionMethod: 'CSI 01 74 23 Post-Construction 3-Phase Clean',
            estimatedValue: null,
            incumbent: 'OPEN CONSTRUCTION & SUBCONTRACT BID',
            priorAwardValue: null,
            postedDate: today,
            dueDate: dueIso,
            stage: 'DISCOVERED',
            isLiveSynced: true,
            freePortalUrl: bidExpressUrl || solPdfUrl || bidUrl,
            freePortalLabel: bidExpressUrl
              ? `Open BidExpress Solicitation (${projNum})`
              : `Download Official OFCC Solicitation PDF (${projNum})`,
            unmaskedNote: `Live OFCC & BidExpress Ohio Construction Solicitation (#${projNum}) at ${owner} (${cityCounty}). Target for Prime Trade Bid or CSI 01 74 23 Post-Construction Final Clean subcontract.`,
            scopeSummary: `LIVE OFCC / BIDEXPRESS CONSTRUCTION SOLICITATION (#${projNum}): "${projName}" for ${owner} in ${cityCounty}. Bid Closing Date: ${dueIso} (${bidDateRaw}). Includes Division 01 74 23 Final Cleaning & Division 09 Flooring/Finishes scope. Official Solicitation PDF: ${solPdfUrl || 'See Portal'}. BidExpress Portal: ${bidExpressUrl || 'See OFCC'}.`,
            lineItems: [
              `OFCC Project #: ${projNum} | Owner: ${owner} (${cityCounty})`,
              `Bid Closing Date: ${dueIso} | CSI Spec: Division 01 74 23 Final Cleaning / Div 09 Finishes`,
              `Solicitation PDF: ${solPdfUrl || 'N/A'} | BidExpress: ${bidExpressUrl || 'N/A'}`
            ],
            contactName: `${owner} / OFCC Project Manager`,
            contactEmail: 'info@ofcc.ohio.gov',
            contactPhone: '(614) 466-6290',
            sourceUrl: solPdfUrl || bidExpressUrl || bidUrl
          });
          if (enriched) records.push(enriched);
        }
      }
    }
  } catch (e) {
    console.error('OFCC Construction Bidding error:', e.message);
  }

  // B. Scrape OFCC Best-Value CM-R & Design-Build RFQs (Includes Named Shortlisted General Contractors!)
  try {
    const cmrUrl =
      'https://ofcc.ohio.gov/wps/portal/gov/ofcc/project-opportunities/best-value-selection-rfqs/best-value-selection-rfqs';
    const res = await fetch(cmrUrl, {
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' }
    });
    if (res.ok) {
      const html = await res.text();
      const m = html.match(/id="js-placeholder-json-data"[^>]*>([\s\S]*?)<\//i);
      if (m) {
        const rawJson = m[1].replace(/&quot;/g, '"').replace(/\r\n/g, '');
        const parsed = JSON.parse(rawJson);
        const rows = (parsed.data || []).slice(2);

        for (const r of rows.slice(0, 22)) {
          const pubRaw = String(r[1] || '').trim();
          const dueRaw = String(r[2] || '').trim();
          const projNum = String(r[3] || '').replace(/\s+/g, ' ').trim();
          const rfqPdfUrl = String(r[4] || '').trim();
          const owner = String(r[5] || 'Ohio Public Agency')
            .replace(/\?/g, ' ')
            .replace(/\s+/g, ' ')
            .trim();
          const projName = String(r[7] || 'Facility Renovation Project')
            .replace(/&amp;/g, '&')
            .replace(/\?/g, ' ')
            .replace(/\s+/g, ' ')
            .trim();
          const deliveryMethod = String(r[8] || 'CM-R').trim();
          const costRaw = String(r[9] || '').trim();
          const shortlistRaw = [r[12], r[13], r[14]]
            .map(x => String(x || '').trim())
            .filter(x => x && x !== 'TBD' && x !== 'N/A' && !/^http/i.test(x))
            .join(' • ');

          const costNum = parseInt(costRaw.replace(/[^0-9]/g, ''), 10) || null;
          let dueIso = normalizeDateToIso(dueRaw);

          // If a major 2026 CM-R project already named its shortlisted GCs (like NEOMED $80M or Cleveland Lausche $3.6M),
          // keep it active as a GC Subcontract / CSI 01-74-23 Post-Construction Final Clean lead!
          const is2026ActiveBuild = /^2026/.test(pubRaw) || /^2026/.test(dueRaw);
          if (!is2026ActiveBuild) continue;
          if ((!dueIso || dueIso < today) && shortlistRaw) {
            // Set active subcontract outreach window 45 days out
            const d = new Date();
            d.setDate(d.getDate() + 30);
            dueIso = d.toISOString().slice(0, 10);
          }
          if (!dueIso || dueIso < today) continue;

          if (isExcludedNoise(projName, `${owner} ${deliveryMethod}`, '236220', 'Z2AA', 'OH')) continue;

          // Estimate cleanable square footage from construction budget (~$350/SF commercial construction cost)
          const estSqFt = costNum ? Math.min(250000, Math.max(12000, Math.round(costNum / 350))) : 35000;

          let cityHint = 'Ohio';
          if (/NEOMED|NORTHEAST OHIO MEDICAL/i.test(`${owner} ${projName}`)) cityHint = 'Rootstown (Portage Co)';
          else if (/LAUSCHE|CLEVELAND STATE|CSU.*GARAGE/i.test(`${owner} ${projName}`)) cityHint = 'Cleveland (Cuyahoga Co)';
          else if (/NOBH|NORTHCOAST BEHAVIORAL/i.test(`${owner} ${projName}`)) cityHint = 'Northfield (Summit Co)';
          else if (/KENT STATE/i.test(`${owner} ${projName}`)) cityHint = 'Kent (Portage Co)';
          else if (/AKRON/i.test(`${owner} ${projName}`)) cityHint = 'Akron (Summit Co)';
          else if (/YOUNGSTOWN/i.test(`${owner} ${projName}`)) cityHint = 'Youngstown (Mahoning Co)';
          else if (/OHIO STATE|OSU|WEXNER/i.test(`${owner} ${projName}`)) cityHint = 'Columbus';

          const enriched = enrichAndValidateBid({
            id: `OFCC-CMR-${projNum.replace(/\W+/g, '').slice(0, 18)}`,
            solicitationNumber: projNum,
            title: shortlistRaw
              ? `[GC SUBCONTRACT / CSI 01-74-23] ${projName} — ${owner}`
              : `[OFCC ${deliveryMethod} RFQ] ${projName} — ${owner}`,
            agency: `${owner} (${deliveryMethod} Construction)`,
            source: 'OFCC-CMR',
            noticeType: shortlistRaw ? `ACTIVE BUILD • GC SHORTLISTED` : `OPEN ${deliveryMethod} RFQ`,
            naics: '236220',
            psc: 'Z2AA',
            setAside: 'EDGE / CSI 01-74-23 Subcontract & Prime',
            state: 'OH',
            city: cityHint,
            totalSqFt: estSqFt,
            carpetSqFt: Math.round(estSqFt * 0.45),
            hardFloorSqFt: Math.round(estSqFt * 0.45),
            restroomSqFt: Math.round(estSqFt * 0.1),
            frequency: '3-Phase Post-Construction Clean (Rough + Final + Glass/VCT)',
            extractionMethod: 'CSI 01 74 23 Final Cleaning Spec',
            estimatedValue: costNum ? Math.round(estSqFt * 0.48) : null,
            incumbent: shortlistRaw ? `GCs: ${shortlistRaw}` : 'OPEN OFCC SOLICITATION',
            priorAwardValue: costNum,
            postedDate: normalizeDateToIso(pubRaw) || today,
            dueDate: dueIso,
            stage: 'DISCOVERED',
            isLiveSynced: true,
            freePortalUrl: rfqPdfUrl || cmrUrl,
            freePortalLabel: `Download Official OFCC ${deliveryMethod} RFQ Packet (${projNum})`,
            unmaskedNote: shortlistRaw
              ? `Named General Contractors / CM-R Shortlist: ${shortlistRaw}. Total Construction Budget: ${costRaw || 'TBD'}. Estimated CSI 01 74 23 Final Clean Subcontract Value: $${(estSqFt * 0.48).toLocaleString()} (~${estSqFt.toLocaleString()} SF @ $0.48/SF).`
              : `Live OFCC ${deliveryMethod} Solicitation (#${projNum}) — Total Construction Budget: ${costRaw || 'See RFQ'}.`,
            scopeSummary: `LIVE OFCC ${deliveryMethod} CONSTRUCTION OPPORTUNITY (#${projNum}): "${projName}" for ${owner} (${cityHint}). Total Construction Budget: ${costRaw || 'See Packet'}.${
              shortlistRaw ? ` Named General Contractors / CM-R Firms: ${shortlistRaw}.` : ''
            } Prime target for Division 01 74 23 Post-Construction 3-Phase Final Cleaning, VCT Scrub/Wax, and Window Detailing (~${estSqFt.toLocaleString()} est. SF).`,
            lineItems: [
              `OFCC Project #: ${projNum} | Delivery: ${deliveryMethod} | Construction Budget: ${costRaw || 'TBD'}`,
              `Shortlisted / Awarded GCs: ${shortlistRaw || 'Open Selection — See RFQ PDF'}`,
              `Est. CSI 01 74 23 Final Clean Scope: ~${estSqFt.toLocaleString()} SF ($${(estSqFt * 0.48).toLocaleString()} est. clean-up value)`
            ],
            contactName: shortlistRaw ? `GC Estimating: ${shortlistRaw.split('•')[0].trim()}` : `${owner} / OFCC Contracting`,
            contactEmail: 'info@ofcc.ohio.gov',
            contactPhone: '(614) 466-6290',
            sourceUrl: rfqPdfUrl || cmrUrl
          });
          if (enriched) records.push(enriched);
        }
      }
    }
  } catch (e) {
    console.error('OFCC CM-R RFQ error:', e.message);
  }

  return records;
}


module.exports = { scrapeUsaSpendingOhioLive, scrapeFranklinCountyOhioLive, scrapeOfccAndBidExpressOhio };
