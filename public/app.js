/* ============================================================================
   iBid // OHIO — CLEAN LIVE FRONTEND CONTROLLER
   100% Real Scraped Data | Strictly Future-Closing Contracts (>= Today)
   ============================================================================ */

const OHIO_PORTAL_DIRECTORY = [
  // STATEWIDE & FEDERAL
  {
    name: 'OhioBuys — State of Ohio Procurement (DAS)',
    region: 'STATEWIDE',
    jurisdiction: 'State of Ohio (All State Agencies, ODOT, DNR, DRC, DMH)',
    platform: 'Ivalua Engine (Auto-Scraped by iBid)',
    autoScraped: true,
    commodityCode: 'UNSPSC 76110000 (Cleaning & Janitorial)',
    url: 'https://ohiobuys.ohio.gov/page.aspx/en/rfp/request_browse_public',
    notes: 'Official State of Ohio portal for state office buildings, highway rest areas, state parks, and universities. Filter by "Open for Bidding" and look for MBE/EDGE set-asides.'
  },
  {
    name: 'BidNet Direct — Ohio Purchasing Group',
    region: 'STATEWIDE',
    jurisdiction: '80+ Ohio Cities, Counties, Townships & Authorities',
    platform: 'BidNet Direct Mets (Auto-Scraped by iBid)',
    autoScraped: true,
    commodityCode: 'NIGP 910-39 (Janitorial) & 910-09 (Carpet)',
    url: 'https://www.bidnetdirect.com/ohio/solicitations/open-bids?keywords=cleaning',
    notes: 'Largest multi-agency municipal portal in Ohio. Covers participating cities, park districts, libraries, and regional authorities across all 88 counties.'
  },
  {
    name: 'SAM.gov — Ohio Federal Installations',
    region: 'STATEWIDE',
    jurisdiction: 'WPAFB (Dayton), VA VISN 10, NASA Glenn (Cleveland), DSCC (Columbus)',
    platform: 'SAM.gov HAL+JSON API (Auto-Scraped by iBid)',
    autoScraped: true,
    commodityCode: 'NAICS 561720 & 561740 / PSC S201',
    url: 'https://sam.gov/content/opportunities',
    notes: 'All federal custodial and carpet extraction contracts over $25,000 in Ohio. Frequently set aside for Total Small Business or SDVOSB.'
  },

  // CENTRAL OHIO (COLUMBUS / FRANKLIN / DELAWARE)
  {
    name: 'Franklin County Board of Commissioners Purchasing',
    region: 'CENTRAL-OH',
    jurisdiction: 'Franklin County (Columbus Metro)',
    platform: 'Direct HTML Bid Table (Auto-Scraped by iBid)',
    autoScraped: true,
    commodityCode: 'Facility Custodial & Floor Maintenance',
    url: 'https://bids.franklincountyohio.gov/',
    notes: 'Direct county bid table for Franklin County courthouses, health & human services facilities, and county office buildings.'
  },
  {
    name: 'City of Columbus — Vendor Services Portal',
    region: 'CENTRAL-OH',
    jurisdiction: 'City of Columbus (Recreation & Parks, Public Service, Utilities)',
    platform: 'Microsoft PowerApps / Dynamics 365 Portal',
    autoScraped: false,
    commodityCode: 'UNSPSC 76110000 / Janitorial & Carpet',
    url: 'https://columbusvendorservices.powerappsportals.com/Solicitations/',
    notes: 'Official City of Columbus RFQ/ITB portal. Columbus Recreation & Parks also cross-posts major facility cleaning RFPs onto BidNet Direct Ohio.'
  },
  {
    name: 'COTA — Central Ohio Transit Authority',
    region: 'CENTRAL-OH',
    jurisdiction: 'Columbus / Central Ohio Transit Facilities & Terminals',
    platform: 'OpenGov Procurement + BidNet Ohio',
    autoScraped: true,
    commodityCode: 'NAICS 561720 & 561740',
    url: 'https://procurement.opengov.com/portal/cota',
    notes: 'Publishes transit center custodial, bus terminal floor care, and administrative building cleaning contracts.'
  },
  {
    name: 'The Ohio State University — Purchasing & Supplier Portal',
    region: 'CENTRAL-OH',
    jurisdiction: 'OSU Main Campus (Columbus), Wexner Medical Center & Regional Campuses',
    platform: 'Workday / OSU Bidboard',
    autoScraped: false,
    commodityCode: 'Campus Custodial, Event Cleaning & Carpet Extraction',
    url: 'https://busfin.osu.edu/buy-sell-travel/purchasing',
    notes: 'High-volume contracts for residence hall turn-cleaning, athletic facility cleaning, and medical center floor care.'
  },
  {
    name: 'City of Westerville / Central Ohio Suburbs (Bonfire)',
    region: 'CENTRAL-OH',
    jurisdiction: 'Westerville, Dublin, Grove City, Upper Arlington',
    platform: 'Euna / Bonfire Procurement Hub',
    autoScraped: false,
    commodityCode: 'NIGP 910-39 & 910-09',
    url: 'https://westerville.gobonfire.com/portal/?tab=openOpportunities',
    notes: 'Suburban municipal buildings, community rec centers, and police/city hall custodial contracts.'
  },

  // NORTHEAST OHIO (CLEVELAND / CUYAHOGA / AKRON / SUMMIT / CANTON / STARK / LAKE / LORAIN)
  {
    name: 'City of Cleveland — Division of Purchases & Supplies',
    region: 'NORTHEAST-OH',
    jurisdiction: 'City of Cleveland (Hopkins Airport CLE, City Hall, Public Utilities)',
    platform: 'OpenGov Procurement Portal',
    autoScraped: false,
    commodityCode: 'Janitorial, Window & Carpet Cleaning',
    url: 'https://procurement.opengov.com/portal/clevelandoh',
    notes: 'Primary portal for City of Cleveland municipal facilities, recreation centers, and Cleveland Hopkins International Airport.'
  },
  {
    name: 'Cuyahoga County — Office of Procurement & Diversity',
    region: 'NORTHEAST-OH',
    jurisdiction: 'Cuyahoga County (Cleveland Metro)',
    platform: 'Cuyahoga Supplier Portal / INFOR',
    autoScraped: false,
    commodityCode: 'County Facility Custodial & Carpet Care',
    url: 'https://cuyahogacounty.gov/purchasing/open-and-upcoming-bids',
    notes: 'Posts open and upcoming bids for Cuyahoga County administration buildings, health & human services, and juvenile justice centers.'
  },
  {
    name: 'NEORSD — Northeast Ohio Regional Sewer District',
    region: 'NORTHEAST-OH',
    jurisdiction: 'Greater Cleveland / Cuyahoga & Surrounding Counties',
    platform: 'OpenGov Procurement Portal',
    autoScraped: false,
    commodityCode: 'Facility Janitorial, Mat & Mop Rental',
    url: 'https://procurement.opengov.com/portal/neorsd',
    notes: 'Regularly solicits multi-year janitorial services, walk-off mat rental, and floor maintenance for district labs and offices.'
  },
  {
    name: 'Greater Cleveland RTA (Regional Transit Authority)',
    region: 'NORTHEAST-OH',
    jurisdiction: 'Cleveland / Cuyahoga County Transit Stations & Offices',
    platform: 'GCRTA iSupplier Portal',
    autoScraped: false,
    commodityCode: 'NAICS 561720 / Station & Facility Cleaning',
    url: 'https://www.riderta.com/procurement',
    notes: 'Solicits janitorial and floor scrubbing contracts for RTA rail stations, bus districts, and main office buildings.'
  },
  {
    name: 'County of Summit (Akron) — Purchasing Department',
    region: 'NORTHEAST-OH',
    jurisdiction: 'Summit County (Akron Metro)',
    platform: 'Tyler Munis Vendor Self Service (VSS)',
    autoScraped: false,
    commodityCode: 'NIGP 910-39 / County Building Custodial',
    url: 'https://co.summitoh.net/departments/Purchasing.html',
    notes: 'Covers Summit County courthouse, OhioMeansJobs center, and county executive offices in Akron.'
  },
  {
    name: 'City of Akron — Purchasing Division (Bonfire)',
    region: 'NORTHEAST-OH',
    jurisdiction: 'City of Akron Municipal Facilities & Community Centers',
    platform: 'Bonfire Procurement Portal',
    autoScraped: false,
    commodityCode: 'Janitorial & Floor Care Services',
    url: 'https://akronohio.gobonfire.com/portal/?tab=openOpportunities',
    notes: 'Official e-procurement portal for City of Akron public buildings, water/sewer admin offices, and community centers.'
  },
  {
    name: 'Stark County Commissioners Purchasing (Canton)',
    region: 'NORTHEAST-OH',
    jurisdiction: 'Stark County & City of Canton',
    platform: 'Stark County Bid Board',
    autoScraped: false,
    commodityCode: 'Custodial & Carpet Cleaning',
    url: 'https://www.starkcountyohio.gov/government/offices/commissioners/purchasing_department/current_bids___rfps.php',
    notes: 'Lists current invitations to bid and RFPs for Stark County offices, JFS facilities, and county garages.'
  },
  {
    name: 'Lake County & Lorain County Purchasing Portals',
    region: 'NORTHEAST-OH',
    jurisdiction: 'Lake County (Painesville/Mentor) & Lorain County (Elyria/Lorain)',
    platform: 'County Purchasing Portals + BidNet Ohio',
    autoScraped: true,
    commodityCode: 'Facility Cleaning & Floor Care',
    url: 'https://www.lakecountypurchasingportal.com/',
    notes: 'Lake County posts on LakeCountyPurchasingPortal.com; Lorain/Medina community correctional & county agencies also post on BidNet Ohio.'
  },

  // SOUTHWEST OHIO (CINCINNATI / HAMILTON / DAYTON / MONTGOMERY / BUTLER / WARREN)
  {
    name: 'City of Cincinnati — Open Data & Bonfire Portal',
    region: 'SOUTHWEST-OH',
    jurisdiction: 'City of Cincinnati (All Municipal Departments)',
    platform: 'Socrata Open Data API + Bonfire (Auto-Scraped by iBid)',
    autoScraped: true,
    commodityCode: 'Commodity 09 / NIGP 910-39 Janitorial',
    url: 'https://cincinnati-oh.bonfirehub.com/portal/?tab=openOpportunities',
    notes: 'City of Cincinnati publishes RFPs and ITBs with full Volume 1-3 PDF specifications and Excel pricing workbooks.'
  },
  {
    name: 'Hamilton County Purchasing Department',
    region: 'SOUTHWEST-OH',
    jurisdiction: 'Hamilton County (Cincinnati Metro)',
    platform: 'Hamilton County Bid Board / PublicPurchase',
    autoScraped: false,
    commodityCode: 'County Facility Custodial & Carpet Extraction',
    url: 'https://www.hamiltoncountyohio.gov/government/departments/purchasing/current_bids',
    notes: 'Covers Hamilton County Justice Center, Todd Portune Center, JFS, and county coroner/lab facilities.'
  },
  {
    name: 'SORTA / Go Metro (Southwest Ohio Regional Transit)',
    region: 'SOUTHWEST-OH',
    jurisdiction: 'Cincinnati Metro Transit Centers & Maintenance Facilities',
    platform: 'OpenGov Procurement Portal',
    autoScraped: false,
    commodityCode: 'NAICS 561720 & 561740',
    url: 'https://procurement.opengov.com/portal/sorta',
    notes: 'Transit center custodial, administrative carpet cleaning, and bus garage floor maintenance.'
  },
  {
    name: 'Montgomery County (Dayton) — OpenGov Portal',
    region: 'SOUTHWEST-OH',
    jurisdiction: 'Montgomery County (Dayton Metro)',
    platform: 'OpenGov Procurement Portal',
    autoScraped: false,
    commodityCode: 'NIGP 910-39 & 910-09',
    url: 'https://procurement.opengov.com/portal/mcohio',
    notes: 'Official portal for Montgomery County Administration Building, Haines Children\'s Center, and Environmental Services.'
  },
  {
    name: 'City of Dayton — Division of Procurement',
    region: 'SOUTHWEST-OH',
    jurisdiction: 'City of Dayton & Dayton International Airport (DAY)',
    platform: 'OpenGov / Dayton Purchasing',
    autoScraped: false,
    commodityCode: 'Janitorial & Airport Floor Care',
    url: 'https://www.daytonohio.gov/267/Purchasing',
    notes: 'Covers City of Dayton municipal buildings, recreation centers, and Dayton International Airport terminal cleaning.'
  },
  {
    name: 'Butler County & Warren County Commissioners',
    region: 'SOUTHWEST-OH',
    jurisdiction: 'Butler County (Hamilton/West Chester) & Warren County (Mason/Lebanon)',
    platform: 'BidNet Direct Ohio & County Bid Boards',
    autoScraped: true,
    commodityCode: 'Custodial, Carpet & Window Cleaning',
    url: 'https://www.bcohio.gov/departments/board_of_commissioners/bid_opportunities.php',
    notes: 'Fast-growing I-75 corridor counties; many cities (Mason, Fairfield, Middletown) also publish directly on BidNet Ohio.'
  },

  // NORTHWEST & SOUTHEAST OHIO (TOLEDO / LUCAS / ATHENS)
  {
    name: 'City of Toledo & Lucas County — PlanetBids Portal',
    region: 'NORTHWEST-OH',
    jurisdiction: 'City of Toledo, Lucas County & Toledo-Lucas County Port Authority',
    platform: 'PlanetBids VendorLine',
    autoScraped: false,
    commodityCode: 'NIGP 910-39 Janitorial & 910-09 Carpet',
    url: 'https://toledo.oh.gov/business/how-to-do-business-with-the-city',
    notes: 'Primary portal for Northwest Ohio municipal buildings, Government Center, and Toledo Express Airport.'
  },
  {
    name: 'Ohio University & Southeast Ohio Regional Agencies',
    region: 'SOUTHEAST-OH',
    jurisdiction: 'Athens, Chillicothe, Zanesville, Portsmouth & Wayne National Forest',
    platform: 'OhioBuys + SAM.gov + OU BobcatBUY',
    autoScraped: true,
    commodityCode: 'UNSPSC 76110000 / NAICS 561720',
    url: 'https://www.ohio.edu/finance/purchasing/supplier-information',
    notes: 'State facilities (ODOT Districts 5/9/10, DNR State Parks, DRC) post on OhioBuys; Wayne National Forest posts on SAM.gov.'
  }
];

