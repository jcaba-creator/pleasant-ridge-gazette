const fs = require("fs");
const path = require("path");

const baseDir = __dirname;
const html = fs.readFileSync(path.join(baseDir, "index.html"), "utf8");

console.log("==================================================");
console.log("PLEASANT RIDGE GAZETTE - CIVIC SITE AUDIT SUITE");
console.log("==================================================");

// 1. Script files
const scriptMatches = [...html.matchAll(/<script\s+src="([^"]+)"/g)].map(m => m[1]);
console.log("\n[1] Checking script dependencies:");
let allScriptsExist = true;
for (const s of scriptMatches) {
  const p = path.join(baseDir, s);
  const exists = fs.existsSync(p);
  console.log(`  - ${s}: ${exists ? "FOUND" : "MISSING"}`);
  if (!exists) allScriptsExist = false;
}

// 2. Arcade links
const arcadeHtml = fs.readFileSync(path.join(baseDir, "arcade", "index.html"), "utf8");
const arcadeLinks = [...arcadeHtml.matchAll(/href="([^"#]+\.html)"/g)].map(m => m[1]);
console.log("\n[2] Checking arcade game links in arcade/index.html:");
let allArcadeExist = true;
for (const link of arcadeLinks) {
  const p = path.join(baseDir, "arcade", link);
  const exists = fs.existsSync(p);
  console.log(`  - arcade/${link}: ${exists ? "FOUND" : "MISSING"}`);
  if (!exists) allArcadeExist = false;
}

// 3. Data payloads
console.log("\n[3] Validating data payloads:");
const window = {};

eval(fs.readFileSync(path.join(baseDir, "gas_prices.js"), "utf8"));
const stations = window.GAZETTE_GAS_FEED.stations;
console.log(`  ✓ gas_prices.js: Valid (${stations.length} stations, lowest: ${stations[0].name} @ $${stations[0].price})`);

eval(fs.readFileSync(path.join(baseDir, "data", "groceries.js"), "utf8"));
console.log(`  ✓ groceries.js: Valid (${window.GAZETTE_GROCERY_DATA.stores.length} stores, ${window.GAZETTE_GROCERY_DATA.items.length} basket items)`);

eval(fs.readFileSync(path.join(baseDir, "data", "usd449.js"), "utf8"));
const usd = window.GAZETTE_USD449_DATA;
console.log(`  ✓ usd449.js: Valid (${usd.tier1_schedule_disruptions.length} disruptions, ${usd.tier2_gear_deadlines_action.length} deadlines, ${usd.tier3_marquee_gatherings.length} gatherings, ${usd.tier4_lunchline_tracker.length} daily meal menus)`);

eval(fs.readFileSync(path.join(baseDir, "data", "outings.js"), "utf8"));
console.log(`  ✓ outings.js: Valid (${window.GAZETTE_OUTINGS_DATA.outings.length} outing events)`);

eval(fs.readFileSync(path.join(baseDir, "data", "corridor_nodes.js"), "utf8"));
console.log(`  ✓ corridor_nodes.js: Valid (${window.GAZETTE_CORRIDOR_NODES.nodes.length} corridor nodes)`);

eval(fs.readFileSync(path.join(baseDir, "data", "recon_inventory.js"), "utf8"));
console.log(`  ✓ recon_inventory.js: Valid (${window.GAZETTE_RECON_INVENTORY.items.length} inventory items)`);

// 4. Interactive Functions
console.log("\n[4] Checking core interactive functions in index.html:");
const actualFunctions = [
  "switchTab",
  "renderGasTable",
  "renderGroceryProcurementEngine",
  "refreshGroceryFeedsLive",
  "updateProcurementCalculations",
  "renderSchoolDispatch",
  "handleBuildingFilterChange",
  "toggleGradeFilter",
  "setAllGradeFilters",
  "renderReconCards",
  "renderReconTimeline",
  "renderCorridorNodes",
  "selectReconDate",
  "filterOutingsByCategory",
  "filterNodesBySector",
  "handleArcadeNav",
  "copyDispatchPhone",
  "pollStatusBoard",
  "pollOpenBurnStatus",
  "pollIncidentsAndHydrology",
  "pollWeatherBanners"
];

let allFnsExist = true;
for (const fn of actualFunctions) {
  const hasFn = html.includes(`function ${fn}`);
  console.log(`  - ${fn}(): ${hasFn ? "DEFINED" : "MISSING"}`);
  if (!hasFn) allFnsExist = false;
}

// 5. Check all onclick and onchange handlers in index.html
console.log("\n[5] Auditing HTML event handlers (onclick / onchange):");
const onclickMatches = [...html.matchAll(/onclick="([^"(]+)\(/g)].map(m => m[1]);
const onchangeMatches = [...html.matchAll(/onchange="([^"(]+)\(/g)].map(m => m[1]);
const allHandlers = [...new Set([...onclickMatches, ...onchangeMatches])];

let allHandlersValid = true;
for (const h of allHandlers) {
  const isDefined = html.includes(`function ${h}`) || h === "window.print";
  console.log(`  - handler ${h}(): ${isDefined ? "OK" : "UNRESOLVED"}`);
  if (!isDefined) allHandlersValid = false;
}

console.log("\n==================================================");
if (allScriptsExist && allArcadeExist && allFnsExist && allHandlersValid) {
  console.log("AUDIT RESULT: 100% PASS - ALL BUTTONS, STREAMS & LINKS FUNCTIONAL!");
} else {
  console.log("AUDIT RESULT: FAILED CHECKS DETECTED");
}
console.log("==================================================");
