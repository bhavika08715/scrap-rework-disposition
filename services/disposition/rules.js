// CO1/CO4: Pure decision logic (easy to unit test). Scrap vs Rework.
const CATALOG = {            // rework cost as fraction of unit value; null = not reworkable
  surface_scratch: 0.08, dimensional_oversize: 0.15, wrong_assembly: 0.10,
  weld_porosity: 0.35, crack: null, material_defect: null,
};
const SALVAGE_PCT = 0.10, REWORK_MAX_RATIO = 0.6, APPROVAL_LOSS_LIMIT = 10000;

function decide({ defectType, severity, unitValue, quantity }) {
  const value = unitValue * quantity;
  const scrapLoss = +(value * (1 - SALVAGE_PCT)).toFixed(2);
  const pct = CATALOG[defectType];
  let reworkCost = null, decision, rationale;

  if (pct === null || pct === undefined) {
    decision = 'SCRAP'; rationale = `${defectType} cannot be reworked`;
  } else {
    reworkCost = +(value * pct * (1 + (severity - 1) * 0.25)).toFixed(2);
    if (severity >= 5) { decision = 'SCRAP'; rationale = 'severity 5 is a safety risk; rework not permitted'; }
    else if (reworkCost <= scrapLoss * REWORK_MAX_RATIO) { decision = 'REWORK'; rationale = `rework cost ${reworkCost} is within ${REWORK_MAX_RATIO * 100}% of scrap loss ${scrapLoss}`; }
    else { decision = 'SCRAP'; rationale = `rework cost ${reworkCost} too high vs scrap loss ${scrapLoss}`; }
  }
  const requiresApproval = decision === 'SCRAP' && scrapLoss > APPROVAL_LOSS_LIMIT;
  return { decision, reworkCost, scrapLoss, rationale, requiresApproval };
}
module.exports = { decide };
