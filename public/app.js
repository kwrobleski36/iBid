/* ============================================================================
   iBid // BUCKEYE TERMINAL v1.98 — FRONTEND ENGINE
   Ohio Janitorial (NAICS 561720) & Carpet Cleaning (NAICS 561740) Aggregator
   ============================================================================ */

const FALLBACK_OHIO_BIDS = [
  {
    id: 'OHBUY-DAS-2026-561720-01',
    solicitationNumber: 'SRC0000024819',
    title: 'ODOT District 6 & Franklin County State Facilities Custodial & Semi-Annual Carpet Extraction',
    agency: 'Ohio Dept. of Administrative Services (OhioBuys / ODOT)',
    source: 'OHIOBUYS',
    category: 'COMBO',
    naics: '561720',
    psc: '76110000',
    setAside: 'Ohio EDGE / MBE',
    state: 'OH',
    ohioRegion: 'CENTRAL-OH',
    city: 'Columbus / Delaware',
    county: 'Franklin & Delaware',
    facilityType: 'State Agency HQ & District Outposts',
    totalSqFt: 94500,
    carpetSqFt: 38000,
    hardFloorSqFt: 45500,
    restroomSqFt: 11000,
    frequency: '5x/Week Nightly + Semi-Annual Carpet Extraction',
    extractionMethod: 'Truckmount / Portable Hot-Water + Low-Moisture CRB',
    estimatedValue: 268000,
    incumbent: 'Buckeye Crown Facility Services LLC',
    priorAwardValue: 249500,
    walkthroughDate: '2026-10-29T10:00:00',
    walkthroughMandatory: true,
    postedDate: '2026-10-18',
    dueDate: '2026-11-12',
    stage: 'WATCHING',
    matchScore: 98,
    wageRate: 18.25,
    scopeSummary: 'State of Ohio DAS (OhioBuys) 2-year contract with renewal options. Covers nightly custodial maintenance for ODOT District 6 Complex and two Franklin County administrative annexes (94,500 SF). Requires semi-annual deep hot-water carpet extraction (38,000 SF), monthly high-traffic encapsulation, and VCT strip & 4-coat finish.',
    lineItems: [
      'UNSPSC 76111501: Nightly Office & Restroom Custodial Services (94,500 SF) — 12 Mos',
      'UNSPSC 76111502: Semi-Annual Hot-Water Carpet Extraction & Stain Treatment (38,000 SF x 2)',
      'UNSPSC 76111504: Semi-Annual VCT Strip, Seal & High-Speed Burnish (45,500 SF x 2)'
    ],
    contactName: 'Brian K. Miller, DAS State Procurement Analyst',
    contactEmail: 'brian.miller@das.ohio.gov',
    contactPhone: '(614) 555-0148',
    sourceUrl: 'https://ohiobuys.ohio.gov/page.aspx/en/rfp/request_browse_public'
  }
];

const state = {
  bids: [],
  aggregators: [],
  selectedBidId: null,
  sfxEnabled: true,
  scanlinesEnabled: true,
  theme: localStorage.getItem('ibid_theme') || 'theme-phosphor',
  samApiKey: localStorage.getItem('ibid_sam_key') || '',
  fbProjectId: localStorage.getItem('ibid_fb_project') || '',
  fbApiKey: localStorage.getItem('ibid_fb_apikey') || ''
};

// Web Audio Synthesizer for Retro Terminal Tactile Feedback
let audioCtx = null;
function playBeep(freq = 660, duration = 0.035, type = 'square') {
  if (!state.sfxEnabled) return;
  try {
    if (!audioCtx) {
      const AudioContextClass = window.AudioContext || window.webkitAudioContext;
      audioCtx = new AudioContextClass();
    }
    if (audioCtx.state === 'suspended') audioCtx.resume();
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, audioCtx.currentTime);
    gain.gain.setValueAtTime(0.035, audioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + duration);
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    osc.start();
    osc.stop(audioCtx.currentTime + duration);
  } catch (_) {
    // Ignore audio errors if browser blocks autoplay
  }
}

function showToast(msg) {
  const el = document.getElementById('retroToast');
  if (!el) return;
  el.textContent = msg;
  el.classList.add('show');
  clearTimeout(showToast._timer);
  showToast._timer = setTimeout(() => el.classList.remove('show'), 4200);
}

function formatMoney(num) {
  const n = Number(num) || 0;
  return '$' + Math.round(n).toLocaleString('en-US');
}

function formatNum(num) {
  const n = Number(num) || 0;
  return Math.round(n).toLocaleString('en-US');
}

// Optional Firebase Firestore REST Mirror
async function syncBidToFirebase(bid) {
  if (!state.fbProjectId || !state.fbApiKey || !bid || !bid.id) return;
  try {
    const url = `https://firestore.googleapis.com/v1/projects/${encodeURIComponent(state.fbProjectId)}/databases/(default)/documents/ibid_bids/${encodeURIComponent(bid.id)}?key=${encodeURIComponent(state.fbApiKey)}`;
    const fields = {
      id: { stringValue: String(bid.id) },
      solicitationNumber: { stringValue: String(bid.solicitationNumber || '') },
      title: { stringValue: String(bid.title || '') },
      agency: { stringValue: String(bid.agency || '') },
      source: { stringValue: String(bid.source || '') },
      category: { stringValue: String(bid.category || 'JANITORIAL') },
      naics: { stringValue: String(bid.naics || '561720') },
      ohioRegion: { stringValue: String(bid.ohioRegion || 'CENTRAL-OH') },
      city: { stringValue: String(bid.city || 'Columbus') },
      setAside: { stringValue: String(bid.setAside || '') },
      totalSqFt: { integerValue: String(Math.round(bid.totalSqFt || 0)) },
      carpetSqFt: { integerValue: String(Math.round(bid.carpetSqFt || 0)) },
      estimatedValue: { integerValue: String(Math.round(bid.estimatedValue || 0)) },
      stage: { stringValue: String(bid.stage || 'DISCOVERED') },
      dueDate: { stringValue: String(bid.dueDate || '') },
      updatedAt: { stringValue: new Date().toISOString() }
    };
    await fetch(url, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ fields })
    });
  } catch (e) {
    console.warn('Firebase mirror warning:', e.message);
  }
}

