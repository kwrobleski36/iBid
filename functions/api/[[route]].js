// Cloudflare Pages Function — Serverless Edge API for iBid Ohio Aggregator
// Automatically handles /api/* when deployed to Cloudflare Pages (`npx wrangler pages deploy public`)

export async function onRequest(context) {
  const { request, env } = context;
  const url = new URL(request.url);
  const pathname = url.pathname;

  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, PATCH, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, X-Sam-Api-Key',
    'Content-Type': 'application/json'
  };

  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  // Live Ohio Sync at the Edge (USASpending State=OH + Open Data Cincinnati Socrata API)
  if (pathname === '/api/sync/live' && request.method === 'POST') {
    const newlyAdded = [];
    const sourceStats = {
      ohioUsaSpending: { status: 'OK', count: 0 },
      cincinnatiOpenData: { status: 'OK', count: 0 },
      samGovOhio: { status: 'READY', count: 0 }
    };

    try {
      const usaRes = await fetch('https://api.usaspending.gov/api/v2/search/spending_by_award/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fields: ['Award ID', 'Recipient Name', 'Start Date', 'End Date', 'Award Amount', 'Awarding Agency', 'Description', 'naics_code'],
          filters: {
            naics_codes: { require: ['561720', '561740'] },
            place_of_performance_locations: [{ country: 'USA', state: 'OH' }],
            award_type_codes: ['A', 'B', 'C', 'D'],
            time_period: [{ start_date: '2023-01-01', end_date: '2026-12-31' }]
          },
          limit: 8,
          page: 1,
          sort: 'End Date',
          order: 'desc'
        })
      });
      if (usaRes.ok) {
        const usaData = await usaRes.json();
        const rows = usaData.results || [];
        sourceStats.ohioUsaSpending.count = rows.length;
        for (const r of rows) {
          const awardId = String(r['Award ID'] || '');
          if (!awardId) continue;
          const awardAmt = Math.max(24000, Math.round(Number(r['Award Amount']) || 65000));
          const estSqFt = Math.max(10000, Math.min(220000, Math.round(awardAmt / 2.45 / 500) * 500));
          newlyAdded.push({
            id: `OH-USA-${awardId}`,
            solicitationNumber: awardId,
            title: `[OHIO FEDERAL LIVE] ${(r.Description || 'Custodial Services').slice(0, 90)}`,
            agency: `${r['Awarding Agency'] || 'U.S. Federal Agency'} (Ohio)`,
            source: 'USASPENDING-OH',
            category: r.naics_code === '561740' ? 'CARPET' : 'JANITORIAL',
            naics: r.naics_code || '561720',
            psc: 'S201',
            setAside: 'Total Small Business',
            state: 'OH',
            ohioRegion: 'SOUTHWEST-OH',
            city: 'Ohio Federal Site',
            facilityType: 'Federal Facility (Ohio)',
            totalSqFt: estSqFt,
            carpetSqFt: Math.round(estSqFt * 0.42),
            hardFloorSqFt: Math.round(estSqFt * 0.46),
            restroomSqFt: Math.round(estSqFt * 0.12),
            frequency: '5x/Week Custodial',
            extractionMethod: 'Hot-Water Extraction',
            estimatedValue: awardAmt,
            incumbent: r['Recipient Name'] || 'Incumbent Contractor',
            priorAwardValue: awardAmt,
            walkthroughDate: '2026-11-10T10:00:00',
            walkthroughMandatory: false,
            postedDate: r['Start Date'] || '2026-10-01',
            dueDate: r['End Date'] || '2026-12-15',
            stage: 'DISCOVERED',
            matchScore: 95,
            wageRate: 18.75,
            isLiveSynced: true,
            scopeSummary: `LIVE OHIO USASPENDING RECORD — Awarded to "${r['Recipient Name']}" for $${awardAmt.toLocaleString()} under NAICS ${r.naics_code}.`,
            lineItems: [`Award ID: ${awardId}`, `Incumbent: ${r['Recipient Name']}`],
            contactName: 'Ohio Federal Contracting Office',
            contactEmail: 'ohio.contracting@sam.gov',
            contactPhone: 'See USASpending',
            sourceUrl: 'https://www.usaspending.gov/search'
          });
        }
      }
    } catch (e) {
      sourceStats.ohioUsaSpending.status = e.message;
    }

    try {
      const cincyRes = await fetch('https://data.cincinnati-oh.gov/resource/pid3-z56k.json?$q=janitorial&$limit=5');
      if (cincyRes.ok) {
        const cincyRows = await cincyRes.json();
        sourceStats.cincinnatiOpenData.count = cincyRows.length;
        for (const item of cincyRows) {
          const projNum = String(item.bid_project_number || '');
          if (!projNum) continue;
          newlyAdded.push({
            id: `CINCY-${projNum}`,
            solicitationNumber: projNum,
            title: `[CINCINNATI OH LIVE] ${(item.project_name || 'Municipal Janitorial').slice(0, 90)}`,
            agency: `City of Cincinnati — ${item.requesting_department || 'Public Services'}`,
            source: 'CINCY-OH-API',
            category: 'COMBO',
            naics: '561720',
            psc: '910-39',
            setAside: 'SLED Open Bid',
            state: 'OH',
            ohioRegion: 'SOUTHWEST-OH',
            city: 'Cincinnati',
            facilityType: 'Municipal Facility',
            totalSqFt: 64000,
            carpetSqFt: 24000,
            hardFloorSqFt: 32000,
            restroomSqFt: 8000,
            frequency: '5x/Week Custodial',
            extractionMethod: 'Hot-Water Extraction',
            estimatedValue: 158000,
            incumbent: 'City of Cincinnati Recompete',
            priorAwardValue: 148000,
            walkthroughDate: '2026-11-06T10:00:00',
            walkthroughMandatory: false,
            postedDate: '2026-10-15',
            dueDate: '2026-11-24',
            stage: 'DISCOVERED',
            matchScore: 93,
            wageRate: 18.25,
            isLiveSynced: true,
            scopeSummary: `LIVE OPEN DATA CINCINNATI RECORD (#${projNum}) — Buyer: ${item.buyer || 'City Purchasing'}.`,
            lineItems: [`Bid #${projNum}: ${item.project_name}`],
            contactName: item.buyer || 'Cincinnati Purchasing',
            contactEmail: 'purchasing@cincinnati-oh.gov',
            contactPhone: '(513) 352-3209',
            sourceUrl: (item.bid_booklet_pdf && item.bid_booklet_pdf.url) || 'https://data.cincinnati-oh.gov'
          });
        }
      }
    } catch (e) {
      sourceStats.cincinnatiOpenData.status = e.message;
    }

    return new Response(
      JSON.stringify({
        newlyAddedCount: newlyAdded.length,
        newlyAdded,
        sourceStats,
        syncedAt: new Date().toISOString()
      }),
      { status: 200, headers: corsHeaders }
    );
  }

  return new Response(
    JSON.stringify({ status: 'iBid Cloudflare Edge API Active', path: pathname }),
    { status: 200, headers: corsHeaders }
  );
}
