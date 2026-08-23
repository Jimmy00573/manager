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

// ★PostgREST는 한 번에 최대 1,000행만 돌려준다. 오류가 아니라 조용히 잘려서 온다.
const SB_PAGE = 1000;

async function sbGet(table, params = '') {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}?${params}`, {
    headers: { ...SB_HEADERS, 'Prefer': 'return=representation' },
    cache: 'no-store'
  });
  if (!res.ok) throw new Error(await res.text());
  const json = await res.json();
  // ★정확히 1,000행이 왔다 = 잘렸을 가능성이 매우 높다. 조용한 잘림을 다음엔 바로 알아채도록 남긴다.
  //   limit을 직접 준 조회(sbGetAll의 페이지 포함)는 의도한 개수이므로 넘어간다.
  if (Array.isArray(json) && json.length === SB_PAGE && !/(^|&)limit=/.test(params)) {
    console.warn(`[sbGet] ${table} 응답이 정확히 ${SB_PAGE}행입니다 — 잘렸을 수 있습니다. sbGetAll 사용을 검토하세요. (?${params})`);
  }
  return json;
}

// 전량 조회. 1,000행을 넘을 수 있는 테이블은 sbGet 대신 반드시 이 함수를 쓴다.
// ★정렬 안정성: offset 페이지네이션은 순서가 흔들리면 페이지 경계에서 중복·누락이 생긴다.
//   호출자가 준 order 뒤에 id를 덧붙여 순서를 확정한다(uuid라도 결정적이면 충분).
//   보이는 정렬(예: date.desc)은 1차 키 그대로라 화면 순서는 바뀌지 않는다 — 같은 날짜끼리만 순서가 고정될 뿐.
// ★중간 페이지가 실패하면 모자란 배열을 돌려주지 않고 throw한다.
//   '조용히 부족한 데이터'가 애초에 고치려던 문제라, 반쪽을 주느니 실패를 알린다.
async function sbGetAll(table, params = '') {
  const parts = params.split('&').filter(p => p && !/^(limit|offset)=/.test(p));
  const oi = parts.findIndex(p => p.startsWith('order='));
  if (oi < 0) parts.push('order=id');
  else if (!/(^|,)id(\.|,|$)/.test(parts[oi].slice(6))) parts[oi] += ',id';
  const base = parts.join('&');

  const rows = [];
  for (let off = 0; ; off += SB_PAGE) {
    const page = await sbGet(table, `${base}&limit=${SB_PAGE}&offset=${off}`);
    if (!Array.isArray(page)) throw new Error(`sbGetAll: ${table} — 배열이 아닌 응답`);
    rows.push(...page);
    if (page.length < SB_PAGE) return rows;
    if (off >= 500000) throw new Error(`sbGetAll: ${table} — 50만 행 초과, 중단`);
  }
}

// ★본인이 쓴 변경으로 '다른 곳에서 변경됨' 배너가 뜨면 저장할 때마다 배너가 떠서 못 쓰게 된다.
// 모든 쓰기가 아래 4개 함수를 지나므로, 여기서 한 번만 알려 동기화 기준선을 끌어올린다.
// app.js보다 먼저 로드되므로 optional call — 정의 전이면 그냥 넘어간다.
function _sbNotifyWrite() {
  try { if (typeof _syncMarkSelfWrite === 'function') _syncMarkSelfWrite(); } catch (e) {}
}

// db.js의 조회 실패를 app.js 배너(_loadFail)로 넘긴다. app.js보다 먼저 로드되므로 optional call —
// 정의 전이면 그냥 넘어간다(_sbNotifyWrite와 같은 방식).
// ★db.js 조회 함수들은 오류를 catch해서 빈 배열을 돌려주므로, 여기서 알리지 않으면
//   호출부의 .catch가 아예 발동하지 않아 실패가 '데이터 없음'과 구분되지 않는다.
function _sbLoadFail(label) {
  try { if (typeof _loadFail === 'function') _loadFail(label); } catch (e) {}
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