// Load initial bids & aggregator directory
async function initApp() {
  applyTheme(state.theme);
  updateCloudStatusUI();
  startClock();

  // Load bids from local server or localStorage fallback
  try {
    const res = await fetch('/api/bids');
    if (res.ok) {
      const data = await res.json();
      state.bids = Array.isArray(data.bids) && data.bids.length ? data.bids : FALLBACK_OHIO_BIDS;
      localStorage.setItem('ibid_ohio_bids_cache', JSON.stringify(state.bids));
    } else {
      throw new Error('Static fallback');
    }
  } catch (_) {
    const cached = localStorage.getItem('ibid_ohio_bids_cache');
    state.bids = cached ? JSON.parse(cached) : FALLBACK_OHIO_BIDS;
  }

  // Load aggregator intelligence matrix
  try {
    const aggRes = await fetch('/api/aggregators');
    if (aggRes.ok) {
      const aggData = await aggRes.json();
      state.aggregators = aggData.aggregators || [];
    }
  } catch (_) {
    state.aggregators = [];
  }

  if (state.bids.length > 0) {
    state.selectedBidId = state.bids[0].id;
  }

  bindEvents();
  renderAll();
  runCalculator();
}

function startClock() {
  const clockEl = document.getElementById('terminalClock');
  const tick = () => {
    const now = new Date();
    const timeStr = now.toLocaleTimeString('en-US', { hour12: false });
    if (clockEl) {
      clockEl.textContent = `OHIO TERMINAL CLOCK: ${timeStr} EST // BUCKEYE-NODE ACTIVE`;
    }
  };
  tick();
  setInterval(tick, 1000);
}

function applyTheme(themeName) {
  document.body.classList.remove('theme-phosphor', 'theme-amber', 'theme-win95');
  document.body.classList.add(themeName);
  state.theme = themeName;
  localStorage.setItem('ibid_theme', themeName);
  const sel = document.getElementById('themeSelector');
  if (sel) sel.value = themeName;
}

function updateCloudStatusUI() {
  const led = document.getElementById('firebaseLed');
  const txt = document.getElementById('statusStorageMode');
  if (state.fbProjectId && state.fbApiKey) {
    if (led) led.classList.remove('amber');
    if (txt) txt.textContent = `FIREBASE (${state.fbProjectId}) + LOCAL`;
  } else {
    if (led) led.classList.add('amber');
    if (txt) txt.textContent = 'LOCAL DISK + BROWSER';
  }
}

// Filtering logic
function getFilteredBids() {
  const q = (document.getElementById('searchInput')?.value || '').trim().toLowerCase();
  const region = document.getElementById('regionFilter')?.value || 'ALL';
  const cat = document.getElementById('categoryFilter')?.value || 'ALL';
  const setAside = document.getElementById('setAsideFilter')?.value || 'ALL';
  const source = document.getElementById('sourceFilter')?.value || 'ALL';

  return state.bids.filter(b => {
    if (q) {
      const hay = `${b.solicitationNumber} ${b.title} ${b.agency} ${b.city} ${b.county || ''} ${b.naics} ${b.setAside} ${b.scopeSummary} ${b.incumbent}`.toLowerCase();
      if (!hay.includes(q)) return false;
    }
    if (region !== 'ALL' && b.ohioRegion !== region) return false;
    if (cat !== 'ALL' && b.category !== cat) return false;
    if (setAside !== 'ALL') {
      const sa = (b.setAside || '').toUpperCase();
      if (setAside === 'EDGE' && !/EDGE|MBE/.test(sa)) return false;
      if (setAside === 'SDVOSB' && !/SDVOSB|VETERAN/.test(sa)) return false;
      if (setAside === 'SMALL' && !/SMALL|8\(A\)|HUBZONE/.test(sa)) return false;
      if (setAside === 'WOSB' && !/WOSB|WBE|WOMEN/.test(sa)) return false;
      if (setAside === 'SLED' && !/SLED|OPEN BID/.test(sa)) return false;
      if (setAside === 'COMMERCIAL' && !/COMMERCIAL/.test(sa)) return false;
    }
    if (source !== 'ALL' && b.source !== source) return false;
    return true;
  });
}

function renderAll() {
  const filtered = getFilteredBids();
  const navCount = document.getElementById('navCountBids');
  if (navCount) navCount.textContent = filtered.length;

  renderKpis(filtered);
  renderBidList(filtered);
  renderDossier();
  renderKanban();
  renderAggregatorIntel();
}

function renderKpis(filtered) {
  const totalVal = filtered.reduce((acc, b) => acc + (Number(b.estimatedValue) || 0), 0);
  const carpetSf = filtered.reduce((acc, b) => acc + (Number(b.carpetSqFt) || 0), 0);
  const totalSf = filtered.reduce((acc, b) => acc + (Number(b.totalSqFt) || 0), 0);
  const setAsideCount = filtered.filter(b => /EDGE|MBE|SDVOSB|Small Business|WOSB|8\(a\)/i.test(b.setAside || '')).length;
  const walkthroughCount = filtered.filter(b => b.walkthroughMandatory).length;

  document.getElementById('kpiTotalValue').textContent = formatMoney(totalVal);
  document.getElementById('kpiTotalCount').textContent = `${filtered.length} Ohio Contracts & Recompetes`;
  document.getElementById('kpiCarpetSqFt').textContent = `${formatNum(carpetSf)} SF`;
  document.getElementById('kpiTotalSqFt').textContent = `${formatNum(totalSf)} SF`;
  document.getElementById('kpiSetAsideCount').textContent = `${setAsideCount} Protected Bids`;
  document.getElementById('kpiWalkthroughCount').textContent = `${walkthroughCount} Mandatory Site Walks`;
}

