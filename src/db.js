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
  const rows = await sbGet('settings', 'key=eq.stock');
  if (rows && rows.length > 0) {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/settings?key=eq.stock`, {
      method: 'PATCH',
      headers: { ...SB_HEADERS, 'Prefer': 'return=representation' },
      body: JSON.stringify({ value: data, updated_at: new Date().toISOString() })
    });
    if (!res.ok) throw new Error(`재고 설정 저장 실패: HTTP ${res.status}`);
    const json = await res.json();
    if (!Array.isArray(json) || json.length === 0) throw new Error('재고 설정 저장 실패: 영향받은 행 없음 (RLS 또는 조건 불일치)');
  } else {
    await sbInsert('settings', { key: 'stock', value: data });
  }
}

async function dbGetFarms() { return sbGet('farms', 'order=name'); }
async function dbInsertFarm(data) { const r = await sbInsert('farms', data); return r[0]; }
async function dbUpdateFarm(id, data) { const r = await sbUpdate('farms', id, data); return r[0]; }
async function dbDeleteFarm(id) { return sbDelete('farms', id); }

async function dbGetDrivers() { return sbGet('drivers', 'order=display_order.asc.nullslast,id.asc'); }
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
// ── 위치 마스터
async function dbGetLocations() { try { return await sbGet('storage_locations', 'order=sort_order,name'); } catch(e) { return []; } }
async function dbInsertLocation(data) { const r = await sbInsert('storage_locations', data); return r[0]; }
async function dbUpdateLocation(id, data) { const r = await sbUpdate('storage_locations', id, data); return r[0]; }
async function dbDeleteLocation(id) { return sbDelete('storage_locations', id); }

// ── 거래처
async function dbGetPartners() { try { return await sbGet('partners', 'order=sort_order.asc,name.asc'); } catch(e) { return []; } }
async function dbInsertPartner(data) { const r = await sbInsert('partners', data); return r[0]; }
async function dbUpdatePartner(id, data) { const r = await sbUpdate('partners', id, data); return r[0]; }
async function dbDeletePartner(id) { return await sbDelete('partners', id); }

// ── 수동 거래내역 (정산 참고용, 재고 무관 순수 기록)
async function dbGetManualTransactions() { try { return await sbGet('manual_transactions', 'is_void=eq.false&order=date.desc,created_at.desc'); } catch(e) { return []; } }
async function dbInsertManualTransaction(data) { const r = await sbInsert('manual_transactions', data); return r[0]; }
async function dbUpdateManualTransaction(id, data) { const r = await sbUpdate('manual_transactions', id, data); return r[0]; }
async function dbVoidManualTransaction(id) { return sbUpdate('manual_transactions', id, { is_void: true }); }   // soft delete

// ── 콘테이너 종류 마스터 (owner: ours 우리것 / others 남의것)
async function dbGetContainerTypes() { try { return await sbGet('container_types', 'order=sort_order.asc,id.asc'); } catch(e) { return []; } }
async function dbInsertContainerType(data) { const r = await sbInsert('container_types', data); return r[0]; }
async function dbUpdateContainerType(id, data) { const r = await sbUpdate('container_types', id, data); return r[0]; }
async function dbDeleteContainerType(id) { return sbDelete('container_types', id); }

// ── 파치 사용처
async function dbGetPachiUsages() { try { return await sbGet('pachi_usages', 'order=sort_order'); } catch(e) { return []; } }
async function dbInsertPachiUsage(data) { const r = await sbInsert('pachi_usages', data); return r[0]; }
async function dbUpdatePachiUsage(id, data) { const r = await sbUpdate('pachi_usages', id, data); return r[0]; }
async function dbDeletePachiUsage(id) { return sbDelete('pachi_usages', id); }

// ── 당도(브릭스) 등급 마스터
async function dbGetBrixGrades() { try { return await sbGet('brix_grades', 'order=sort_order'); } catch(e) { return []; } }
async function dbInsertBrixGrade(data) { const r = await sbInsert('brix_grades', data); return r[0]; }
async function dbUpdateBrixGrade(id, data) { const r = await sbUpdate('brix_grades', id, data); return r[0]; }
async function dbDeleteBrixGrade(id) { return sbDelete('brix_grades', id); }

// 파치 크기 마스터 (pachi_sizes) — 브릭스 등급 패턴 복제
async function dbGetPachiSizes() { try { return await sbGet('pachi_sizes', 'order=sort_order'); } catch(e) { return []; } }
async function dbInsertPachiSize(data) { const r = await sbInsert('pachi_sizes', data); return r[0]; }
async function dbUpdatePachiSize(id, data) { const r = await sbUpdate('pachi_sizes', id, data); return r[0]; }
async function dbDeletePachiSize(id) { return sbDelete('pachi_sizes', id); }

// 파치 상태 마스터 (pachi_conditions) — 브릭스 등급 패턴 복제
async function dbGetPachiConditions() { try { return await sbGet('pachi_conditions', 'order=sort_order'); } catch(e) { return []; } }
async function dbInsertPachiCondition(data) { const r = await sbInsert('pachi_conditions', data); return r[0]; }
async function dbUpdatePachiCondition(id, data) { const r = await sbUpdate('pachi_conditions', id, data); return r[0]; }
async function dbDeletePachiCondition(id) { return sbDelete('pachi_conditions', id); }

// ── 품질 기준
async function dbGetQualityCriteria() { try { return await sbGet('quality_criteria', 'order=product_name'); } catch(e) { return []; } }
async function dbInsertQualityCriteria(data) { const r = await sbInsert('quality_criteria', data); return r[0]; }
async function dbUpdateQualityCriteria(id, data) { const r = await sbUpdate('quality_criteria', id, data); return r[0]; }
async function dbDeleteQualityCriteria(id) { return sbDelete('quality_criteria', id); }

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
    const res = await fetch(`${SUPABASE_URL}/rest/v1/settings?key=eq.inv_size_config`, {
      method: 'PATCH',
      headers: { ...SB_HEADERS, 'Prefer': 'return=representation' },
      body: JSON.stringify({ value: data, updated_at: new Date().toISOString() })
    });
    if (!res.ok) throw new Error(`선과 기준 저장 실패: HTTP ${res.status}`);
    const json = await res.json();
    if (!Array.isArray(json) || json.length === 0) throw new Error('선과 기준 저장 실패: 영향받은 행 없음 (RLS 또는 조건 불일치)');
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

// ── 재고: juice_records (신규)
async function dbGetJuiceRecords() {
  try { return await sbGet('juice_records', 'is_void=eq.false&order=date.desc,created_at.desc'); } catch(e) { return []; }
}
async function dbInsertJuiceRecord(data) { const r = await sbInsert('juice_records', data); return r[0]; }
async function dbDeleteJuiceRecord(id) { return sbUpdate('juice_records', id, { is_void: true }); }

// ── 재고: juice_batches
async function dbGetJuiceBatches() {
  try { return await sbGet('juice_batches', 'is_void=eq.false&order=inbound_date.desc,created_at.desc'); } catch(e) { return []; }
}
async function dbInsertJuiceBatch(data) { const r = await sbInsert('juice_batches', data); return r[0]; }

// ── 재고: juice_product_master
async function dbGetJuiceMasters() {
  try { return await sbGet('juice_product_master', 'is_active=eq.true&order=product_name'); } catch(e) { return []; }
}
async function dbInsertJuiceMaster(data) { const r = await sbInsert('juice_product_master', data); return r[0]; }
async function dbUpdateJuiceMaster(id, data) { const r = await sbUpdate('juice_product_master', id, data); return r[0]; }
async function dbDeleteJuiceMaster(id) { return await sbDelete('juice_product_master', id); }

// ── 카테고리 시스템
async function dbGetCategories() { try { return await sbGet('categories', 'order=id'); } catch(e) { return []; } }
async function dbInsertCategory(data) { const r = await sbInsert('categories', data); return r[0]; }
async function dbUpdateCategory(id, data) { const r = await sbUpdate('categories', id, data); return r[0]; }
async function dbDeleteCategory(id) { return sbDelete('categories', id); }

async function dbGetSizeGrades() { try { return await sbGet('size_grades', 'order=sort_order'); } catch(e) { return []; } }
async function dbInsertSizeGrade(data) { const r = await sbInsert('size_grades', data); return r[0]; }
async function dbUpdateSizeGrade(id, data) { const r = await sbUpdate('size_grades', id, data); return r[0]; }
async function dbDeleteSizeGrade(id) { return sbDelete('size_grades', id); }

async function dbGetItems() { try { return await sbGet('items', 'order=name'); } catch(e) { return []; } }
async function dbInsertItem(data) { const r = await sbInsert('items', data); return r[0]; }
async function dbUpdateItem(id, data) { const r = await sbUpdate('items', id, data); return r[0]; }
async function dbDeleteItem(id) { return sbDelete('items', id); }

async function dbGetItemSizeRules() { try { return await sbGet('item_size_rules', 'order=item_id,min_su'); } catch(e) { return []; } }
async function dbInsertItemSizeRule(data) { const r = await sbInsert('item_size_rules', data); return r[0]; }
async function dbUpdateItemSizeRule(id, data) { const r = await sbUpdate('item_size_rules', id, data); return r[0]; }
async function dbDeleteItemSizeRule(id) { return sbDelete('item_size_rules', id); }

async function loadCategorySystem() {
  const [cats, grades, itemList, rules] = await Promise.all([
    dbGetCategories(), dbGetSizeGrades(), dbGetItems(), dbGetItemSizeRules()
  ]);
  return { cats, grades, itemList, rules };
}

// ── 입고 기록
async function dbGetInbounds() {
  return sbGet('inbound_records', 'select=*,driver:drivers(name,type)&order=date.desc,created_at.desc');
}
async function dbInsertInbound(data) { const r = await sbInsert('inbound_records', data); return r[0]; }
async function dbUpdateInbound(id, data) { const r = await sbUpdate('inbound_records', id, data); return r[0]; }
async function dbDeleteInbound(id) { return sbDelete('inbound_records', id); }

// ── 처리 기록
async function dbGetProcessings() {
  return sbGet('processing_records', 'order=date.desc,created_at.desc');
}
async function dbInsertProcessing(data) { const r = await sbInsert('processing_records', data); return r[0]; }
async function dbDeleteProcessing(id) { return sbDelete('processing_records', id); }

// ── 수정 이력
async function dbInsertAuditLog(data) { return sbInsert('audit_logs', data); }
async function dbGetAuditLogs(limit = 100, offset = 0) {
  try { return await sbGet('audit_logs', `order=created_at.desc&limit=${limit}&offset=${offset}`); }
  catch(e) { return []; }
}
async function dbGetAuditLogsForRecord(targetTable, targetId) {
  try { return await sbGet('audit_logs', `target_table=eq.${targetTable}&target_id=eq.${targetId}&order=created_at.asc`); }
  catch(e) { return []; }
}

// ── 재고 기록
async function dbGetInventoryRecords() {
  try { return await sbGet('inventory_records', 'or=(is_void.eq.false,is_void.is.null)&order=date.desc,created_at.desc'); }
  catch(e) { return []; }
}
async function dbInsertInventoryRecord(data) { const r = await sbInsert('inventory_records', data); return r[0]; }
async function dbInsertOutboundRecord(data) { const r = await sbInsert('outbound_records', data); return r[0]; }
async function dbUpdateInventoryRecord(id, data) { const r = await sbUpdate('inventory_records', id, data); return r[0]; }
async function dbDeleteInventoryRecord(id) { return sbDelete('inventory_records', id); }

// ── 선과 결과 조회
async function dbGetSortingResults(inboundIds) {
  if (!inboundIds.length) return [];
  const q = `inbound_record_id=in.(${inboundIds.join(',')})&order=sorting_date.desc,sequence_number.desc`;
  try { return await sbGet('sorting_results', q); } catch(e) { return []; }
}
async function dbGetSortingDetails(resultIds) {
  if (!resultIds.length) return [];
  const q = `sorting_result_id=in.(${resultIds.join(',')})`;
  try { return await sbGet('sorting_details', q); } catch(e) { return []; }
}
