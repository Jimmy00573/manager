// ============================================================
//  DB 레이어 — Supabase REST API 래퍼
// ============================================================

async function getStockSettings() {
  try {
    const rows = await sbGet('settings', 'key=eq.stock');
    if (rows && rows.length > 0) return rows[0].value;
  } catch (e) {}
  return { 노랑: { init: 500 }, 초록: { init: 300 }, 헌콘: { init: 200 } };
}

async function saveStockSettings(data) {
  try {
    const rows = await sbGet('settings', 'key=eq.stock');
    if (rows && rows.length > 0) {
      await fetch(`${SUPABASE_URL}/rest/v1/settings?key=eq.stock`, {
        method: 'PATCH',
        headers: { ...SB_HEADERS, 'Prefer': 'return=representation' },
        body: JSON.stringify({ value: data, updated_at: new Date().toISOString() })
      });
    } else {
      await sbInsert('settings', { key: 'stock', value: data });
    }
  } catch (e) { console.error('설정 저장 오류:', e); }
}

async function dbGetFarms() { return sbGet('farms', 'order=name'); }
async function dbInsertFarm(data) { const r = await sbInsert('farms', data); return r[0]; }
async function dbUpdateFarm(id, data) { const r = await sbUpdate('farms', id, data); return r[0]; }
async function dbDeleteFarm(id) { return sbDelete('farms', id); }

async function dbGetDrivers() { return sbGet('drivers', 'order=name'); }
async function dbInsertDriver(data) { const r = await sbInsert('drivers', data); return r[0]; }
async function dbUpdateDriver(id, data) { const r = await sbUpdate('drivers', id, data); return r[0]; }
async function dbDeleteDriver(id) { return sbDelete('drivers', id); }

async function dbGetDispatches() { return sbGet('dispatches', 'order=date.desc,created_at.desc'); }
async function dbInsertDispatch(data) { const r = await sbInsert('dispatches', data); return r[0]; }
async function dbUpdateDispatch(id, data) { const r = await sbUpdate('dispatches', id, data); return r[0]; }
async function dbDeleteDispatch(id) { return sbDelete('dispatches', id); }

async function dbGetPicks() { return sbGet('picks', 'order=date.desc,created_at.desc'); }
async function dbInsertPick(data) { const r = await sbInsert('picks', data); return r[0]; }
async function dbUpdatePick(id, data) { const r = await sbUpdate('picks', id, data); return r[0]; }
async function dbDeletePick(id) { return sbDelete('picks', id); }

async function dbGetOwnIns() { return sbGet('own_ins', 'order=date.desc'); }
async function dbInsertOwnIn(data) { const r = await sbInsert('own_ins', data); return r[0]; }
async function dbUpdateOwnIn(id, data) { const r = await sbUpdate('own_ins', id, data); return r[0]; }
async function dbDeleteOwnIn(id) { return sbDelete('own_ins', id); }

async function dbGetOwnOuts() { return sbGet('own_outs', 'order=date.desc'); }
async function dbInsertOwnOut(data) { const r = await sbInsert('own_outs', data); return r[0]; }
async function dbUpdateOwnOut(id, data) { const r = await sbUpdate('own_outs', id, data); return r[0]; }
async function dbDeleteOwnOut(id) { return sbDelete('own_outs', id); }

async function dbGetNhfIns() { return sbGet('nhf_ins', 'order=date.desc'); }
async function dbInsertNhfIn(data) { const r = await sbInsert('nhf_ins', data); return r[0]; }
async function dbUpdateNhfIn(id, data) { const r = await sbUpdate('nhf_ins', id, data); return r[0]; }
async function dbDeleteNhfIn(id) { return sbDelete('nhf_ins', id); }

async function dbGetNhfOuts() { return sbGet('nhf_outs', 'order=date.desc'); }
async function dbInsertNhfOut(data) { const r = await sbInsert('nhf_outs', data); return r[0]; }
async function dbUpdateNhfOut(id, data) { const r = await sbUpdate('nhf_outs', id, data); return r[0]; }
async function dbDeleteNhfOut(id) { return sbDelete('nhf_outs', id); }

async function dbGetReports() { return sbGet('reports', 'order=date.desc,created_at.desc'); }
async function dbInsertReport(data) { const r = await sbInsert('reports', data); return r[0]; }

async function loadAllData() {
  const [farms, drivers, dispatches, picks, ownIns, ownOuts, nhfIns, nhfOuts, reports, stockData] = await Promise.all([
    dbGetFarms(), dbGetDrivers(), dbGetDispatches(), dbGetPicks(),
    dbGetOwnIns(), dbGetOwnOuts(), dbGetNhfIns(), dbGetNhfOuts(),
    dbGetReports(), getStockSettings()
  ]);
  return { farms, drivers, dispatches, picks, ownIns, ownOuts, nhfIns, nhfOuts, reports, stockData };
}