function renderBidList(filtered) {
  const container = document.getElementById('bidListContainer');
  if (!container) return;

  if (filtered.length === 0) {
    container.innerHTML = `
      <div style="padding:28px; text-align:center; color:var(--text-muted);">
        NO OHIO CONTRACTS MATCH CURRENT FILTER CRITERIA.<br/><br/>
        <button class="retro-btn" onclick="document.getElementById('btnResetFilters').click()">RESET FILTERS</button>
      </div>
    `;
    return;
  }

  // Ensure a valid bid is selected
  if (!filtered.some(b => b.id === state.selectedBidId)) {
    state.selectedBidId = filtered[0].id;
  }

  container.innerHTML = filtered.map(b => {
    const isSel = b.id === state.selectedBidId;
    const catClass = b.category === 'CARPET' ? 'tag-carpet' : (b.category === 'COMBO' ? 'tag-combo' : 'tag-janitorial');
    const catLabel = b.category === 'CARPET' ? 'CARPET 561740' : (b.category === 'COMBO' ? 'COMBO JAN+CARPET' : 'JANITORIAL 561720');
    const liveBadge = b.isLiveSynced ? `<span class="tag-badge tag-live">LIVE API</span>` : '';
    const walkBadge = b.walkthroughMandatory
      ? `<span class="tag-badge" style="border-color:var(--accent-red); color:var(--accent-red);">MANDATORY WALK</span>`
      : '';

    return `
      <div class="bid-row ${isSel ? 'selected' : ''}" data-bid-id="${b.id}">
        <div class="bid-row-top">
          <div class="badge-cluster">
            ${liveBadge}
            <span class="tag-badge ${catClass}">${catLabel}</span>
            <span class="tag-badge tag-region">${b.ohioRegion || 'OHIO'} &bull; ${b.city || 'OH'}</span>
            <span class="tag-badge tag-setaside">${b.setAside || 'OPEN'}</span>
            ${walkBadge}
          </div>
          <span style="font-size:11px; color:var(--text-muted);">${b.source} // #${b.solicitationNumber}</span>
        </div>
        <div class="bid-title">${b.title}</div>
        <div class="bid-meta-grid">
          <div>
            <strong>${b.agency}</strong><br/>
            <span>Cleanable: <strong>${formatNum(b.totalSqFt)} SF</strong> (Carpet: <strong>${formatNum(b.carpetSqFt)} SF</strong>) &bull; Due: <strong>${b.dueDate}</strong> &bull; Stage: <strong>[${b.stage}]</strong></span>
          </div>
          <div style="text-align:right;">
            <div class="bid-price">${formatMoney(b.estimatedValue)}/yr</div>
            <div style="font-size:10px; color:var(--text-muted);">MATCH: ${b.matchScore || 92}%</div>
          </div>
        </div>
      </div>
    `;
  }).join('');

  container.querySelectorAll('.bid-row').forEach(row => {
    row.addEventListener('click', () => {
      playBeep(720, 0.025);
      state.selectedBidId = row.getAttribute('data-bid-id');
      renderBidList(getFilteredBids());
      renderDossier();
    });
  });
}

function renderDossier() {
  const inspector = document.getElementById('dossierInspector');
  const solHeader = document.getElementById('dossierSolNum');
  if (!inspector) return;

  const bid = state.bids.find(b => b.id === state.selectedBidId);
  if (!bid) {
    inspector.innerHTML = `<div style="color:var(--text-muted);">Select any Ohio solicitation on the left to inspect scope, floor surface ratios, and incumbent intelligence.</div>`;
    return;
  }

  if (solHeader) solHeader.textContent = `${bid.source} // #${bid.solicitationNumber}`;

  const total = Math.max(1, Number(bid.totalSqFt) || 1);
  const carpetPct = Math.round(((Number(bid.carpetSqFt) || 0) / total) * 100);
  const restroomPct = Math.round(((Number(bid.restroomSqFt) || 0) / total) * 100);
  const hardPct = Math.max(0, 100 - carpetPct - restroomPct);

  const stages = ['DISCOVERED', 'WATCHING', 'WALKTHROUGH', 'PRICED', 'SUBMITTED'];

  inspector.innerHTML = `
    <div style="display:flex; justify-content:space-between; align-items:flex-start; gap:10px; flex-wrap:wrap;">
      <div>
        <span class="tag-badge tag-setaside">${bid.setAside}</span>
        <span class="tag-badge tag-region">${bid.ohioRegion || 'OHIO'} — ${bid.city}, OH</span>
        <span class="tag-badge tag-janitorial">NAICS ${bid.naics}</span>
      </div>
      <a href="${bid.sourceUrl || '#'}" target="_blank" rel="noopener noreferrer" class="retro-btn btn-cyan" style="text-decoration:none;">
        ↗ OPEN PORTAL / PDF
      </a>
    </div>

    <div class="dossier-title">${bid.title}</div>

    <div style="display:flex; gap:8px; flex-wrap:wrap;">
      <button id="btnLoadIntoCalc" class="retro-btn btn-primary" style="flex:1; justify-content:center;">
        ⚡ LOAD INTO ISSA-612 ESTIMATOR (F2)
      </button>
      <select id="dossierStageSelect" class="retro-select" style="width:auto; font-weight:700;">
        ${stages.map(s => `<option value="${s}" ${bid.stage === s ? 'selected' : ''}>STAGE: ${s}</option>`).join('')}
      </select>
    </div>

    <div class="dossier-grid">
      <div class="dossier-cell">
        <span class="lbl">Est. Annual Contract Value</span>
        <span class="val" style="color:var(--accent-primary); font-size:15px;">${formatMoney(bid.estimatedValue)} / yr</span>
      </div>
      <div class="dossier-cell">
        <span class="lbl">Incumbent / Prior Award</span>
        <span class="val">${bid.incumbent || 'Open Bid'} (${formatMoney(bid.priorAwardValue)})</span>
      </div>
      <div class="dossier-cell">
        <span class="lbl">Cleanable Total Sq. Ft.</span>
        <span class="val">${formatNum(bid.totalSqFt)} SF ($${((bid.estimatedValue / 12) / Math.max(1, bid.totalSqFt)).toFixed(2)}/SF/mo)</span>
      </div>
      <div class="dossier-cell">
        <span class="lbl">Carpet Extraction Area</span>
        <span class="val" style="color:var(--accent-cyan);">${formatNum(bid.carpetSqFt)} SF (${carpetPct}%)</span>
      </div>
      <div class="dossier-cell">
        <span class="lbl">Service Frequency</span>
        <span class="val">${bid.frequency || '5x/Week Nightly'}</span>
      </div>
      <div class="dossier-cell">
        <span class="lbl">Extraction Spec</span>
        <span class="val">${bid.extractionMethod || 'Hot-Water Extraction'}</span>
      </div>
      <div class="dossier-cell">
        <span class="lbl">Pre-Bid Site Walkthrough</span>
        <span class="val" style="color:${bid.walkthroughMandatory ? 'var(--accent-amber)' : 'var(--text-primary)'};">
          ${(bid.walkthroughDate || 'TBA').replace('T', ' ')} ${bid.walkthroughMandatory ? '[MANDATORY]' : '[OPTIONAL]'}
        </span>
      </div>
      <div class="dossier-cell">
        <span class="lbl">Proposal Due Date</span>
        <span class="val">${bid.dueDate} (Wage Benchmark: $${(bid.wageRate || 18).toFixed(2)}/hr)</span>
      </div>
    </div>

    <div class="floor-bar-wrap">
      <div style="font-size:11px; font-weight:700; text-transform:uppercase;">FACILITY SURFACE WORKLOADING MATRIX</div>
      <div class="floor-bar-track">
        <div class="bar-carpet" style="width:${carpetPct}%" title="Carpet: ${carpetPct}%"></div>
        <div class="bar-hard" style="width:${hardPct}%" title="VCT / Hard Floor: ${hardPct}%"></div>
        <div class="bar-restroom" style="width:${restroomPct}%" title="Restroom / Medical: ${restroomPct}%"></div>
      </div>
      <div class="floor-legend">
        <span>■ CARPET: ${formatNum(bid.carpetSqFt)} SF (${carpetPct}%)</span>
        <span>■ VCT/HARD: ${formatNum(bid.hardFloorSqFt)} SF (${hardPct}%)</span>
        <span>■ RESTROOMS: ${formatNum(bid.restroomSqFt)} SF (${restroomPct}%)</span>
      </div>
    </div>

    <div class="scope-box">
      <strong style="color:var(--text-primary);">STATEMENT OF WORK (SOW) &amp; OHIO COMPLIANCE SUMMARY:</strong>
      <p style="margin-top:4px;">${bid.scopeSummary}</p>
      <ul class="clin-list">
        ${(bid.lineItems || []).map(li => `<li>${li}</li>`).join('')}
      </ul>
    </div>

    <div class="dossier-grid">
      <div class="dossier-cell">
        <span class="lbl">Contracting Officer / Buyer</span>
        <span class="val">${bid.contactName || 'Procurement Office'}</span>
      </div>
      <div class="dossier-cell">
        <span class="lbl">Direct Contact</span>
        <span class="val">${bid.contactEmail || ''} &bull; ${bid.contactPhone || ''}</span>
      </div>
    </div>
  `;

  document.getElementById('btnLoadIntoCalc')?.addEventListener('click', () => {
    playBeep(880, 0.05);
    loadBidIntoCalculator(bid);
    switchView('view-estimator');
    showToast(`LOADED #${bid.solicitationNumber} INTO ISSA-612 CALCULATOR`);
  });

  document.getElementById('dossierStageSelect')?.addEventListener('change', async (e) => {
    const newStage = e.target.value;
    await updateBidStage(bid.id, newStage);
  });
}