const state = {
  bids: [],
  filteredBids: [],
  selectedBidId: null,
  activeView: 'radar',
  quickFilter: 'ALL',
  filters: {
    search: '',
    region: 'ALL',
    category: 'ALL',
    source: 'ALL'
  },
  portalFilters: {
    search: '',
    region: 'ALL'
  }
};

function getTodayIso() {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

function escapeHtml(str) {
  if (str === null || str === undefined) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function formatMoney(val) {
  if (val === null || val === undefined || val === '' || isNaN(Number(val))) {
    return 'See Official Bid Packet';
  }
  return '$' + Number(val).toLocaleString('en-US', { maximumFractionDigits: 0 });
}

function formatDaysRemaining(dueDateStr) {
  if (!dueDateStr) return '';
  const today = new Date(getTodayIso() + 'T00:00:00');
  const due = new Date(dueDateStr.slice(0, 10) + 'T00:00:00');
  const diffDays = Math.round((due - today) / (1000 * 60 * 60 * 24));
  if (diffDays === 0) return 'CLOSES TODAY';
  if (diffDays === 1) return 'CLOSES TOMORROW';
  if (diffDays > 1 && diffDays <= 60) return `CLOSES IN ${diffDays} DAYS`;
  return `EXPIRES / DUE ${dueDateStr}`;
}

function showToast(msg) {
  const el = document.getElementById('toastBox');
  if (!el) return;
  el.textContent = msg;
  el.classList.add('show');
  clearTimeout(window.__toastTimer);
  window.__toastTimer = setTimeout(() => el.classList.remove('show'), 4000);
}

// Clock
function startClock() {
  const el = document.getElementById('topClock');
  const tick = () => {
    const now = new Date();
    el.textContent = `OHIO LIVE // ${getTodayIso()} ${now.toLocaleTimeString('en-US', { hour12: false })}`;
  };
  tick();
  setInterval(tick, 1000);
}

// Fetch Live Bids
async function loadBids() {
  const res = await fetch('/api/bids');
  const data = await res.json();
  const today = getTodayIso();

  // Strictly enforce dueDate >= today on the client as well
  state.bids = (data.bids || []).filter(b => b.dueDate && b.dueDate >= today);
  applyFilters();
  renderKanban();
}

function applyFilters() {
  const today = getTodayIso();
  const q = state.filters.search.trim().toLowerCase();

  state.filteredBids = state.bids.filter(b => {
    // 1. Strict Future-Closing Gate
    if (!b.dueDate || b.dueDate < today) return false;

    // 2. Quick Filter Pills
    if (state.quickFilter === 'OPEN_ONLY' && b.source === 'USASPENDING-OH') return false;
    if (state.quickFilter === 'OHIO_ONLY' && b.state !== 'OH') return false;
    if (state.quickFilter === 'BIDNET_OHIOBUYS' && b.source !== 'BIDNET-OH' && b.source !== 'OHIOBUYS') return false;
    if (state.quickFilter === 'CARPET_ONLY' && b.category !== 'CARPET' && b.category !== 'COMBO') return false;

    // 3. Dropdown Filters
    if (state.filters.region === 'OHIO-ALL' && b.state !== 'OH') return false;
    if (
      state.filters.region !== 'ALL' &&
      state.filters.region !== 'OHIO-ALL' &&
      b.ohioRegion !== state.filters.region
    ) {
      return false;
    }

    if (state.filters.category !== 'ALL' && b.category !== state.filters.category) return false;
    if (state.filters.source !== 'ALL' && b.source !== state.filters.source) return false;

    // 4. Text Search
    if (q) {
      const hay = [
        b.title,
        b.agency,
        b.city,
        b.ohioRegion,
        b.solicitationNumber,
        b.source,
        b.naics,
        b.setAside,
        b.scopeSummary
      ]
        .join(' ')
        .toLowerCase();
      if (!hay.includes(q)) return false;
    }

    return true;
  });

  if (!state.selectedBidId || !state.filteredBids.some(b => b.id === state.selectedBidId)) {
    state.selectedBidId = state.filteredBids[0]?.id || null;
  }

  updateKpis();
  renderBidFeed();
  renderDossier();
}

function updateKpis() {
  const list = state.filteredBids;
  const openSolCount = list.filter(b => b.source !== 'USASPENDING-OH').length;
  const ohioCount = list.filter(b => b.state === 'OH').length;
  const carpetCount = list.filter(b => b.category === 'CARPET' || b.category === 'COMBO').length;

  document.getElementById('kpiTotalCount').textContent = list.length;
  document.getElementById('kpiOpenSolCount').textContent = openSolCount;
  document.getElementById('kpiOhioCount').textContent = ohioCount;
  document.getElementById('kpiCarpetCount').textContent = carpetCount;

  document.getElementById('navCountBids').textContent = list.length;
  document.getElementById('navCountPortals').textContent = OHIO_PORTAL_DIRECTORY.length;
  document.getElementById('navCountPipeline').textContent = state.bids.filter(
    b => b.stage && b.stage !== 'DISCOVERED'
  ).length;
}

function renderBidFeed() {
  const container = document.getElementById('bidFeedList');
  if (state.filteredBids.length === 0) {
    container.innerHTML = `
      <div class="bid-card" style="cursor: default; text-align: center; padding: 32px 16px;">
        <div class="bid-card-title">No Open Contracts Match Your Current Filter</div>
        <p style="color: var(--text-muted); font-size: 13px; margin-top: 6px;">
          Click "Reset" to clear filters or click "SYNC LIVE PORTALS" to pull the latest open solicitations.
        </p>
      </div>
    `;
    return;
  }

  container.innerHTML = state.filteredBids
    .map(b => {
      const selected = b.id === state.selectedBidId ? 'selected' : '';
      const isCarpet = b.category === 'CARPET' || b.category === 'COMBO';
      const isRecompete = b.source === 'USASPENDING-OH';
      const dueLabel = formatDaysRemaining(b.dueDate);

      return `
        <article class="bid-card ${selected}" data-id="${escapeHtml(b.id)}">
          <div class="bid-card-header">
            <div class="badge-row">
              <span class="badge badge-source">${escapeHtml(b.source)}</span>
              <span class="badge">${escapeHtml(b.state === 'OH' ? b.ohioRegion : b.state)}</span>
              <span class="badge ${isCarpet ? 'badge-carpet' : ''}">
                ${escapeHtml(b.category)} (${escapeHtml(b.naics)})
              </span>
              ${
                !isRecompete
                  ? `<span class="badge" style="color: var(--accent); border-color: var(--accent);">OPEN SOLICITATION</span>`
                  : `<span class="badge">ACTIVE CONTRACT RECOMPETE</span>`
              }
            </div>
            <span class="badge badge-due">${escapeHtml(dueLabel)} (${escapeHtml(b.dueDate)})</span>
          </div>

          <div class="bid-card-title">${escapeHtml(b.title)}</div>

          <div class="bid-card-footer">
            <span><strong>${escapeHtml(b.agency)}</strong> &bull; ${escapeHtml(b.city || 'Ohio')}</span>
            <span style="font-family: var(--font-mono); font-size: 11.5px;">
              #${escapeHtml(b.solicitationNumber)}
            </span>
          </div>
        </article>
      `;
    })
    .join('');

  container.querySelectorAll('.bid-card[data-id]').forEach(card => {
    card.addEventListener('click', () => {
      state.selectedBidId = card.getAttribute('data-id');
      renderBidFeed();
      renderDossier();
    });
  });
}

function renderDossier() {
  const panel = document.getElementById('bidDossier');
  const b = state.filteredBids.find(x => x.id === state.selectedBidId);

  if (!b) {
    panel.innerHTML = `
      <div style="color: var(--text-muted); font-family: var(--font-mono);">
        Select any solicitation on the left to inspect full details and official portal links.
      </div>
    `;
    return;
  }

  const stages = ['DISCOVERED', 'WATCHING', 'WALKTHROUGH', 'PRICING', 'SUBMITTED'];

  panel.innerHTML = `
    <div style="display: flex; justify-content: space-between; align-items: center; gap: 8px; flex-wrap: wrap;">
      <div class="badge-row">
        <span class="badge badge-source">${escapeHtml(b.source)}</span>
        <span class="badge">#${escapeHtml(b.solicitationNumber)}</span>
      </div>
      <span class="badge badge-due">DUE / CLOSES: ${escapeHtml(b.dueDate)}</span>
    </div>

    <div class="dossier-header-title">${escapeHtml(b.title)}</div>
    <div style="font-size: 13px; color: var(--text-muted); margin-top: -8px;">
      ${escapeHtml(b.agency)} &mdash; ${escapeHtml(b.city)}, ${escapeHtml(b.state)}
    </div>

    <div style="display: flex; gap: 8px; flex-wrap: wrap;">
      <a class="btn btn-primary" href="${escapeHtml(b.sourceUrl)}" target="_blank" rel="noopener noreferrer" style="flex: 1; justify-content: center;">
        OPEN OFFICIAL PORTAL / BID PACKET &#8599;
      </a>
      <button class="btn btn-outline-accent" id="btnSendToEstimator">
        PRICE IN ISSA-612 ESTIMATOR
      </button>
    </div>

    <div class="meta-grid">
      <div class="meta-item">
        <span class="label">Closing / Expiration Date</span>
        <span class="value" style="color: var(--accent-amber);">${escapeHtml(b.dueDate)} (${escapeHtml(formatDaysRemaining(b.dueDate))})</span>
      </div>
      <div class="meta-item">
        <span class="label">Published / Start Date</span>
        <span class="value">${escapeHtml(b.postedDate || 'Live')}</span>
      </div>
      <div class="meta-item">
        <span class="label">NAICS / Commodity</span>
        <span class="value">${escapeHtml(b.naics)} (${escapeHtml(b.category)})</span>
      </div>
      <div class="meta-item">
        <span class="label">Set-Aside / Status</span>
        <span class="value">${escapeHtml(b.setAside || 'Open Solicitation')}</span>
      </div>
      <div class="meta-item">
        <span class="label">Cleanable Area</span>
        <span class="value">${b.totalSqFt ? Number(b.totalSqFt).toLocaleString() + ' Sq. Ft.' : 'In Attached PDF Packet'}</span>
      </div>
      <div class="meta-item">
        <span class="label">Award / Est. Value</span>
        <span class="value" style="color: var(--accent);">${formatMoney(b.estimatedValue)}</span>
      </div>
    </div>

    <div class="dossier-section">
      <div style="font-family: var(--font-mono); font-size: 11px; color: var(--accent); text-transform: uppercase; margin-bottom: 4px;">
        Verified Solicitation Summary
      </div>
      <div>${escapeHtml(b.scopeSummary)}</div>

      ${
        Array.isArray(b.lineItems) && b.lineItems.length
          ? `<ul class="detail-list">
              ${b.lineItems.map(li => `<li>${escapeHtml(li)}</li>`).join('')}
            </ul>`
          : ''
      }
    </div>

    <div class="dossier-section">
      <div style="font-family: var(--font-mono); font-size: 11px; color: var(--text-muted); text-transform: uppercase; margin-bottom: 6px;">
        Buyer / Contracting Officer Contact
      </div>
      <div style="font-size: 12.5px;">
        <strong>${escapeHtml(b.contactName || 'See Portal Notice')}</strong><br />
        Email: ${escapeHtml(b.contactEmail || 'See Portal Notice')} &bull; Phone: ${escapeHtml(b.contactPhone || 'See Portal Notice')}
      </div>
    </div>

    <div style="display: flex; align-items: center; justify-content: space-between; gap: 10px; padding-top: 4px;">
      <span style="font-family: var(--font-mono); font-size: 11.5px; color: var(--text-muted);">PIPELINE STAGE:</span>
      <select class="select" id="dossierStageSelect" style="width: auto; font-family: var(--font-mono); font-size: 12px;">
        ${stages
          .map(
            s => `<option value="${s}" ${(b.stage || 'DISCOVERED') === s ? 'selected' : ''}>${s}</option>`
          )
          .join('')}
      </select>
    </div>
  `;

  document.getElementById('btnSendToEstimator')?.addEventListener('click', () => {
    document.getElementById('calcTitle').value = `${b.solicitationNumber} — ${b.title}`;
    if (b.totalSqFt && Number(b.totalSqFt) > 0) {
      const sq = Number(b.totalSqFt);
      document.getElementById('calcTotalSqFt').value = sq;
      document.getElementById('calcCarpetSqFt').value = Math.round(sq * 0.6);
      document.getElementById('calcHardSqFt').value = Math.round(sq * 0.3);
      document.getElementById('calcRestroomSqFt').value = Math.round(sq * 0.1);
    }
    switchView('calculator');
    runEstimator();
    showToast(`Loaded #${b.solicitationNumber} into ISSA-612 Estimator`);
  });

  document.getElementById('dossierStageSelect')?.addEventListener('change', async e => {
    const newStage = e.target.value;
    b.stage = newStage;
    await fetch(`/api/bids/${encodeURIComponent(b.id)}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ stage: newStage })
    });
    updateKpis();
    renderKanban();
    showToast(`Moved #${b.solicitationNumber} to ${newStage}`);
  });
}

// Render Ohio City & County Portal Directory
function renderPortalDirectory() {
  const grid = document.getElementById('portalDirectoryGrid');
  if (!grid) return;

  const q = state.portalFilters.search.trim().toLowerCase();
  const reg = state.portalFilters.region;

  const list = OHIO_PORTAL_DIRECTORY.filter(p => {
    if (reg !== 'ALL' && p.region !== reg) return false;
    if (q) {
      const hay = `${p.name} ${p.jurisdiction} ${p.platform} ${p.commodityCode} ${p.notes}`.toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  });

  grid.innerHTML = list
    .map(
      p => `
      <div class="portal-card">
        <div style="display: flex; justify-content: space-between; align-items: center; gap: 6px; flex-wrap: wrap;">
          <span class="badge badge-source">${escapeHtml(p.region)}</span>
          ${
            p.autoScraped
              ? `<span class="badge" style="color: var(--accent); border-color: var(--accent);">LIVE AUTO-SCRAPED</span>`
              : `<span class="badge">DIRECT PORTAL LAUNCH</span>`
          }
        </div>

        <div style="font-size: 15px; font-weight: 700; color: var(--text-main);">
          ${escapeHtml(p.name)}
        </div>

        <div style="font-size: 12.5px; color: var(--text-muted);">
          <strong>Jurisdiction:</strong> ${escapeHtml(p.jurisdiction)}<br />
          <strong>Software Engine:</strong> ${escapeHtml(p.platform)}<br />
          <strong>Target Codes:</strong> <span style="font-family: var(--font-mono); color: var(--accent-cyan);">${escapeHtml(p.commodityCode)}</span>
        </div>

        <p style="font-size: 12.5px; color: var(--text-dim); flex: 1;">
          ${escapeHtml(p.notes)}
        </p>

        <div style="display: flex; gap: 8px; margin-top: 4px;">
          <a href="${escapeHtml(p.url)}" target="_blank" rel="noopener noreferrer" class="btn btn-primary" style="flex: 1; justify-content: center;">
            OPEN PORTAL BIDS &#8599;
          </a>
        </div>
      </div>
    `
    )
    .join('');
}

// Render Kanban CRM
function renderKanban() {
  const board = document.getElementById('kanbanBoard');
  if (!board) return;

  const stages = [
    { key: 'DISCOVERED', label: '1. Discovered' },
    { key: 'WATCHING', label: '2. Watching / Pulling PDF' },
    { key: 'WALKTHROUGH', label: '3. Site Walkthrough' },
    { key: 'PRICING', label: '4. ISSA-612 Pricing' },
    { key: 'SUBMITTED', label: '5. Bid Submitted' }
  ];

  board.innerHTML = stages
    .map(st => {
      const items = state.bids.filter(b => (b.stage || 'DISCOVERED') === st.key);
      return `
        <div class="kanban-column">
          <div class="kanban-column-title">
            <span>${escapeHtml(st.label)}</span>
            <span class="badge">${items.length}</span>
          </div>
          <div style="display: flex; flex-direction: column; gap: 8px;">
            ${
              items.length === 0
                ? `<div style="font-size: 12px; color: var(--text-dim); padding: 12px 4px;">No bids in this stage.</div>`
                : items
                    .slice(0, 25)
                    .map(
                      b => `
                      <div class="bid-card" data-kbid="${escapeHtml(b.id)}" style="padding: 10px 12px;">
                        <div style="display: flex; justify-content: space-between; font-size: 11px; font-family: var(--font-mono);">
                          <span style="color: var(--accent);">${escapeHtml(b.source)}</span>
                          <span style="color: var(--accent-amber);">Due ${escapeHtml(b.dueDate)}</span>
                        </div>
                        <div style="font-size: 13px; font-weight: 600;">${escapeHtml(b.title)}</div>
                        <div style="font-size: 11.5px; color: var(--text-muted);">${escapeHtml(b.agency)}</div>
                      </div>
                    `
                    )
                    .join('')
            }
          </div>
        </div>
      `;
    })
    .join('');

  board.querySelectorAll('[data-kbid]').forEach(el => {
    el.addEventListener('click', () => {
      state.selectedBidId = el.getAttribute('data-kbid');
      switchView('radar');
      renderBidFeed();
      renderDossier();
    });
  });
}

// ISSA-612 Estimator
function runEstimator() {
  const title = document.getElementById('calcTitle').value || 'Ohio Custodial & Carpet Bid';
  const totalSqFt = Math.max(0, Number(document.getElementById('calcTotalSqFt').value) || 0);
  const carpetSqFt = Math.max(0, Number(document.getElementById('calcCarpetSqFt').value) || 0);
  const hardSqFt = Math.max(0, Number(document.getElementById('calcHardSqFt').value) || 0);
  const restroomSqFt = Math.max(0, Number(document.getElementById('calcRestroomSqFt').value) || 0);

  const daysPerMonth = Number(document.getElementById('calcDaysPerMonth').value) || 21.67;
  const extractionFactor = Number(document.getElementById('calcExtractionMethod').value) || 1.0;
  const hourlyWage = Number(document.getElementById('calcHourlyWage').value) || 18.5;
  const burdenPct = Number(document.getElementById('calcBurdenPct').value) || 22;
  const marginPct = Number(document.getElementById('calcMarginPct').value) || 24;
  const extractionsPerYear = Number(document.getElementById('calcExtractionsPerYear').value) || 2;
  const chemRatePer1k = Number(document.getElementById('calcChemRate').value) || 18;

  // ISSA-612 Production Rates (SqFt per Hour)
  const hrsCarpetVacuumPerVisit = carpetSqFt / 3800;
  const hrsHardFloorPerVisit = hardSqFt / 2600;
  const hrsRestroomPerVisit = restroomSqFt / 1100;

  const routineHoursPerVisit = hrsCarpetVacuumPerVisit + hrsHardFloorPerVisit + hrsRestroomPerVisit;
  const monthlyRoutineHours = routineHoursPerVisit * daysPerMonth;

  // Deep carpet extraction hours amortized monthly
  const baseExtractionSqFtPerHr = 1200 / extractionFactor;
  const annualExtractionHours = (carpetSqFt / baseExtractionSqFtPerHr) * extractionsPerYear;
  const monthlyExtractionHours = annualExtractionHours / 12;

  const totalMonthlyLaborHours = monthlyRoutineHours + monthlyExtractionHours;
  const loadedHourlyRate = hourlyWage * (1 + burdenPct / 100);
  const monthlyLaborCost = totalMonthlyLaborHours * loadedHourlyRate;
  const monthlySuppliesCost = (totalSqFt / 1000) * chemRatePer1k;

  const totalDirectMonthlyCost = monthlyLaborCost + monthlySuppliesCost;
  const monthlyBidPrice = totalDirectMonthlyCost / Math.max(0.25, 1 - marginPct / 100);
  const annualBidPrice = daysPerMonth === 1 ? monthlyBidPrice : monthlyBidPrice * 12;
  const pricePerSqFtMonth = totalSqFt > 0 ? monthlyBidPrice / totalSqFt : 0;

  document.getElementById('proposalOutput').innerHTML = `
    <div style="font-size: 14px; font-weight: 700; color: var(--accent);">
      ISSA-612 BID PRICING WORKSHEET
    </div>
    <div style="font-size: 12px; color: var(--text-muted); margin-bottom: 6px;">
      ${escapeHtml(title)}
    </div>

    <div class="proposal-row">
      <span>Total Cleanable Area</span>
      <strong>${totalSqFt.toLocaleString()} Sq. Ft.</strong>
    </div>
    <div class="proposal-row">
      <span>Routine Hours / Cleaning Visit</span>
      <strong>${routineHoursPerVisit.toFixed(1)} hrs/visit</strong>
    </div>
    <div class="proposal-row">
      <span>Monthly Routine + Carpet Extraction Hours</span>
      <strong>${totalMonthlyLaborHours.toFixed(1)} hrs/mo</strong>
    </div>
    <div class="proposal-row">
      <span>Loaded Ohio Hourly Wage ($${hourlyWage.toFixed(2)} + ${burdenPct}% burden)</span>
      <strong>$${loadedHourlyRate.toFixed(2)}/hr</strong>
    </div>
    <div class="proposal-row">
      <span>Monthly Burdened Labor Cost</span>
      <strong>$${Math.round(monthlyLaborCost).toLocaleString()}</strong>
    </div>
    <div class="proposal-row">
      <span>Monthly Chemicals, Liners &amp; Consumables</span>
      <strong>$${Math.round(monthlySuppliesCost).toLocaleString()}</strong>
    </div>
    <div class="proposal-row">
      <span>Effective Rate per Sq. Ft.</span>
      <strong>$${pricePerSqFtMonth.toFixed(3)} / SF / mo</strong>
    </div>

    <div class="proposal-total-box">
      <div>
        <div style="font-size: 11px; color: var(--text-muted);">RECOMMENDED MONTHLY BID</div>
        <div style="font-size: 22px; font-weight: 700; color: var(--accent);">
          $${Math.round(monthlyBidPrice).toLocaleString()} / mo
        </div>
      </div>
      <div style="text-align: right;">
        <div style="font-size: 11px; color: var(--text-muted);">ANNUAL CONTRACT TOTAL</div>
        <div style="font-size: 18px; font-weight: 700; color: var(--text-main);">
          $${Math.round(annualBidPrice).toLocaleString()} / yr
        </div>
      </div>
    </div>
  `;
}

function switchView(viewName) {
  state.activeView = viewName;
  document.querySelectorAll('.nav-tab').forEach(btn => {
    btn.classList.toggle('active', btn.getAttribute('data-view') === viewName);
  });
  document.querySelectorAll('.view-pane').forEach(pane => {
    pane.classList.toggle('active', pane.id === `view-${viewName}`);
  });
}

function exportCsv() {
  const headers = [
    'Solicitation_Number',
    'Source',
    'Closing_Date',
    'State',
    'Ohio_Region',
    'City',
    'Category',
    'NAICS',
    'Agency',
    'Title',
    'Source_URL'
  ];
  const rows = state.filteredBids.map(b =>
    [
      b.solicitationNumber,
      b.source,
      b.dueDate,
      b.state,
      b.ohioRegion,
      b.city,
      b.category,
      b.naics,
      b.agency,
      b.title,
      b.sourceUrl
    ]
      .map(v => `"${String(v || '').replace(/"/g, '""')}"`)
      .join(',')
  );

  const csv = [headers.join(','), ...rows].join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `iBid_Ohio_Open_Contracts_${getTodayIso()}.csv`;
  a.click();
  showToast(`Exported ${state.filteredBids.length} open contracts to CSV`);
}

// Bind UI Events
document.addEventListener('DOMContentLoaded', () => {
  startClock();
  loadBids();
  renderPortalDirectory();
  runEstimator();

  // Navigation Tabs
  document.querySelectorAll('.nav-tab').forEach(btn => {
    btn.addEventListener('click', () => switchView(btn.getAttribute('data-view')));
  });

  // Theme Selector
  document.getElementById('themeSelect')?.addEventListener('change', e => {
    document.body.className = e.target.value;
  });

  // Quick Filter Pills
  document.querySelectorAll('#quickFilterPills .filter-pill').forEach(pill => {
    pill.addEventListener('click', () => {
      document.querySelectorAll('#quickFilterPills .filter-pill').forEach(p => p.classList.remove('active'));
      pill.classList.add('active');
      state.quickFilter = pill.getAttribute('data-quick');
      applyFilters();
    });
  });

  // Search & Dropdown Filters
  document.getElementById('searchInput')?.addEventListener('input', e => {
    state.filters.search = e.target.value;
    applyFilters();
  });
  document.getElementById('regionSelect')?.addEventListener('change', e => {
    state.filters.region = e.target.value;
    applyFilters();
  });
  document.getElementById('categorySelect')?.addEventListener('change', e => {
    state.filters.category = e.target.value;
    applyFilters();
  });
  document.getElementById('sourceSelect')?.addEventListener('change', e => {
    state.filters.source = e.target.value;
    applyFilters();
  });

  document.getElementById('btnResetFilters')?.addEventListener('click', () => {
    state.quickFilter = 'ALL';
    state.filters = { search: '', region: 'ALL', category: 'ALL', source: 'ALL' };
    document.getElementById('searchInput').value = '';
    document.getElementById('regionSelect').value = 'ALL';
    document.getElementById('categorySelect').value = 'ALL';
    document.getElementById('sourceSelect').value = 'ALL';
    document.querySelectorAll('#quickFilterPills .filter-pill').forEach((p, idx) => {
      p.classList.toggle('active', idx === 0);
    });
    applyFilters();
  });

  // Portal Directory Filters
  document.getElementById('portalSearchInput')?.addEventListener('input', e => {
    state.portalFilters.search = e.target.value;
    renderPortalDirectory();
  });
  document.getElementById('portalRegionSelect')?.addEventListener('change', e => {
    state.portalFilters.region = e.target.value;
    renderPortalDirectory();
  });

  // Live Multi-Portal Sync Button
  document.getElementById('btnLiveSync')?.addEventListener('click', async e => {
    const btn = e.currentTarget;
    const orig = btn.innerHTML;
    btn.disabled = true;
    btn.textContent = 'SCRAPING LIVE PORTALS...';
    showToast('Scraping BidNet Ohio, OhioBuys, SAM.gov & USASpending (Future Closing Only)...');
    try {
      const res = await fetch('/api/sync/live', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ includeHeadless: true })
      });
      const data = await res.json();
      await loadBids();
      showToast(`Live Sync Complete: ${data.totalBids} verified open/future contracts active`);
    } catch (err) {
      showToast(`Sync error: ${err.message}`);
    } finally {
      btn.disabled = false;
      btn.innerHTML = orig;
    }
  });

  // CSV Export
  document.getElementById('btnExportCsv')?.addEventListener('click', exportCsv);

  // Import / Scrape Modal
  const modal = document.getElementById('scraperModal');
  document.getElementById('btnOpenScraper')?.addEventListener('click', () => modal.classList.add('open'));
  document.getElementById('btnCloseScraper')?.addEventListener('click', () => modal.classList.remove('open'));
  document.getElementById('btnRunScrape')?.addEventListener('click', async () => {
    const url = document.getElementById('scrapeUrlInput').value.trim();
    const titleOverride = document.getElementById('scrapeTitleInput').value.trim();
    const rawText = document.getElementById('scrapeRawInput').value.trim();
    if (!url && !rawText) {
      showToast('Provide a URL or paste solicitation text first');
      return;
    }
    const res = await fetch('/api/scrape', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url, titleOverride, rawText })
    });
    const data = await res.json();
    if (data.ok) {
      modal.classList.remove('open');
      await loadBids();
      showToast(`Imported solicitation #${data.bid.solicitationNumber}`);
    }
  });

  // Estimator Inputs
  [
    'calcTitle',
    'calcTotalSqFt',
    'calcCarpetSqFt',
    'calcHardSqFt',
    'calcRestroomSqFt',
    'calcDaysPerMonth',
    'calcExtractionMethod',
    'calcHourlyWage',
    'calcBurdenPct',
    'calcMarginPct',
    'calcExtractionsPerYear',
    'calcChemRate'
  ].forEach(id => {
    document.getElementById(id)?.addEventListener('input', runEstimator);
    document.getElementById(id)?.addEventListener('change', runEstimator);
  });
});
