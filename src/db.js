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
  const [farms, drivers, dispatches, picks, ownIns, ownOuts, nhfIns, nhfOuts, reports, stockData, harvests, vehicles] = await Promise.all([
    dbGetFarms(), dbGetDrivers(), dbGetDispatches(), dbGetPicks(),
    dbGetOwnIns(), dbGetOwnOuts(), dbGetNhfIns(), dbGetNhfOuts(),
    dbGetReports(), getStockSettings(), dbGetHarvests(), dbGetVehicles()
  ]);
  return { farms, drivers, dispatches, picks, ownIns, ownOuts, nhfIns, nhfOuts, reports, stockData, harvests, vehicles };
}

async function dbGetVehicles() { try { return await sbGet('vehicles', 'order=number'); } catch(e) { return []; } }
async function dbInsertVehicle(data) { const r = await sbInsert('vehicles', data); return r[0]; }
async function dbUpdateVehicle(id, data) { const r = await sbUpdate('vehicles', id, data); return r[0]; }
async function dbDeleteVehicle(id) { return sbDelete('vehicles', id); }
// ── 수확 일정
async function dbGetHarvests() { return sbGet('harvests', 'order=date'); }
async function dbInsertHarvest(data) { const r = await sbInsert('harvests', data); return r[0]; }
async function dbUpdateHarvest(id, data) { const r = await sbUpdate('harvests', id, data); return r[0]; }
async function dbDeleteHarvest(id) { return sbDelete('harvests', id); }

// ── 재고: 선과 크기 설정
async function loadSizeConfig() {
  try {
    const rows = await sbGet('settings', 'key=eq.inv_size_config');
    if (rows && rows.length > 0) return rows[0].value || {};
  } catch(e) {}
  return {};
}
async function saveSizeConfig(data) {
  const rows = await sbGet('settings', 'key=eq.inv_size_config');
  if (rows && rows.length > 0) {
    await fetch(`${SUPABASE_URL}/rest/v1/settings?key=eq.inv_size_config`, {
      method: 'PATCH',
      headers: { ...SB_HEADERS, 'Prefer': 'return=representation' },
      body: JSON.stringify({ value: data, updated_at: new Date().toISOString() })
    });
  } else {
    await sbInsert('settings', { key: 'inv_size_config', value: data });
  }
}

// ── 재고: 미선과
async function dbGetUnsorted(date) {
  const q = date ? `date=eq.${date}&order=created_at.desc` : 'order=date.desc,created_at.desc';
  try { return await sbGet('inventory_unsorted', q); } catch(e) { return []; }
}
async function dbInsertUnsorted(data) { const r = await sbInsert('inventory_unsorted', data); return r[0]; }
async function dbUpdateUnsorted(id, data) { const r = await sbUpdate('inventory_unsorted', id, data); return r[0]; }
async function dbDeleteUnsorted(id) { return sbDelete('inventory_unsorted', id); }

// ── 재고: 선과
async function dbGetSorted(date) {
  const q = date ? `date=eq.${date}&order=created_at.desc` : 'order=date.desc,created_at.desc';
  try { return await sbGet('inventory_sorted', q); } catch(e) { return []; }
}
async function dbInsertSorted(data) { const r = await sbInsert('inventory_sorted', data); return r[0]; }
async function dbUpdateSorted(id, data) { const r = await sbUpdate('inventory_sorted', id, data); return r[0]; }
async function dbDeleteSorted(id) { return sbDelete('inventory_sorted', id); }

// ── 재고: 파치
async function dbGetWaste(date) {
  const q = date ? `date=eq.${date}&order=created_at.desc` : 'order=date.desc,created_at.desc';
  try { return await sbGet('inventory_waste', q); } catch(e) { return []; }
}
async function dbInsertWaste(data) { const r = await sbInsert('inventory_waste', data); return r[0]; }
async function dbDeleteWaste(id) { return sbDelete('inventory_waste', id); }

// ── 재고: 주스/청
async function dbGetJuice(date) {
  const q = date ? `date=eq.${date}&order=created_at.desc` : 'order=date.desc,created_at.desc';
  try { return await sbGet('inventory_juice', q); } catch(e) { return []; }
}
async function dbInsertJuice(data) { const r = await sbInsert('inventory_juice', data); return r[0]; }
async function dbUpdateJuice(id, data) { const r = await sbUpdate('inventory_juice', id, data); return r[0]; }
async function dbDeleteJuice(id) { return sbDelete('inventory_juice', id); }
