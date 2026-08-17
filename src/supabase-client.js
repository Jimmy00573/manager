// ============================================================
//  ⚠️ 여기에 Supabase 정보를 입력하세요
//  supabase.com → 프로젝트 → Settings → API 에서 복사
// ============================================================
const SUPABASE_URL = 'https://pogrtghqsxryphfkyfgb.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBvZ3J0Z2hxc3hyeXBoZmt5ZmdiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM4ODUxOTYsImV4cCI6MjA4OTQ2MTE5Nn0.gsIVt5pIuGTOIlCKSjywlM7rdtsuEDnOtqsquWRvZeo';

// 관리자 PIN (4자리 숫자 — 원하는 번호로 변경하세요)
const ADM_PIN = '3524';

// ============================================================
//  아래는 수정하지 마세요
// ============================================================
const SB_HEADERS = {
  'Content-Type': 'application/json',
  'apikey': SUPABASE_ANON_KEY,
  'Authorization': `Bearer ${SUPABASE_ANON_KEY}`
};

async function sbGet(table, params = '') {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}?${params}`, {
    headers: { ...SB_HEADERS, 'Prefer': 'return=representation' },
    cache: 'no-store'
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

// ★본인이 쓴 변경으로 '다른 곳에서 변경됨' 배너가 뜨면 저장할 때마다 배너가 떠서 못 쓰게 된다.
// 모든 쓰기가 아래 4개 함수를 지나므로, 여기서 한 번만 알려 동기화 기준선을 끌어올린다.
// app.js보다 먼저 로드되므로 optional call — 정의 전이면 그냥 넘어간다.
function _sbNotifyWrite() {
  try { if (typeof _syncMarkSelfWrite === 'function') _syncMarkSelfWrite(); } catch (e) {}
}

async function sbInsert(table, data) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}`, {
    method: 'POST',
    headers: { ...SB_HEADERS, 'Prefer': 'return=representation' },
    body: JSON.stringify(data)
  });
  if (!res.ok) throw new Error(await res.text());
  const json = await res.json();
  if (!Array.isArray(json) || json.length === 0) {
    throw new Error(`sbInsert: ${table} - 삽입된 행 없음 (RLS 차단 또는 거부)`);
  }
  _sbNotifyWrite();
  return json;
}

async function sbUpdate(table, id, data) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}?id=eq.${id}`, {
    method: 'PATCH',
    headers: { ...SB_HEADERS, 'Prefer': 'return=representation' },
    body: JSON.stringify(data)
  });
  if (!res.ok) throw new Error(await res.text());
  const json = await res.json();
  if (!Array.isArray(json) || json.length === 0) {
    throw new Error(`sbUpdate: ${table} id=${id} - 영향받은 행 없음 (RLS 차단 또는 id 불일치)`);
  }
  _sbNotifyWrite();
  return json;
}

async function sbDelete(table, id) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}?id=eq.${id}`, {
    method: 'DELETE',
    headers: SB_HEADERS
  });
  if (!res.ok) throw new Error(await res.text());
  _sbNotifyWrite();
  return true;
}

async function sbDeleteStrict(table, filter) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}?${filter}`, {
    method: 'DELETE',
    headers: { ...SB_HEADERS, 'Prefer': 'return=representation' }
  });
  if (!res.ok) throw new Error(await res.text());
  const json = await res.json();
  if (!Array.isArray(json) || json.length === 0) {
    throw new Error(`sbDeleteStrict: ${table} (${filter}) — 삭제된 행 없음`);
  }
  _sbNotifyWrite();
  return json.length;
}

// 연결 확인
async function testConnection() {
  try {
    await sbGet('farms', 'limit=1');
    return true;
  } catch (e) {
    console.error('Supabase 연결 실패:', e);
    return false;
  }
}
