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
// ★왕복 횟수를 줄인다: 첫 페이지에서 전체 건수를 함께 받고, 남은 페이지를 동시에 보낸다.
//   측정(2026-09-22)상 서버 처리는 페이지당 0.04초로 빠르고 느린 건 왕복 횟수다 — 폰(LTE)에서 특히.
async function sbGetAll(table, params = '') {
  const parts = params.split('&').filter(p => p && !/^(limit|offset)=/.test(p));
  const oi = parts.findIndex(p => p.startsWith('order='));
  if (oi < 0) parts.push('order=id');
  else if (!/(^|,)id(\.|,|$)/.test(parts[oi].slice(6))) parts[oi] += ',id';
  const base = parts.join('&');

  // ★첫 페이지만 count=exact로 전체 건수를 함께 받는다. sbGet은 헤더를 바꿀 수 없어 여기서 직접 부른다
  //   (sbGet과 같은 방식 — SB_HEADERS · no-store · !ok면 throw).
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}?${base}&limit=${SB_PAGE}&offset=0`, {
    headers: { ...SB_HEADERS, 'Prefer': 'return=representation,count=exact' },
    cache: 'no-store'
  });
  if (!res.ok) throw new Error(await res.text());
  const first = await res.json();
  if (!Array.isArray(first)) throw new Error(`sbGetAll: ${table} — 배열이 아닌 응답`);
  // 'Content-Range: 0-999/6875' 의 뒷숫자가 전체 건수. 없거나 '*'면 못 쓴다 → 아래 순차 루프로 폴백한다.
  const cr = /\/(\d+)\s*$/.exec(res.headers.get('Content-Range') || '');
  const total = cr ? +cr[1] : null;

  const rows = [];
  const seen = new Set();
  // ★받는 사이에 새 행이 저장되면 페이지 경계가 밀려 같은 행이 두 페이지에 걸칠 수 있다(순차 방식에도 있던 위험).
  //   id로 걸러 먼저 온 것을 남긴다. id가 없는 행은 거르지 않고 그대로 둔다.
  const take = page => {
    for (const r of page) {
      const k = r && r.id;
      if (k == null) { rows.push(r); continue; }
      if (seen.has(k)) continue;
      seen.add(k); rows.push(r);
    }
  };
  take(first);
  if (first.length < SB_PAGE) return rows;

  let off = SB_PAGE;            // 아직 받지 않은 첫 offset
  if (total != null) {
    const offsets = [];
    for (let o = SB_PAGE; o < total; o += SB_PAGE) {
      if (o > 500000) throw new Error(`sbGetAll: ${table} — 50만 행 초과, 중단`);
      offsets.push(o);
    }
    // ★한 페이지라도 실패하면 throw — 반쪽 데이터를 돌려주지 않는다(순차 방식과 같다).
    const pages = await Promise.all(offsets.map(o => sbGet(table, `${base}&limit=${SB_PAGE}&offset=${o}`)));
    for (const p of pages) {
      if (!Array.isArray(p)) throw new Error(`sbGetAll: ${table} — 배열이 아닌 응답`);
      take(p);   // offset 순서 그대로 이어 붙는다(Promise.all은 입력 순서를 지킨다)
    }
    const lastOff = offsets.length ? offsets[offsets.length - 1] : 0;
    const last = offsets.length ? pages[pages.length - 1] : first;
    // 여기서 멈춰도 되는지 두 가지로 본다. 하나라도 걸리면 순차로 이어 받는다.
    //  (1) 모아 놓고 보니 전체 건수보다 적다 = 받는 사이 맨 앞에 행이 끼어 페이지가 밀렸다.
    //      ★건수가 페이지 크기의 배수일 때 이게 없으면 끝 1건을 조용히 놓친다(3,000건에서 확인).
    //  (2) 마지막 페이지가 꽉 찼는데 전체 건수를 넘겨 온다 = 그 뒤에 더 있을 수 있다.
    // 둘 다 아니면 끝 — 배수라 딱 맞아떨어진 경우 빈 페이지를 더 묻지 않는다.
    if (rows.length >= total && !(last.length === SB_PAGE && lastOff + SB_PAGE > total)) return rows;
    off = lastOff + SB_PAGE;
  }

  // 여기부터 순차 — 전체 건수를 못 읽은 경우(폴백)와, 받는 사이에 행이 늘어 더 남은 경우.
  for (; ; off += SB_PAGE) {
    const page = await sbGet(table, `${base}&limit=${SB_PAGE}&offset=${off}`);
    if (!Array.isArray(page)) throw new Error(`sbGetAll: ${table} — 배열이 아닌 응답`);
    take(page);
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
