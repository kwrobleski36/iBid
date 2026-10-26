'use strict';
// Pure bid logic (dates, territory, classification, enrichment). No Node-only APIs, so it runs
// in both the local server and the Cloudflare edge function.

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

function isTodayOrFuture(dateStr) {
  const iso = normalizeDateToIso(dateStr);
  if (!iso) return false;
  return iso >= getTodayIso();
}

/**
 * SSRF Protection: Validates that a user-supplied URL uses HTTPS and targets a public hostname.
 */
function validateExternalHttpsUrl(rawUrl) {
  if (!rawUrl || typeof rawUrl !== 'string') {
    throw new Error('URL is required');
  }
  let parsed;
  try {
    parsed = new URL(rawUrl.trim());
  } catch (_) {
    throw new Error('Invalid URL format');
  }
  if (parsed.protocol !== 'https:') {
    throw new Error('Only https:// URLs are permitted');
  }
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

// ============================================================================
// GUARDIAN FACILITY SERVICES — 20-COUNTY NORTHEAST OHIO TERRITORY MATRIX
// (Within ~100 miles of Cleveland, per guardian-facility-services.com/service-area)
// ============================================================================
const GFS_NE_OHIO_COUNTIES = [
  {
    county: 'Cuyahoga County',
    distanceMi: 8,
    cities: [
      'CLEVELAND', 'PARMA', 'LAKEWOOD', 'EUCLID', 'STRONGSVILLE', 'BEACHWOOD', 'SOLON',
      'WESTLAKE', 'INDEPENDENCE', 'SHAKER HEIGHTS', 'GARFIELD HEIGHTS', 'BRECKSVILLE',
      'BROADVIEW HEIGHTS', 'BEDFORD', 'BEREA', 'OHIO TURNPIKE', 'BROOK PARK', 'ROCKY RIVER',
      'CHAGRIN FALLS', 'CUYAHOGA'
    ]
  },
  {
    county: 'Lake County',
    distanceMi: 24,
    cities: ['MENTOR', 'WILLOUGHBY', 'PAINESVILLE', 'WICKLIFFE', 'EASTLAKE', 'MADISON', 'KIRTLAND', 'LAKE COUNTY', 'LAKETRAN']
  },
  {
    county: 'Geauga County',
    distanceMi: 28,
    cities: ['CHARDON', 'CHESTERLAND', 'BAINBRIDGE', 'MIDDLEFIELD', 'BURTON', 'GEAUGA']
  },
  {
    county: 'Lorain County',
    distanceMi: 29,
    cities: ['LORAIN', 'ELYRIA', 'AVON', 'NORTH RIDGEVILLE', 'AMHERST', 'OBERLIN', 'SHEFFIELD', 'WELLINGTON', 'GRAFTON']
  },
  {
    county: 'Medina County',
    distanceMi: 31,
    cities: ['MEDINA', 'BRUNSWICK', 'WADSWORTH', 'HINCKLEY', 'LODI', 'SEVILLE']
  },
  {
    county: 'Summit County',
    distanceMi: 34,
    cities: [
      'AKRON', 'CUYAHOGA FALLS', 'STOW', 'HUDSON', 'BARBERTON', 'TWINSBURG', 'MACEDONIA',
      'FAIRLAWN', 'GREEN', 'TALLMADGE', 'NORTON', 'RICHFIELD', 'SUMMIT COUNTY'
    ]
  },
  {
    county: 'Portage County',
    distanceMi: 38,
    cities: ['KENT', 'RAVENNA', 'STREETSBORO', 'AURORA', 'GARRETTSVILLE', 'HIRAM', 'ROOTSTOWN', 'PORTAGE COUNTY']
  },
  {
    county: 'Stark County',
    distanceMi: 54,
    cities: ['CANTON', 'MASSILLON', 'ALLIANCE', 'NORTH CANTON', 'LOUISVILLE', 'MINERVA', 'HARTVILLE', 'CANAL FULTON', 'STARK COUNTY']
  },
  {
    county: 'Wayne County',
    distanceMi: 52,
    cities: ['WOOSTER', 'ORRVILLE', 'RITTMAN', 'DOYLESTOWN', 'SHREVE', 'WAYNE COUNTY']
  },
  {
    county: 'Trumbull County',
    distanceMi: 56,
    cities: ['WARREN', 'NILES', 'HUBBARD', 'CORTLAND', 'GIRARD', 'NEWTON FALLS', 'LORDSTOWN', 'VIENNA', 'TRUMBULL']
  },
  {
    county: 'Ashtabula County',
    distanceMi: 58,
    cities: ['ASHTABULA', 'CONNEAUT', 'GENEVA', 'JEFFERSON', 'ANDOVER', 'ORWELL']
  },
  {
    county: 'Erie County',
    distanceMi: 60,
    cities: ['SANDUSKY', 'HURON', 'VERMILION', 'PERKINS', 'MILAN', 'CASTALIA', 'ERIE COUNTY']
  },
  {
    county: 'Huron County',
    distanceMi: 58,
    cities: ['NORWALK', 'WILLARD', 'BELLEVUE', 'NEW LONDON', 'MONROEVILLE', 'HURON COUNTY']
  },
  {
    county: 'Ashland County',
    distanceMi: 62,
    cities: ['ASHLAND', 'LOUDONVILLE', 'POLK', 'SULLIVAN', 'ASHLAND COUNTY']
  },
  {
    county: 'Mahoning County',
    distanceMi: 66,
    cities: ['YOUNGSTOWN', 'BOARDMAN', 'AUSTINTOWN', 'CANFIELD', 'STRUTHERS', 'CAMPBELL', 'SEBRING', 'MAHONING']
  },
  {
    county: 'Richland County',
    distanceMi: 74,
    cities: ['MANSFIELD', 'SHELBY', 'ONTARIO', 'LEXINGTON', 'BELLVILLE', 'RICHLAND COUNTY']
  },
  {
    county: 'Holmes County',
    distanceMi: 68,
    cities: ['MILLERSBURG', 'BERLIN', 'KILLBUCK', 'WALNUT CREEK', 'HOLMES COUNTY']
  },
  {
    county: 'Tuscarawas County',
    distanceMi: 76,
    cities: ['NEW PHILADELPHIA', 'DOVER', 'UHRICHSVILLE', 'DENNISON', 'SUGARCREEK', 'NEWCOMERSTOWN', 'TUSCARAWAS']
  },
  {
    county: 'Carroll County',
    distanceMi: 72,
    cities: ['CARROLLTON', 'MALVERN', 'DELLROY', 'CARROLL COUNTY']
  },
  {
    county: 'Columbiana County',
    distanceMi: 78,
    cities: ['SALEM', 'EAST LIVERPOOL', 'LISBON', 'COLUMBIANA', 'EAST PALESTINE', 'WELLSVILLE']
  }
];

function detectGfsTerritory(text = '', state = 'OH', cityHint = '') {
  const combined = `${text} ${cityHint}`.toUpperCase();
  const isOhioState = !state || state === 'OH' || state === 'Ohio';

  if (isOhioState) {
    for (const c of GFS_NE_OHIO_COUNTIES) {
      for (const token of c.cities) {
        const regex = new RegExp(`\\b${token.replace(/\s+/g, '\\s+')}\\b`, 'i');
        if (regex.test(combined)) {
          const matchedCity =
            cityHint && cityHint !== 'Ohio' && cityHint !== 'Ohio Statewide'
              ? cityHint
              : token === 'OHIO TURNPIKE'
              ? 'Berea (Cuyahoga Co)'
              : token.charAt(0) + token.slice(1).toLowerCase();
          return {
            isGfsTerritory: true,
            county: c.county,
            distanceMi: c.distanceMi,
            ohioRegion: 'NORTHEAST-OH',
            city: matchedCity
          };
        }
      }
    }
    if (/NASA GLENN|GLENN RESEARCH|GRC|36C250.*CLEVELAND|WADE PARK|NEORSD|GCRTA|LAKETRAN|METROHEALTH/i.test(combined)) {
      return {
        isGfsTerritory: true,
        county: 'Cuyahoga County',
        distanceMi: 10,
        ohioRegion: 'NORTHEAST-OH',
        city: 'Cleveland'
      };
    }
  }

  if (!isOhioState) {
    return {
      isGfsTerritory: false,
      county: `Out of State (${state})`,
      distanceMi: null,
      ohioRegion: `NATIONAL (${state})`,
      city: cityHint || 'Federal Facility'
    };
  }

  if (/CINCINNATI|HAMILTON|DAYTON|MONTGOMERY|WRIGHT-PATTERSON|WPAFB|FAIRBORN|GREENE|BUTLER|LAKOTA|MASON|TROY|MIAMI|PIQUA|WILMINGTON|36C250/.test(combined)) {
    return {
      isGfsTerritory: false,
      county: 'Southwest Ohio',
      distanceMi: 205,
      ohioRegion: 'SOUTHWEST-OH',
      city: cityHint && cityHint !== 'Ohio' ? cityHint : 'Dayton / Cincinnati'
    };
  }
  if (/TOLEDO|LUCAS|FINDLAY|BOWLING GREEN|WOOD|LIMA|ALLEN|MAUMEE|DEFIANCE|HANCOCK|KENTON|HARDIN/.test(combined)) {
    return {
      isGfsTerritory: false,
      county: 'Northwest Ohio',
      distanceMi: 115,
      ohioRegion: 'NORTHWEST-OH',
      city: cityHint && cityHint !== 'Ohio' ? cityHint : 'Toledo / NW Ohio'
    };
  }
  if (/ATHENS|CHILLICOTHE|ROSS|ZANESVILLE|MUSKINGUM|PORTSMOUTH|SCIOTO|MARIETTA|SOCF|LUCASVILLE|NELSONVILLE|WAYNE NATIONAL|IRONTON|HOCKING|GALLIA/.test(combined)) {
    return {
      isGfsTerritory: false,
      county: 'Southeast Ohio',
      distanceMi: 165,
      ohioRegion: 'SOUTHEAST-OH',
      city: cityHint && cityHint !== 'Ohio' ? cityHint : 'Southeast Ohio'
    };
  }
  if (/COLUMBUS|FRANKLIN|DELAWARE|LICKING|FAIRFIELD|PICKAWAY|COTA|DSCC|DUBLIN|WESTERVILLE|GROVE CITY|ALUM CREEK/.test(combined)) {
    return {
      isGfsTerritory: false,
      county: 'Franklin County (Central OH)',
      distanceMi: 140,
      ohioRegion: 'CENTRAL-OH',
      city: cityHint && cityHint !== 'Ohio' ? cityHint : 'Columbus'
    };
  }

  return {
    isGfsTerritory: false,
    county: 'Ohio Statewide',
    distanceMi: null,
    ohioRegion: 'CENTRAL-OH',
    city: cityHint || 'Ohio Statewide'
  };
}

function inferOhioRegion(text = '', state = 'OH') {
  return detectGfsTerritory(text, state).ohioRegion;
}

// ============================================================================
// BIDNET ORIGIN UNMASKER — RESOLVES LOCKED BIDNET ROWS TO REAL OHIO AGENCIES
// ============================================================================
function unmaskBidNetOrigin(title = '', aiOverview = '', solId = '') {
  const t = `${title} ${aiOverview}`;

  if (/Maintenance Building Janitorial Services/i.test(title)) {
    return {
      solicitationNumber: 'OTIC-4516',
      agency: 'Ohio Turnpike and Infrastructure Commission (Berea, OH)',
      city: 'Berea',
      freePortalUrl: 'https://www.ohioturnpike.org/business/doing-business-with-us/bid-invitations',
      freePortalLabel: 'Ohio Turnpike Official Bid Invitations (#4516)',
      unmaskedNote: 'Unmasked from BidNet: Issued by Ohio Turnpike & Infrastructure Commission (682 Prospect St, Berea, OH 44017 — Cuyahoga County). Invitation to Bid #4516.'
    };
  }

  if (/WD-1 Annex Major Renovation/i.test(title)) {
    return {
      solicitationNumber: 'CTI-260004',
      agency: 'Columbus State Community College / OFCC',
      city: 'Columbus',
      freePortalUrl: 'https://www.bidexpress.com/solicitations/49642',
      freePortalLabel: 'OFCC / BidExpress Solicitation #49642 (Free PDF)',
      unmaskedNote: 'Unmasked from BidNet: Official OFCC Project #CTI-260004 (Columbus State WD-1 Annex Major Renovation). Direct Solicitation PDF: https://dam.assets.ohio.gov/image/upload/ofcc.ohio.gov/Project_Opportunities/Bids/2026/SOL-CTI-260004.pdf'
    };
  }

  if (/CMR-Bethel Local School District/i.test(title)) {
    return {
      solicitationNumber: 'SFC-270531',
      agency: 'Bethel Local School District + OFCC ($46.28M CM-R)',
      city: 'Tipp City / Miami Co',
      freePortalUrl: 'https://ofcc.ohio.gov/wps/portal/gov/ofcc/project-opportunities/best-value-selection-rfqs/best-value-selection-rfqs',
      freePortalLabel: 'OFCC Best-Value CM-R Portal (SFC-270531)',
      unmaskedNote: 'Unmasked from BidNet: OFCC Project #SFC-270531 ($46,281,624 CM-R School Construction & Final Clean Opportunity).'
    };
  }

  if (/Dillon State Park & Pymatuning State Park/i.test(title)) {
    return {
      solicitationNumber: `ODNR-${solId.slice(-6)}`,
      agency: 'Ohio Dept of Natural Resources — Pymatuning State Park (Ashtabula Co)',
      city: 'Andover',
      freePortalUrl: 'https://ohiodnr.gov/buy-and-apply/doing-business-with-odnr/bid-opportunities',
      freePortalLabel: 'ODNR Official Bid Opportunities Portal',
      unmaskedNote: 'Unmasked from BidNet: ODNR State Park Facility Improvements including Pymatuning State Park (Andover, OH — Ashtabula County, inside GFS 20-County NE Ohio territory).'
    };
  }

  if (/Allen County Courthouse Renovation/i.test(title)) {
    return {
      solicitationNumber: `ALLEN-${solId.slice(-6)}`,
      agency: 'Allen County Board of Commissioners (Lima, OH)',
      city: 'Lima',
      freePortalUrl: 'https://www.allencountyohio.com/legal-notices-bids/',
      freePortalLabel: 'Allen County Official Legal Notices & Bids',
      unmaskedNote: 'Unmasked from BidNet: Allen County Courthouse Renovation Project — Prime GC & CSI 01 74 23 Post-Construction Final Clean opportunity.'
    };
  }

  if (/2026 Library Renovation/i.test(title)) {
    return {
      solicitationNumber: `LIB-${solId.slice(-6)}`,
      agency: 'Ohio Public Library District (via BidNet Direct Ohio)',
      city: 'Ohio',
      freePortalUrl: `https://www.google.com/search?q=${encodeURIComponent('"2026 Library Renovation" Ohio bid OR rfp')}`,
      freePortalLabel: 'Locate Direct Library Renovation Bid Packet',
      unmaskedNote: 'Unmasked from BidNet: Interior Library Renovation + Flooring & CSI 01 74 23 Final Cleaning scope.'
    };
  }

  if (/Two \(2\) Ride-On Floor Scrubbers|Ride-On Floor Scrubbers/i.test(title)) {
    return {
      solicitationNumber: 'COTA-2026-IFB-068',
      agency: 'Central Ohio Transit Authority (COTA)',
      city: 'Columbus',
      freePortalUrl: 'https://procurement.opengov.com/portal/cota',
      freePortalLabel: 'COTA OpenGov Portal (2026-IFB-068)',
      unmaskedNote: 'Unmasked from BidNet: Issued by Central Ohio Transit Authority (COTA) on OpenGov (#2026-IFB-068) for 1x Tennant T7-800-D and 1x Tennant T20-C-D ride-on floor scrubbers (or approved equal).'
    };
  }

  if (/COTA Bus Passenger Shelter Cleaning/i.test(title)) {
    return {
      solicitationNumber: `COTA-${solId.slice(-6)}`,
      agency: 'Central Ohio Transit Authority (COTA)',
      city: 'Columbus',
      freePortalUrl: 'https://procurement.opengov.com/portal/cota',
      freePortalLabel: 'COTA OpenGov Procurement Portal',
      unmaskedNote: 'Unmasked from BidNet: Published for free on COTA OpenGov Portal (https://procurement.opengov.com/portal/cota).'
    };
  }

  if (/R&P\s*-|O\.R\.C\.\s*Weekly Walk-Off|Rental of Floor Mats & Dust Mops \(D&M\)/i.test(title)) {
    const dept = /R&P/i.test(title)
      ? 'City of Columbus — Recreation & Parks Dept (R&P)'
      : /O\.R\.C\./i.test(title)
      ? 'City of Columbus — Office of Real Estate / Facilities (O.R.C.)'
      : 'City of Columbus — Division of Fleet & Facility Maintenance (D&M)';
    return {
      solicitationNumber: `CBUS-${solId.slice(-6)}`,
      agency: dept,
      city: 'Columbus',
      freePortalUrl: 'https://columbusvendorservices.powerappsportals.com/Solicitations/',
      freePortalLabel: 'City of Columbus Vendor Services Portal (Free Access)',
      unmaskedNote: `Unmasked from BidNet: Direct City of Columbus solicitation (${dept}). Access and bid for free on the City of Columbus Vendor Services Portal.`
    };
  }

  if (/WRIGHT-PATTERSON|WPAFB/i.test(title)) {
    return {
      solicitationNumber: `WPAFB-${solId.slice(-6)}`,
      agency: 'Wright-Patterson AFB (88th Air Base Wing — Dayton, OH)',
      city: 'Dayton / WPAFB',
      freePortalUrl: 'https://sam.gov/content/opportunities',
      freePortalLabel: 'SAM.gov Official Federal Portal',
      unmaskedNote: 'Unmasked from BidNet: Federal Wright-Patterson AFB notice mirrored from SAM.gov.'
    };
  }

  if (/park board facilities and a fire department building/i.test(aiOverview) || /^Janitorial Services$/i.test(title.trim())) {
    return {
      solicitationNumber: `BN-OH-${solId.slice(-6)}`,
      agency: 'Ohio Municipal Park Board & Fire Department (via BidNet Ohio)',
      city: 'Ohio Municipal',
      freePortalUrl: `https://www.google.com/search?q=${encodeURIComponent(`"${title}" "Ohio" park fire janitorial bid 2026`)}`,
      freePortalLabel: 'Search Direct Municipal Bid Packet',
      unmaskedNote: 'Extracted via BidNet Public AI Overview: Covers 3 locations (Park Board facilities + Fire Department building) with 1x/week to 1x/month cleaning schedules.'
    };
  }

  if (/MUNICIPAL BUILDING CLEANING/i.test(title)) {
    return {
      solicitationNumber: `BN-OH-${solId.slice(-6)}`,
      agency: 'Ohio Municipal Government — Public Building Custodial',
      city: 'Ohio Municipal',
      freePortalUrl: `https://www.google.com/search?q=${encodeURIComponent(`"${title}" Ohio 2026 bid OR rfp`)}`,
      freePortalLabel: 'Locate Direct City Bid Packet',
      unmaskedNote: 'Scraped from BidNet Direct Ohio public feed. Use "Locate Direct City Bid Packet" to find the municipality\'s free PDF posting.'
    };
  }

  return {
    solicitationNumber: `BN-OH-${solId}`,
    agency: 'Ohio Public Agency (BidNet Direct Ohio)',
    city: 'Ohio',
    freePortalUrl: `https://www.google.com/search?q=${encodeURIComponent(`"${title}" Ohio bid OR rfp`)}`,
    freePortalLabel: 'Find Direct Agency Posting (Free Web Lookup)',
    unmaskedNote: 'Pulled from BidNet Direct Ohio public abstract.'
  };
}

// ============================================================================
// STRICT NOISE REJECTION & GFS 6-LINE COMMODITY CLASSIFIER
// ============================================================================
function isExcludedNoise(title = '', desc = '', naics = '', psc = '', state = 'OH') {
  const t = `${title} ${desc}`.toUpperCase();

  // 1. Cancelled notices
  if (/IS CANCELLED|IS CANCELED|NOTICE IS CANCELLED|SOLICITATION IS CANCELLED/i.test(t)) {
    return true;
  }

  // 2. Non-building civil/industrial/medical noise (Building Construction, Software/Web, Apparel/Uniforms & Janitorial are ALLOWED)
  if (
    /SEWER MAINLINE|PACP POST-CLEANING|WASTEWATER|SLUDGE|ORPHAN WELL|QUICKLIME|QUICK LIME|STIHL|VEHICULAR|PARTS KIT|SNOW REMOVAL|HOOD CLEANING|EXHAUST HOOD|CLEAN SHOP WET PROCESS|FURNITURE WASHING.*EMBASSY|DURABLE MEDICAL EQUIPMENT|\bDME\b|KP MESS CONTRACT|DRUG TESTING|ELECTRONIC MONITORING|PHARMACY LOGISTICS|KINSHIP AND ADOPTION|FARMHOUSE FOR SALE|FUEL TANK DISPENSING|STEAM LINE REPLACEMENT|EROSION CONTROL|DAM IMPROVEMENTS|LOCK AND DAM|MRI UPGRADE|MAIN SWITCH|GENERATOR REPLACEMENT|METER REPLACEMENT|GEOTHERMAL PLANT|HELIPAD FIRE|EXPLOSION PROOF|HUMIDIFICATION|RO SYSTEM UPGRADE|ANNUAL PREQUALIFICATION LIST OF PROFESSIONAL/i.test(
      t
    )
  ) {
    return true;
  }

  // 3. Overseas embassies (Hanoi, Madrid, etc.)
  if (/EMBASSY HANOI|EMBASSY MADRID|VIETNAM|SPAIN|ES-MD/i.test(`${t} ${state}`)) {
    return true;
  }

  // 4. Out-of-state national cemeteries misfiled under OH
  if (/SARATOGA NATIONAL CEMETERY/i.test(t)) {
    return true;
  }

  return false;
}

/**
 * Classifies a solicitation into Guardian Facility Services' 6 Core Business Lines:
 * 1. JANITORIAL (561720 / S201 / 910-39)
 * 2. FLOOR_CARE (561740 / 910-09 / 910-25 — VCT Strip & Wax, Carpet Extraction, Tile & Grout)
 * 3. CONSTRUCTION (236220 / 238330 / CSI 01 74 23 / 910-03 — Building Construction, Renovations, Flooring & Final Clean)
 * 4. TURNOVER_STR (561720 / 76111800 — Airbnb/STR Turnovers, Apartment Make-Ready & Dorm Turnovers)
 * 5. MAT_RENTAL (812332 / S209 / 954-05 — Walk-Off Runner Mats & Dust Mops)
 * 6. SUPPLIES_EQUIP (423850 / 424690 / 7910 / 7930 — Scrubbers, Burnishers, Wax & Chemicals)
 */
function classifyGfsBid(title = '', desc = '', existingNaics = '') {
  const text = `${title} ${desc}`.toUpperCase();
  const titleUpper = String(title).toUpperCase();

  const isMatRentalTitle =
    /\bWALK[- ]?OFF\b|\bRUNNER MAT|\bFLOOR MAT|\bMAT RENTAL|\bMATS\s*(?:&|AND)\s*DUST MOP|\bDUST MOP|\bENTRANCE MAT|812332|954-05/i.test(
      titleUpper
    );
  const isMatRental =
    isMatRentalTitle || /\bWALK[- ]?OFF MAT|\bFLOOR MAT RENTAL/i.test(text);

  const isSuppliesOrEquip =
    /\bFLOOR SCRUBBER|\bRIDE[- ]?ON.*SCRUBBER|\bWALK[- ]?BEHIND.*SCRUBBER|\bBURNISHER|\bFLOOR MACHINE|\bCARPET EXTRACTOR|\bJANITORIAL SUPPL|\bCLEANING SUPPL|\bCLEANING CHEMICAL|\bFLOOR WAX|\bFLOOR FINISH|\bFLOOR STRIPPER|423850|424690|7910|7930|365-10|485-54/i.test(
      titleUpper
    );

  const isTurnoverOrStr =
    /\bAIRBNB|\bVRBO|\bSHORT[- ]?TERM RENTAL|\bVACATION RENTAL|\bSTR TURNOVER|\bTURNOVER CLEANING|\bUNIT TURNOVER|\bMAKE[- ]?READY|\bMOVE[- ]?OUT CLEANING|\bRESIDENCE HALL.*CLEAN|\bDORM.*CLEAN|\bAPARTMENT.*TURNOVER|\bLODGING.*CLEAN|\bTDY.*CLEAN|\bNURSE HOUSING/i.test(
      text
    );

  const isConstructionOrFinalClean =
    /\bPOST[- ]?CONSTRUCTION|\bFINAL CLEAN|\bCSI\s*01\s*74\s*23|\bROUGH\s*(?:&|AND)\s*FINAL|\bCONSTRUCTION CLEAN|\bBUILDING RENOVATION|\bMAJOR RENOVATION|\bLIBRARY RENOVATION|\bCOURTHOUSE RENOVATION|\bCAMPUS IMPROVEMENTS|\bFACILITY IMPROVEMENTS|\bFOOD SERVICE RENOVATION|\bSTUDENT HOUSING.*INNOVATION|\bBUILDOUT|\bEPOXY FLOOR REPLACEMENT|\bFLOOR REPAIRS AND REPLACEMENT|\bCARPET REPLACEMENT|\bNEW CARPET INSTALLATION|\bSTAIR RUNNER REPLACEMENT|\bREPLACE.*FLOORING|\bGARAGE RESTORATION|\bBUILDING DEMOLITION|\bCM-R\b|\bCMR-|\bDESIGN[- ]BUILD|236220|238330|238990|910-03/i.test(
      text
    );

  const isVctOrTile =
    /\bSTRIP(?:PING)?\s*(?:&|AND)?\s*WAX|\bVCT\b|\bFLOOR WAXING|\bFLOOR STRIPPING|\bFLOOR CARE|\bFLOOR MAINTENANCE|\bTILE\s*(?:&|AND)\s*GROUT|\bSCRUB\s*(?:&|AND)\s*RECOAT|\bBURNISH/i.test(
      text
    );

  const isCarpet =
    existingNaics === '561740' ||
    /\bCARPET CLEANING|\bCARPET EXTRACTION|\bHOT[- ]?WATER EXTRACTION|\bUPHOLSTERY CLEANING|\bCARPET CARE|\bCARPET LAYING AND CLEANING|561740|910-09/i.test(
      text
    );

  const isJanitorial =
    /\bJANITORIAL|\bCUSTODIAL|\bBUILDING CLEANING|\bFACILITY CLEANING|\bOFFICE CLEANING|\bRESTROOM CLEANING|\bSHELTER CLEANING|\bENVIRONMENTAL CLEANING|\bWINDOW CLEANING|\bCLEANING SERVICES|\bHOUSEKEEPING/i.test(
      text
    );

  const isSoftwareOrWeb =
    existingNaics === '541511' ||
    existingNaics === '541512' ||
    existingNaics === '518210' ||
    /\bSOFTWARE\b|\bWEBSITE\b|\bINTRANET\b|\bWEB\s*(?:APP|PORTAL|PAGE|SITE|DESIGN|DEV|DEVELOPMENT)?\b|\bCUSTOM\s*APPLICATION\b|\bMOBILE\s*APP\b|\bSAAS\b|\bCLOUD\s*(?:APP|HOSTING|DEPLOYMENT|MIGRATION)\b|\bPORTAL\b|\bPERMITTING\s*SYSTEM\b|\bPROGRAMMING\b|\bCODING\b|\bFULL[- ]?STACK\b|541511|541512|518210|920-40|915-96/i.test(
      `${text} ${existingNaics}`
    );

  const isApparelOrUniforms =
    existingNaics === '323113' ||
    existingNaics === '315210' ||
    existingNaics === '8415' ||
    /\bUNIFORM|\bEMBROIDER|\bSCREEN\s*PRINT|\bSILK\s*SCREEN|\bT[- ]?SHIRT|\bAPPAREL|\bWORKWEAR|\bOUTERWEAR|\bSAFETY\s*VEST|\bWORK\s*SHIRT|\bPOLO\s*SHIRT|\bCUSTOM\s*SHIRT|\bGARMENT|\bPROMOTIONAL\s*APPAREL|323113|314999|315210|424350|812331|200-74|200-85|962-78|8415/i.test(
      `${text} ${existingNaics}`
    );

  const gfsServices = [];
  if (isSoftwareOrWeb) gfsServices.push('Software & Web Apps');
  if (isApparelOrUniforms) gfsServices.push('Apparel, Embroidery & Uniforms');
  if (isJanitorial) gfsServices.push('Commercial Janitorial');
  if (isTurnoverOrStr) gfsServices.push('Airbnb / STR & Unit Turnover');
  if (isConstructionOrFinalClean) gfsServices.push('Construction / CSI 01-74-23 Final Clean');
  if (isVctOrTile) gfsServices.push('VCT Strip & Wax / Tile & Grout');
  if (isCarpet) gfsServices.push('Commercial Carpet Extraction');
  if (isMatRental) gfsServices.push('Floor Mat Rental');
  if (isSuppliesOrEquip) gfsServices.push('Supplies & Floor Equipment');

  const hasPositiveMatch = gfsServices.length > 0;

  if (isSoftwareOrWeb && !isJanitorial && !isConstructionOrFinalClean) {
    return {
      hasPositiveMatch: true,
      category: 'SOFTWARE_WEB',
      categoryLabel: 'Software & Web Applications',
      naics: '541511 / 541512',
      psc: 'DA01 / 7A21',
      nigp: '920-40 / 915-96',
      unspsc: '43230000 / 81111500',
      gfsServices: gfsServices.length ? gfsServices : ['Software & Web Apps']
    };
  }

  if (isApparelOrUniforms && !isMatRentalTitle && !isJanitorial) {
    return {
      hasPositiveMatch: true,
      category: 'APPAREL_UNIFORMS',
      categoryLabel: 'Apparel, T-Shirts, Embroidery & Uniforms',
      naics: '323113 / 314999 / 315210',
      psc: '8415',
      nigp: '200-74 / 200-85 / 962-78',
      unspsc: '53100000 / 82121505',
      gfsServices: gfsServices.length ? gfsServices : ['Apparel, Embroidery & Uniforms']
    };
  }

  if (isMatRentalTitle || (isMatRental && !isTurnoverOrStr && !isConstructionOrFinalClean)) {
    return {
      hasPositiveMatch: true,
      category: 'MAT_RENTAL',
      categoryLabel: 'Floor Mat & Mop Rental',
      naics: '812332',
      psc: 'S209',
      nigp: '954-05 / 983-47',
      unspsc: '91111502',
      gfsServices: gfsServices.length ? gfsServices : ['Floor Mat Rental']
    };
  }

  if (isSuppliesOrEquip) {
    const isMachine = /SCRUBBER|BURNISHER|EXTRACTOR|MACHINE|BUFFER/i.test(titleUpper);
    return {
      hasPositiveMatch: true,
      category: 'SUPPLIES_EQUIP',
      categoryLabel: isMachine ? 'Floor Care Equipment' : 'Janitorial Supplies & Chemicals',
      naics: isMachine ? '423850' : '424690',
      psc: isMachine ? '7910' : '7930',
      nigp: isMachine ? '365-10' : '485-54',
      unspsc: isMachine ? '47121600' : '47131800',
      gfsServices: gfsServices.length ? gfsServices : ['Supplies & Floor Equipment']
    };
  }

  if (isTurnoverOrStr) {
    return {
      hasPositiveMatch: true,
      category: 'TURNOVER_STR',
      categoryLabel: /AIRBNB|VRBO|SHORT[- ]?TERM|VACATION/i.test(text)
        ? 'Airbnb / STR Vacation Turnover'
        : 'Apartment / Dorm Make-Ready Turnover',
      naics: '561720',
      psc: 'S201',
      nigp: '910-39',
      unspsc: '76111800',
      gfsServices: gfsServices.length ? gfsServices : ['Airbnb / STR & Unit Turnover']
    };
  }

  if (isConstructionOrFinalClean && !isJanitorial && !isCarpet) {
    const isFloorReplace = /FLOOR|CARPET|EPOXY|STAIR RUNNER/i.test(titleUpper);
    return {
      hasPositiveMatch: true,
      category: 'CONSTRUCTION',
      categoryLabel: isFloorReplace
        ? 'Flooring / Carpet Construction & Final Clean'
        : 'Construction RFP & CSI 01-74-23 Final Clean',
      naics: isFloorReplace ? '238330 / 561720' : '236220 / 561720',
      psc: 'Z2AA / S201',
      nigp: '910-03 / 912-00',
      unspsc: '72101507 / 76111504',
      gfsServices: gfsServices.length ? gfsServices : ['Construction / CSI 01-74-23 Final Clean']
    };
  }

  if (isCarpet || isVctOrTile) {
    return {
      hasPositiveMatch: true,
      category: 'FLOOR_CARE',
      categoryLabel: isVctOrTile && isCarpet
        ? 'Carpet + VCT Strip & Wax'
        : isVctOrTile
        ? 'VCT Strip & Wax / Tile & Grout'
        : 'Commercial Carpet Extraction',
      naics: isCarpet ? '561740' : '561720',
      psc: 'S201',
      nigp: isVctOrTile ? '910-25' : '910-09',
      unspsc: '76111502',
      gfsServices: gfsServices.length ? gfsServices : ['Commercial Carpet Extraction', 'VCT Strip & Wax']
    };
  }

  return {
    hasPositiveMatch,
    category: 'JANITORIAL',
    categoryLabel: 'Commercial Janitorial & Custodial',
    naics: '561720',
    psc: 'S201',
    nigp: '910-39',
    unspsc: '76111501',
    gfsServices: gfsServices.length ? gfsServices : ['Commercial Janitorial']
  };
}

function classifyBiddableStage(noticeType = '', source = '', title = '', desc = '') {
  if (source === 'USASPENDING-OH') return 'RECOMPETE';
  const combined = `${noticeType} ${title} ${desc}`;
  if (/sources\s*sought|request\s*for\s*information|\brfi\b|market\s*research|presolicitation|special\s*notice/i.test(combined)) {
    return 'EARLY_INTEL';
  }
  return 'BID_NOW';
}

function extractWalkthroughInfo(text = '') {
  if (!text) return null;
  const m = text.match(/(?:site\s+visit|walk[- ]?through|pre[- ]?bid\s+(?:conference|meeting|walk))[^.]{0,120}/i);
  if (!m) return null;
  const snippet = m[0].replace(/\s+/g, ' ').trim();
  const isMandatory = /mandatory|required/i.test(snippet);
  return {
    summary: snippet.slice(0, 110),
    mandatory: isMandatory
  };
}

/**
 * Enriches and validates any existing or newly scraped bid record with Guardian Facility Services metadata.
 * Also applies BidNet Origin Unmasking automatically on BIDNET-OH records.
 */
function enrichAndValidateBid(rawBid) {
  if (!rawBid) return null;
  const today = getTodayIso();
  const dueIso = normalizeDateToIso(rawBid.dueDate);
  if (!dueIso || dueIso < today) return null;

  // Reject $0 USASpending recompete awards
  if (rawBid.source === 'USASPENDING-OH' && (!rawBid.estimatedValue || Number(rawBid.estimatedValue) <= 0)) {
    return null;
  }

  let working = { ...rawBid, dueDate: dueIso };

  // Apply BidNet Origin Unmasker if this is a BidNet Ohio record
  if (working.source === 'BIDNET-OH') {
    const solId = String(working.id || '').replace('BIDNET-OH-', '');
    const unmasked = unmaskBidNetOrigin(working.title, working.aiOverview || working.scopeSummary || '', solId);
    working.solicitationNumber = unmasked.solicitationNumber || working.solicitationNumber;
    working.agency = unmasked.agency || working.agency;
    working.city = unmasked.city || working.city;
    working.freePortalUrl = unmasked.freePortalUrl;
    working.freePortalLabel = unmasked.freePortalLabel;
    working.unmaskedNote = unmasked.unmaskedNote;
    if (working.aiOverview) {
      working.scopeSummary = `[BIDNET AI OVERVIEW] ${working.aiOverview}\n\n[ORIGIN INTEL] ${unmasked.unmaskedNote}`;
    } else if (!working.scopeSummary.includes('[ORIGIN INTEL]')) {
      working.scopeSummary = `${working.scopeSummary}\n\n[ORIGIN INTEL] ${unmasked.unmaskedNote}`;
    }
  }

  if (isExcludedNoise(working.title, working.scopeSummary, working.naics, working.psc, working.state)) {
    return null;
  }

  const cls = classifyGfsBid(working.title, working.scopeSummary, working.naics);
  if (!cls.hasPositiveMatch) {
    return null;
  }
  const territory = detectGfsTerritory(
    `${working.title} ${working.agency} ${working.scopeSummary}`,
    working.state || 'OH',
    working.city
  );
  const biddableStage = classifyBiddableStage(
    working.noticeType,
    working.source,
    working.title,
    working.scopeSummary
  );
  const walkthrough = working.walkthroughInfo || extractWalkthroughInfo(working.scopeSummary);

  return {
    ...working,
    category: cls.category,
    categoryLabel: cls.categoryLabel,
    naics: cls.naics,
    psc: cls.psc,
    nigp: cls.nigp,
    unspsc: cls.unspsc,
    gfsServices: cls.gfsServices,
    isGfsTerritory: territory.isGfsTerritory,
    county: territory.county,
    distanceMi: territory.distanceMi,
    ohioRegion: territory.ohioRegion,
    city: territory.city,
    biddableStage,
    walkthroughInfo: walkthrough
  };
}


module.exports = {
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
};