async function updateBidStage(bidId, newStage, extraUpdates = {}) {
  playBeep(620, 0.03);
  const idx = state.bids.findIndex(b => b.id === bidId);
  if (idx === -1) return;
  state.bids[idx] = { ...state.bids[idx], stage: newStage, ...extraUpdates };
  localStorage.setItem('ibid_ohio_bids_cache', JSON.stringify(state.bids));

  try {
    await fetch(`/api/bids/${encodeURIComponent(bidId)}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ stage: newStage, ...extraUpdates })
    });
  } catch (_) {}

  await syncBidToFirebase(state.bids[idx]);
  renderAll();
  showToast(`UPDATED #${state.bids[idx].solicitationNumber} -> [${newStage}]`);
}

// ============================================================================
// F2: ISSA 612 JANITORIAL & CARPET EXTRACTION CALCULATOR
// ============================================================================
function loadBidIntoCalculator(bid) {
  document.getElementById('calcLoadedBidTag').textContent = `LOADED: #${bid.solicitationNumber} (${bid.city}, OH)`;
  document.getElementById('calcProjectTitle').value = `${bid.title} (#${bid.solicitationNumber})`;
  document.getElementById('calcHardFloorSqFt').value = bid.hardFloorSqFt || 0;
  document.getElementById('calcRestroomSqFt').value = bid.restroomSqFt || 0;
  document.getElementById('calcCarpetSqFt').value = bid.carpetSqFt || 0;
  document.getElementById('calcWageRate').value = bid.wageRate || 18.25;
  document.getElementById('calcPriorAward').value = bid.priorAwardValue || bid.estimatedValue || 150000;

  if (bid.category === 'CARPET') {
    document.getElementById('calcJanitorialFreq').value = '0';
    document.getElementById('calcCarpetFreq').value = '2';
    document.getElementById('calcVctStripFreq').value = bid.hardFloorSqFt > 0 ? '1' : '0';
  } else {
    document.getElementById('calcJanitorialFreq').value = '21.67';
    document.getElementById('calcCarpetFreq').value = '2';
    document.getElementById('calcVctStripFreq').value = '2';
  }

  runCalculator();
}

function runCalculator() {
  const title = document.getElementById('calcProjectTitle')?.value || 'Ohio Cleaning Proposal';
  const hardSf = Math.max(0, Number(document.getElementById('calcHardFloorSqFt')?.value) || 0);
  const restroomSf = Math.max(0, Number(document.getElementById('calcRestroomSqFt')?.value) || 0);
  const carpetSf = Math.max(0, Number(document.getElementById('calcCarpetSqFt')?.value) || 0);
  const totalSf = hardSf + restroomSf + carpetSf;

  const visitsPerMonth = Number(document.getElementById('calcJanitorialFreq')?.value) || 0;
  const methodSel = document.getElementById('calcExtractionMethod');
  const selectedOpt = methodSel?.options[methodSel.selectedIndex];
  const carpetSpeed = Number(selectedOpt?.getAttribute('data-speed')) || 700;
  const carpetChemRate = Number(selectedOpt?.getAttribute('data-chem')) || 0.025;

  const carpetRunsPerYear = Number(document.getElementById('calcCarpetFreq')?.value) || 0;
  const vctRunsPerYear = Number(document.getElementById('calcVctStripFreq')?.value) || 0;

  const wage = Math.max(10, Number(document.getElementById('calcWageRate')?.value) || 18.00);
  const burdenPct = Math.max(0, Number(document.getElementById('calcPayrollBurden')?.value) || 21) / 100;
  const marginPct = Math.min(0.75, Math.max(0.05, (Number(document.getElementById('calcProfitMargin')?.value) || 28) / 100));
  const priorAward = Number(document.getElementById('calcPriorAward')?.value) || 0;

  const loadedWage = wage * (1 + burdenPct);

  // 1. Routine Janitorial Workloading (ISSA 612: Open Office/VCT 4,200 SF/hr, Vacuuming Carpet 3,800 SF/hr, Restrooms 1,000 SF/hr)
  const hoursPerVisit = visitsPerMonth > 0
    ? (hardSf / 4200) + (carpetSf / 3800) + (restroomSf / 1000)
    : 0;
  const monthlyJanitorialHours = hoursPerVisit * visitsPerMonth;
  const annualJanitorialHours = monthlyJanitorialHours * 12;
  const annualJanitorialLaborCost = annualJanitorialHours * loadedWage;
  const annualJanitorialSupplies = visitsPerMonth > 0 ? totalSf * 0.18 : 0; // ~$0.015/SF/mo supplies

  // 2. Carpet Extraction Project Workloading
  const hoursPerCarpetRun = carpetSf > 0 ? (carpetSf / carpetSpeed) : 0;
  const annualCarpetHours = hoursPerCarpetRun * carpetRunsPerYear;
  const annualCarpetLaborCost = annualCarpetHours * (loadedWage * 1.12); // Tech premium + setup
  const annualCarpetChemCost = carpetSf * carpetChemRate * carpetRunsPerYear;

  // 3. Periodic VCT Strip & 4-Coat Wax (ISSA 500 SF/hr + $0.06/SF stripper/finish)
  const annualVctHours = (hardSf / 500) * vctRunsPerYear;
  const annualVctLaborCost = annualVctHours * (loadedWage * 1.10);
  const annualVctChemCost = hardSf * 0.06 * vctRunsPerYear;

  // Totals
  const totalAnnualHours = annualJanitorialHours + annualCarpetHours + annualVctHours;
  const totalDirectCost =
    annualJanitorialLaborCost +
    annualJanitorialSupplies +
    annualCarpetLaborCost +
    annualCarpetChemCost +
    annualVctLaborCost +
    annualVctChemCost;

  const annualBidPrice = Math.round(totalDirectCost / (1 - marginPct));
  const monthlyBidPrice = Math.round(annualBidPrice / 12);
  const grossProfitAnnual = annualBidPrice - Math.round(totalDirectCost);
  const pricePerSfMonth = totalSf > 0 ? (monthlyBidPrice / totalSf) : 0;
  const standaloneCarpetPerSf = carpetSf > 0 && carpetRunsPerYear > 0
    ? ((annualCarpetLaborCost + annualCarpetChemCost) / (1 - marginPct)) / (carpetSf * carpetRunsPerYear)
    : 0;

  // Incumbent comparison
  let benchmarkHtml = '';
  if (priorAward > 0) {
    const diffPct = (((annualBidPrice - priorAward) / priorAward) * 100).toFixed(1);
    const isUnder = annualBidPrice <= priorAward;
    benchmarkHtml = `
      <div style="padding:10px; border:1px solid ${isUnder ? 'var(--accent-primary)' : 'var(--accent-amber)'}; background:var(--bg-primary);">
        <strong>INCUMBENT AWARD BENCHMARK (${formatMoney(priorAward)}/yr):</strong><br/>
        <span style="color:${isUnder ? 'var(--accent-primary)' : 'var(--accent-amber)'}; font-weight:700;">
          ${isUnder ? `▼ ${diffPct}% UNDER INCUMBENT — STRONG OHIO WIN POSITION` : `▲ +${diffPct}% ABOVE INCUMBENT — CONSIDER LOWERING MARGIN OR USING CRB ENCAP`}
        </span>
      </div>
    `;
  }

  const receiptEl = document.getElementById('estimatorReceipt');
  if (receiptEl) {
    receiptEl.innerHTML = `
      <div style="text-align:center; border-bottom:2px solid var(--border-bright); padding-bottom:8px;">
        <strong>iBid // BUCKEYE WORKLOADING &amp; BID PROPOSAL SHEET</strong><br/>
        <span style="font-size:11px; color:var(--text-secondary);">${title}</span>
      </div>

      <div class="receipt-line">
        <span>Total Facility Footprint:</span>
        <strong>${formatNum(totalSf)} SF (Carpet: ${formatNum(carpetSf)} SF)</strong>
      </div>
      <div class="receipt-line">
        <span>Fully Loaded Ohio Tech Wage (incl. ${Math.round(burdenPct * 100)}% BWC/Tax):</span>
        <strong>$${loadedWage.toFixed(2)} / hr</strong>
      </div>
      <div class="receipt-line">
        <span>Routine Custodial Hours (${hoursPerVisit.toFixed(1)} hrs/visit):</span>
        <strong>${formatNum(annualJanitorialHours)} hrs/yr (${formatMoney(annualJanitorialLaborCost)})</strong>
      </div>
      <div class="receipt-line">
        <span>Carpet Extraction (${carpetRunsPerYear}x/yr @ ${carpetSpeed} SF/hr):</span>
        <strong>${formatNum(annualCarpetHours)} hrs/yr (${formatMoney(annualCarpetLaborCost + annualCarpetChemCost)})</strong>
      </div>
      <div class="receipt-line">
        <span>Effective Carpet Extraction Rate Per Run:</span>
        <strong>$${standaloneCarpetPerSf.toFixed(3)} / SF</strong>
      </div>
      <div class="receipt-line">
        <span>VCT Strip &amp; 4-Coat Refinishing (${vctRunsPerYear}x/yr):</span>
        <strong>${formatNum(annualVctHours)} hrs/yr (${formatMoney(annualVctLaborCost + annualVctChemCost)})</strong>
      </div>
      <div class="receipt-line">
        <span>Chemicals, Green Seal Supplies &amp; Consumables:</span>
        <strong>${formatMoney(annualJanitorialSupplies + annualCarpetChemCost + annualVctChemCost)} / yr</strong>
      </div>
      <div class="receipt-line">
        <span>Total Direct Cost (Labor + Ohio BWC + Supplies):</span>
        <strong>${formatMoney(totalDirectCost)} / yr</strong>
      </div>
      <div class="receipt-line">
        <span>Projected Annual Gross Profit (${Math.round(marginPct * 100)}% Margin):</span>
        <strong style="color:var(--accent-primary);">${formatMoney(grossProfitAnnual)} / yr</strong>
      </div>

      <div class="receipt-total">
        <div>
          <div>RECOMMENDED ANNUAL BID</div>
          <div style="font-size:12px; color:var(--text-secondary);">
            Monthly: ${formatMoney(monthlyBidPrice)}/mo ($${pricePerSfMonth.toFixed(3)}/SF/mo) &bull; Total Labor: ${formatNum(totalAnnualHours)} hrs/yr
          </div>
        </div>
        <div class="big-price">${formatMoney(annualBidPrice)}</div>
      </div>

      ${benchmarkHtml}
    `;
  }

  state._lastCalculatedAnnualBid = annualBidPrice;
}

// ============================================================================
// F3: PIPELINE KANBAN CRM
// ============================================================================
function renderKanban() {
  const board = document.getElementById('kanbanBoard');
  if (!board) return;

  const columns = [
    { key: 'DISCOVERED', label: '1. DISCOVERED' },
    { key: 'WATCHING', label: '2. WATCHING' },
    { key: 'WALKTHROUGH', label: '3. WALKTHROUGH' },
    { key: 'PRICED', label: '4. PRICED (ISSA)' },
    { key: 'SUBMITTED', label: '5. SUBMITTED / WON' }
  ];

  board.innerHTML = columns.map((col, colIdx) => {
    const colBids = state.bids.filter(b => (b.stage || 'DISCOVERED') === col.key);
    const colTotal = colBids.reduce((acc, b) => acc + (Number(b.estimatedValue) || 0), 0);
    const prevStage = colIdx > 0 ? columns[colIdx - 1].key : null;
    const nextStage = colIdx < columns.length - 1 ? columns[colIdx + 1].key : null;

    return `
      <div class="kanban-col">
        <div class="kanban-col-header">
          <span>${col.label} (${colBids.length})</span>
          <span style="color:var(--accent-primary);">${formatMoney(colTotal)}</span>
        </div>
        <div class="kanban-cards">
          ${colBids.map(b => `
            <div class="kanban-card">
              <div style="display:flex; justify-content:space-between; font-size:10px; color:var(--text-muted);">
                <span>${b.source} &bull; ${b.city}, OH</span>
                <span>NAICS ${b.naics}</span>
              </div>
              <div style="font-weight:700; font-size:12px; cursor:pointer;" data-inspect-id="${b.id}">
                ${b.title}
              </div>
              <div style="font-size:11px; color:var(--text-secondary);">
                ${formatNum(b.totalSqFt)} SF (Carpet: ${formatNum(b.carpetSqFt)} SF)<br/>
                Due: <strong>${b.dueDate}</strong> &bull; <strong style="color:var(--accent-primary);">${formatMoney(b.estimatedValue)}/yr</strong>
              </div>
              <div style="display:flex; justify-content:space-between; gap:4px; margin-top:4px;">
                ${prevStage ? `<button class="retro-btn" style="padding:2px 6px; font-size:10px;" data-move-id="${b.id}" data-target-stage="${prevStage}">◄</button>` : `<span></span>`}
                <button class="retro-btn" style="padding:2px 6px; font-size:10px;" data-calc-id="${b.id}">CALC</button>
                ${nextStage ? `<button class="retro-btn btn-primary" style="padding:2px 6px; font-size:10px;" data-move-id="${b.id}" data-target-stage="${nextStage}">STAGE ►</button>` : `<span></span>`}
              </div>
            </div>
          `).join('')}
        </div>
      </div>
    `;
  }).join('');

  board.querySelectorAll('[data-move-id]').forEach(btn => {
    btn.addEventListener('click', () => {
      const id = btn.getAttribute('data-move-id');
      const targetStage = btn.getAttribute('data-target-stage');
      updateBidStage(id, targetStage);
    });
  });

  board.querySelectorAll('[data-calc-id]').forEach(btn => {
    btn.addEventListener('click', () => {
      const bid = state.bids.find(b => b.id === btn.getAttribute('data-calc-id'));
      if (bid) {
        state.selectedBidId = bid.id;
        loadBidIntoCalculator(bid);
        switchView('view-estimator');
      }
    });
  });

  board.querySelectorAll('[data-inspect-id]').forEach(el => {
    el.addEventListener('click', () => {
      state.selectedBidId = el.getAttribute('data-inspect-id');
      switchView('view-radar');
      renderAll();
    });
  });
}

// ============================================================================
// F4: OHIO & NATIONAL AGGREGATOR DIRECTORY
// ============================================================================
function renderAggregatorIntel() {
  const grid = document.getElementById('aggregatorIntelGrid');
  if (!grid) return;

  if (!state.aggregators || state.aggregators.length === 0) {
    grid.innerHTML = `<div style="color:var(--text-muted);">Loading Ohio &amp; Federal Aggregator Directory...</div>`;
    return;
  }

  grid.innerHTML = state.aggregators.map(agg => `
    <div class="intel-card ${agg.liveConnected ? 'connected' : ''}">
      <div style="display:flex; justify-content:space-between; align-items:center; gap:8px;">
        <span class="tag-badge ${agg.liveConnected ? 'tag-live' : 'tag-setaside'}">
          ${agg.liveConnected ? '● LIVE API CONNECTED' : agg.tier}
        </span>
        <span style="font-family:var(--font-display); font-size:20px; color:var(--accent-primary);">
          SCORE: ${agg.rating}/10
        </span>
      </div>
      <div style="font-size:15px; font-weight:700; color:var(--text-primary);">${agg.name}</div>
      <div style="font-size:11.5px; color:var(--accent-amber);">
        <strong>COST:</strong> ${agg.cost} &bull; <strong>CODES:</strong> ${agg.naicsSupport}
      </div>
      <div style="font-size:12px; color:var(--text-secondary);">
        <strong>STRENGTHS:</strong> ${agg.pros}
      </div>
      <div style="font-size:12px; color:var(--text-muted);">
        <strong>LIMITATIONS:</strong> ${agg.cons}
      </div>
      <div style="background:var(--bg-secondary); border-left:3px solid var(--accent-cyan); padding:6px 8px; font-size:11.5px;">
        <strong>OHIO PRO TIP:</strong> ${agg.cleaningTip}
      </div>
      <div style="margin-top:auto; padding-top:6px; display:flex; justify-content:flex-end;">
        <a href="${agg.url}" target="_blank" rel="noopener noreferrer" class="retro-btn btn-cyan" style="text-decoration:none;">
          ↗ LAUNCH ${agg.name.split(' ')[0].toUpperCase()} PORTAL
        </a>
      </div>
    </div>
  `).join('');
}

// ============================================================================
// LIVE OHIO FEED SYNC (SERVER + DIRECT CORS BROWSER FALLBACK)
// ============================================================================
async function triggerLiveOhioSync() {
  const btn = document.getElementById('btnSyncLive');
  if (btn) {
    btn.disabled = true;
    btn.textContent = '⏳ SYNCING OHIO FEEDS...';
  }
  playBeep(520, 0.06);

  try {
    const res = await fetch('/api/sync/live', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ samApiKey: state.samApiKey })
    });

    if (res.ok) {
      const syncResult = await res.json();
      const bidsRes = await fetch('/api/bids');
      const bidsData = await bidsRes.json();
      state.bids = bidsData.bids || state.bids;
      localStorage.setItem('ibid_ohio_bids_cache', JSON.stringify(state.bids));
      renderAll();

      const usaCount = syncResult.sourceStats?.ohioUsaSpending?.count || 0;
      const cincyCount = syncResult.sourceStats?.cincinnatiOpenData?.count || 0;
      document.getElementById('footerSyncTimestamp').textContent =
        `LAST LIVE OHIO SYNC: ${new Date().toLocaleTimeString()} (+${usaCount} OH Federal, +${cincyCount} Cincinnati Municipal)`;
      showToast(`LIVE OHIO SYNC COMPLETE: ${usaCount} OH Federal + ${cincyCount} Cincinnati Bids Merged!`);
      playBeep(960, 0.08);
    } else {
      throw new Error('Fallback to browser direct CORS sync');
    }
  } catch (err) {
    // Direct Browser CORS Sync if running on static GitHub Pages / Firebase Hosting
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
          limit: 6,
          page: 1
        })
      });
      if (usaRes.ok) {
        const usaData = await usaRes.json();
        for (const r of usaData.results || []) {
          const id = `OH-USA-${r['Award ID']}`;
          if (!state.bids.some(b => b.id === id)) {
            const amt = Math.max(25000, Math.round(Number(r['Award Amount']) || 55000));
            const sf = Math.round(amt / 2.4 / 500) * 500;
            state.bids.push({
              id,
              solicitationNumber: r['Award ID'],
              title: `[OHIO FEDERAL LIVE] ${r.Description || 'Janitorial Services'}`,
              agency: `${r['Awarding Agency']} (Ohio)`,
              source: 'USASPENDING-OH',
              category: r.naics_code === '561740' ? 'CARPET' : 'JANITORIAL',
              naics: r.naics_code || '561720',
              setAside: 'Total Small Business',
              state: 'OH',
              ohioRegion: 'SOUTHWEST-OH',
              city: 'Ohio Federal Site',
              totalSqFt: sf,
              carpetSqFt: Math.round(sf * 0.4),
              hardFloorSqFt: Math.round(sf * 0.48),
              restroomSqFt: Math.round(sf * 0.12),
              estimatedValue: amt,
              incumbent: r['Recipient Name'],
              priorAwardValue: amt,
              dueDate: r['End Date'] || '2026-12-15',
              stage: 'DISCOVERED',
              isLiveSynced: true,
              scopeSummary: `Live Ohio Federal Contract Award (${r['Award ID']}) to ${r['Recipient Name']}.`
            });
          }
        }
        renderAll();
        showToast('SYNCED LIVE OHIO FEDERAL CONTRACTS DIRECTLY FROM USASPENDING.GOV!');
      }
    } catch (_) {
      showToast('SYNC NOTE: Using cached Ohio database.');
    }
  } finally {
    if (btn) {
      btn.disabled = false;
      btn.textContent = '⚡ SYNC LIVE OHIO FEEDS';
    }
  }
}

