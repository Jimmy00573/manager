// ============================================================
//  DB 레이어 — Supabase REST API 래퍼
//  각 테이블 CRUD 함수 모음
// ============================================================

// ── 재고 설정 (로컬스토리지 — 테이블 불필요)
function getStockSettings() {
  const s = localStorage.getItem('citrus_stock');
  return s ? JSON.parse(s) : { 노랑: { init: 500 }, 초록: { init: 300 }, 헌콘: { init: 200 } };
}
function saveStockSettings(data) {
  localStorage.setItem('citrus_stock', JSON.stringify(data));
}

// ── 농가
async function dbGetFarms() {
  return sbGet('farms', 'order=name');
}
async function dbInsertFarm(data) {
  const rows = await sbInsert('farms', data);
  return rows[0];
}
async function dbUpdateFarm(id, data) {
  const rows = await sbUpdate('farms', id, data);
  return rows[0];
}
async function dbDeleteFarm(id) {
  return sbDelete('farms', id);
}

// ── 기사
async function dbGetDrivers() {
  return sbGet('drivers', 'order=name');
}
async function dbInsertDriver(data) {
  const rows = await sbInsert('drivers', data);
  return rows[0];
}
async function dbUpdateDriver(id, data) {
  const rows = await sbUpdate('drivers', id, data);
  return rows[0];
}
async function dbDeleteDriver(id) {
  return sbDelete('drivers', id);
}

// ── 배차
async function dbGetDispatches() {
  return sbGet('dispatches', 'order=date.desc,created_at.desc');
}
async function dbInsertDispatch(data) {
  const rows = await sbInsert('dispatches', data);
  return rows[0];
}
async function dbUpdateDispatch(id, data) {
  const rows = await sbUpdate('dispatches', id, data);
  return rows[0];
}
async function dbDeleteDispatch(id) {
  return sbDelete('dispatches', id);
}

// ── 수거
async function dbGetPicks() {
  return sbGet('picks', 'order=date.desc,created_at.desc');
}
async function dbInsertPick(data) {
  const rows = await sbInsert('picks', data);
  return rows[0];
}
async function dbUpdatePick(id, data) {
  const rows = await sbUpdate('picks', id, data);
  return rows[0];
}
async function dbDeletePick(id) {
  return sbDelete('picks', id);
}

// ── 자가 콘테이너 반입
async function dbGetOwnIns() {
  return sbGet('own_ins', 'order=date.desc');
}
async function dbInsertOwnIn(data) {
  const rows = await sbInsert('own_ins', data);
  return rows[0];
}
async function dbUpdateOwnIn(id, data) {
  const rows = await sbUpdate('own_ins', id, data);
  return rows[0];
}
async function dbDeleteOwnIn(id) {
  return sbDelete('own_ins', id);
}

// ── 자가 콘테이너 반납
async function dbGetOwnOuts() {
  return sbGet('own_outs', 'order=date.desc');
}
async function dbInsertOwnOut(data) {
  const rows = await sbInsert('own_outs', data);
  return rows[0];
}
async function dbUpdateOwnOut(id, data) {
  const rows = await sbUpdate('own_outs', id, data);
  return rows[0];
}
async function dbDeleteOwnOut(id) {
  return sbDelete('own_outs', id);
}

// ── 농협 반입
async function dbGetNhfIns() {
  return sbGet('nhf_ins', 'order=date.desc');
}
async function dbInsertNhfIn(data) {
  const rows = await sbInsert('nhf_ins', data);
  return rows[0];
}
async function dbUpdateNhfIn(id, data) {
  const rows = await sbUpdate('nhf_ins', id, data);
  return rows[0];
}
async function dbDeleteNhfIn(id) {
  return sbDelete('nhf_ins', id);
}

// ── 농협 반납
async function dbGetNhfOuts() {
  return sbGet('nhf_outs', 'order=date.desc');
}
async function dbInsertNhfOut(data) {
  const rows = await sbInsert('nhf_outs', data);
  return rows[0];
}
async function dbUpdateNhfOut(id, data) {
  const rows = await sbUpdate('nhf_outs', id, data);
  return rows[0];
}
async function dbDeleteNhfOut(id) {
  return sbDelete('nhf_outs', id);
}

// ── 완료 보고
async function dbGetReports() {
  return sbGet('reports', 'order=date.desc,created_at.desc');
}
async function dbInsertReport(data) {
  const rows = await sbInsert('reports', data);
  return rows[0];
}

// ── 전체 데이터 로드
async function loadAllData() {
  const [farms, drivers, dispatches, picks, ownIns, ownOuts, nhfIns, nhfOuts, reports] = await Promise.all([
    dbGetFarms(),
    dbGetDrivers(),
    dbGetDispatches(),
    dbGetPicks(),
    dbGetOwnIns(),
    dbGetOwnOuts(),
    dbGetNhfIns(),
    dbGetNhfOuts(),
    dbGetReports()
  ]);
  return { farms, drivers, dispatches, picks, ownIns, ownOuts, nhfIns, nhfOuts, reports };
}