function switchView(viewId) {
  playBeep(680, 0.03);
  document.querySelectorAll('.view-section').forEach(sec => {
    sec.classList.toggle('active', sec.id === viewId);
  });
  document.querySelectorAll('.f-tab').forEach(tab => {
    tab.classList.toggle('active', tab.getAttribute('data-view') === viewId);
  });
}

function exportFilteredCsv() {
  const rows = getFilteredBids();
  const headers = [
    'SolicitationNumber',
    'Title',
    'Agency',
    'SourcePortal',
    'Category',
    'NAICS',
    'OhioRegion',
    'City',
    'SetAside',
    'TotalSqFt',
    'CarpetSqFt',
    'EstimatedAnnualValue',
    'Incumbent',
    'DueDate',
    'Stage'
  ];
  const csvLines = [
    headers.join(','),
    ...rows.map(b => [
      `"${(b.solicitationNumber || '').replace(/"/g, '""')}"`,
      `"${(b.title || '').replace(/"/g, '""')}"`,
      `"${(b.agency || '').replace(/"/g, '""')}"`,
      `"${b.source || ''}"`,
      `"${b.category || ''}"`,
      `"${b.naics || ''}"`,
      `"${b.ohioRegion || ''}"`,
      `"${b.city || ''}"`,
      `"${b.setAside || ''}"`,
      b.totalSqFt || 0,
      b.carpetSqFt || 0,
      b.estimatedValue || 0,
      `"${(b.incumbent || '').replace(/"/g, '""')}"`,
      `"${b.dueDate || ''}"`,
      `"${b.stage || ''}"`
    ].join(','))
  ];

  const blob = new Blob([csvLines.join('\n')], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = `ibid-ohio-cleaning-contracts-${new Date().toISOString().slice(0, 10)}.csv`;
  link.click();
  showToast(`EXPORTED ${rows.length} OHIO CONTRACTS TO CSV`);
}

function bindEvents() {
  // Navigation tabs
  document.querySelectorAll('.f-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      switchView(tab.getAttribute('data-view'));
    });
  });

  // Function Key shortcuts F1-F4
  window.addEventListener('keydown', e => {
    if (e.key === 'F1') { e.preventDefault(); switchView('view-radar'); }
    if (e.key === 'F2') { e.preventDefault(); switchView('view-estimator'); }
    if (e.key === 'F3') { e.preventDefault(); switchView('view-kanban'); }
    if (e.key === 'F4') { e.preventDefault(); switchView('view-intel'); }
  });

  // Theme selector
  document.getElementById('themeSelector')?.addEventListener('change', e => {
    playBeep(750, 0.04);
    applyTheme(e.target.value);
  });

  // Scanlines toggle
  document.getElementById('btnToggleScanlines')?.addEventListener('click', e => {
    state.scanlinesEnabled = !state.scanlinesEnabled;
    document.body.classList.toggle('scanlines-on', state.scanlinesEnabled);
    e.currentTarget.textContent = `CRT: ${state.scanlinesEnabled ? 'ON' : 'OFF'}`;
    playBeep(600, 0.03);
  });

  // Audio toggle
  document.getElementById('btnToggleAudio')?.addEventListener('click', e => {
    state.sfxEnabled = !state.sfxEnabled;
    e.currentTarget.textContent = `SFX: ${state.sfxEnabled ? 'ON' : 'OFF'}`;
    if (state.sfxEnabled) playBeep(880, 0.04);
  });

  // Filters
  ['searchInput', 'regionFilter', 'categoryFilter', 'setAsideFilter', 'sourceFilter'].forEach(id => {
    const el = document.getElementById(id);
    if (!el) return;
    el.addEventListener('input', () => renderAll());
    el.addEventListener('change', () => {
      playBeep(640, 0.02);
      renderAll();
    });
  });

  document.getElementById('btnResetFilters')?.addEventListener('click', () => {
    playBeep(500, 0.03);
    document.getElementById('searchInput').value = '';
    document.getElementById('regionFilter').value = 'ALL';
    document.getElementById('categoryFilter').value = 'ALL';
    document.getElementById('setAsideFilter').value = 'ALL';
    document.getElementById('sourceFilter').value = 'ALL';
    renderAll();
  });

  // Live Ohio Sync
  document.getElementById('btnSyncLive')?.addEventListener('click', triggerLiveOhioSync);

  // CSV Export
  document.getElementById('btnExportCsv')?.addEventListener('click', exportFilteredCsv);

  // Estimator live recalculation
  [
    'calcProjectTitle',
    'calcHardFloorSqFt',
    'calcRestroomSqFt',
    'calcCarpetSqFt',
    'calcJanitorialFreq',
    'calcExtractionMethod',
    'calcCarpetFreq',
    'calcVctStripFreq',
    'calcWageRate',
    'calcPayrollBurden',
    'calcProfitMargin',
    'calcPriorAward'
  ].forEach(id => {
    const el = document.getElementById(id);
    if (!el) return;
    el.addEventListener('input', runCalculator);
    el.addEventListener('change', () => {
      playBeep(700, 0.02);
      runCalculator();
    });
  });

  // Save Estimate back to selected Bid
  document.getElementById('btnSaveEstimateToBid')?.addEventListener('click', async () => {
    if (!state.selectedBidId || !state._lastCalculatedAnnualBid) return;
    await updateBidStage(state.selectedBidId, 'PRICED', {
      estimatedValue: state._lastCalculatedAnnualBid
    });
    showToast(`SAVED ISSA-612 PRICE (${formatMoney(state._lastCalculatedAnnualBid)}/yr) & MARKED [PRICED]!`);
  });

  // Modal: Import / Scrape RFP
  const modalScraper = document.getElementById('modalScraper');
  document.getElementById('btnOpenScraper')?.addEventListener('click', () => {
    playBeep(740, 0.03);
    modalScraper.classList.add('open');
  });
  document.getElementById('btnCloseScraper')?.addEventListener('click', () => {
    modalScraper.classList.remove('open');
  });

  document.getElementById('btnRunScrape')?.addEventListener('click', async () => {
    const titleOverride = document.getElementById('scrapeTitle').value.trim();
    const url = document.getElementById('scrapeUrl').value.trim();
    const rawText = document.getElementById('scrapeRawText').value.trim();
    if (!url && !rawText && !titleOverride) {
      showToast('PLEASE ENTER A URL OR PASTE SOLICITATION TEXT');
      return;
    }

    try {
      const res = await fetch('/api/scrape', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url, rawText, titleOverride })
      });
      if (res.ok) {
        const data = await res.json();
        if (data.bid) {
          state.bids.unshift(data.bid);
          state.selectedBidId = data.bid.id;
          await syncBidToFirebase(data.bid);
        }
      }
    } catch (_) {}

    modalScraper.classList.remove('open');
    document.getElementById('scrapeTitle').value = '';
    document.getElementById('scrapeUrl').value = '';
    document.getElementById('scrapeRawText').value = '';
    renderAll();
    showToast('NEW OHIO SOLICITATION PARSED & ADDED TO RADAR!');
  });

  // Modal: Cloud / Firebase / SAM.gov
  const modalCloud = document.getElementById('modalCloud');
  document.getElementById('btnOpenCloud')?.addEventListener('click', () => {
    playBeep(740, 0.03);
    document.getElementById('inputSamApiKey').value = state.samApiKey;
    document.getElementById('inputFbProjectId').value = state.fbProjectId;
    document.getElementById('inputFbApiKey').value = state.fbApiKey;
    modalCloud.classList.add('open');
  });
  document.getElementById('btnCloseCloud')?.addEventListener('click', () => {
    modalCloud.classList.remove('open');
  });

  document.getElementById('btnSaveCloudConfig')?.addEventListener('click', async () => {
    state.samApiKey = document.getElementById('inputSamApiKey').value.trim();
    state.fbProjectId = document.getElementById('inputFbProjectId').value.trim();
    state.fbApiKey = document.getElementById('inputFbApiKey').value.trim();

    localStorage.setItem('ibid_sam_key', state.samApiKey);
    localStorage.setItem('ibid_fb_project', state.fbProjectId);
    localStorage.setItem('ibid_fb_apikey', state.fbApiKey);

    updateCloudStatusUI();
    modalCloud.classList.remove('open');

    if (state.fbProjectId && state.fbApiKey) {
      for (const b of state.bids.slice(0, 15)) {
        await syncBidToFirebase(b);
      }
      showToast(`FIREBASE CLOUD SYNC ENABLED (${state.fbProjectId})!`);
    } else {
      showToast('SETTINGS SAVED LOCALLY');
    }
  });

  document.getElementById('btnResetDemoData')?.addEventListener('click', async () => {
    try {
      const res = await fetch('/api/bids/reset', { method: 'POST' });
      if (res.ok) {
        const data = await res.json();
        state.bids = data.bids || FALLBACK_OHIO_BIDS;
        state.selectedBidId = state.bids[0]?.id;
        renderAll();
        modalCloud.classList.remove('open');
        showToast('OHIO BASELINE BIDS RESTORED!');
      }
    } catch (_) {}
  });
}

window.addEventListener('DOMContentLoaded', initApp);
