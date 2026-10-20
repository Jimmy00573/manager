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

// ── 읽기 GET의 CORS 사전 요청(OPTIONS) 없애기(v731) ─────────────────────────
// apikey·Authorization·Prefer·Content-Type(json) 헤더가 붙은 GET은 브라우저가 매번 OPTIONS를 먼저 보낸다(요청 수 2배).
// Supabase는 apikey를 쿼리 파라미터로도 받는다 → 읽기 GET만 헤더 없이 ?apikey=<anon 키>로 보낸다(같은 anon 권한·같은 결과).
// ★안전장치: 쿼리 방식이 401·403·404(인증 이상)로 오면 이 세션 동안 모든 GET을 예전 헤더 방식으로 되돌리고 같은 요청을 1번 다시 보낸다.
//   사용자에게는 아무것도 안 보인다(콘솔 경고 한 줄). ★쓰기(POST·PATCH·DELETE·RPC)와 sbGetAll 첫 페이지(count 헤더)는 그대로 헤더 방식.
let _sbQueryAuthOff = false;
async function _sbReadFetch(url) {
  if (!_sbQueryAuthOff) {
    const res = await fetch(`${url}${url.endsWith('?') ? '' : '&'}apikey=${SUPABASE_ANON_KEY}`, { cache: 'no-store' });
    if (res.status !== 401 && res.status !== 403 && res.status !== 404) return res;
    if (!_sbQueryAuthOff) console.warn(`[sbGet] 쿼리 apikey 방식 GET이 ${res.status} — 이 세션은 헤더 방식으로 되돌립니다.`);
    _sbQueryAuthOff = true;
  }
  return fetch(url, { headers: { ...SB_HEADERS, 'Prefer': 'return=representation' }, cache: 'no-store' });
}

// ── 부팅 작은 표 묶음 조회(v752) — db.js _settingsBootStart/_settingsBootEnd와 같은 방식.
// 왜: 2026-10-14 로그 실측 — 부팅 때 동시에 나가는 요청 30여 개가 줄을 서서 5~20행짜리 작은 표도 p50 약 3초(부팅 밖에서는 0.3초).
//   DB 함수 public.boot_bundle()이 아래 29개 조회 결과를 한 번에 돌려준다(키 = 'table?params', 값 = PostgREST와 같은 행 배열).
// ★부팅 1회용: initApp이 부팅 조회들을 출발시킨 직후 _bootBundleEnd()로 닫는다. sbGet은 '부를 때' 약속을 붙잡고,
//   한 번 꺼낸 키는 지운다 → 그 뒤의 재조회(저장 후 재조회·재고 탭 재진입)는 전부 예전처럼 개별 조회 = 항상 최신.
// ★묶음이 실패했거나 키가 없으면 그 표만 예전 개별 조회로 간다 — 결과·실패 처리는 로더 쪽 그대로.
//   묶음은 서버 함수(json_agg)라 PostgREST 1,000행 상한이 없다 → 행 수와 상관없이 그대로 쓴다(v753).
// ★키 규칙: db.js 로더의 sbGet 파라미터를 바꾸면 DB 함수 boot_bundle의 키도 같이 바꿀 것(migrations/003_boot_bundle.sql).
//   안 바꾸면 그 표만 개별 조회로 돌아간다(안전하지만 느려짐).
const BOOT_BUNDLE_KEYS = new Set([
  'farms?order=name',
  'drivers?order=display_order.asc.nullslast,id.asc',
  'dispatches?order=date.desc,created_at.desc',
  'picks?order=date.desc,created_at.desc',
  'own_ins?order=date.desc',
  'own_outs?order=date.desc',
  'nhf_ins?order=date.desc',
  'nhf_outs?order=date.desc',
  'reports?order=date.desc,created_at.desc',
  'harvests?order=date',
  'vehicles?order=number',
  'storage_locations?order=sort_order,name',
  'partners?order=sort_order.asc,name.asc',
  'manual_transactions?is_void=eq.false&order=date.desc,created_at.desc',
  'container_types?order=sort_order.asc,id.asc',
  'pachi_usages?order=sort_order',
  'brix_grades?order=sort_order',
  'pachi_sizes?order=sort_order',
  'pachi_conditions?order=sort_order',
  'quality_criteria?order=product_name',
  'categories?order=id',
  'size_grades?order=sort_order',
  'items?order=name',
  'item_size_rules?order=item_id,min_su',
  'juice_batches?is_void=eq.false&order=inbound_date.desc,created_at.desc',
  'juice_product_master?is_active=eq.true&order=product_name',
  'processing_records?order=date.desc,created_at.desc',
  'inventory_records?or=(is_void.eq.false,is_void.is.null)&order=date.desc,created_at.desc',
  'inbound_records?select=*,driver:drivers(name,type)&order=date.desc,created_at.desc',
]);
let _bootBundleP = null;
function _bootBundleStart() {
  // GET — _sbReadFetch의 쿼리 apikey 방식이라 사전 요청(OPTIONS)이 없다. 실패해도 throw하지 않고 null(= 전부 개별 조회).
  _bootBundleP = _sbReadFetch(`${SUPABASE_URL}/rest/v1/rpc/boot_bundle?`)
    .then(r => r.ok ? r.json() : null)
    .then(j => (j && typeof j === 'object' && !Array.isArray(j)) ? j : null)
    .catch(() => null);
  return _bootBundleP;
}
function _bootBundleEnd() { _bootBundleP = null; }

async function sbGet(table, params = '') {
  const bp = _bootBundleP, bk = table + '?' + params;   // ★첫 await 전에 붙잡는다 — 부팅 중에 부른 조회만 묶음을 쓴다
  if (bp && BOOT_BUNDLE_KEYS.has(bk)) {
    const b = await bp;
    if (b && Array.isArray(b[bk])) { const rows = b[bk]; delete b[bk]; return rows; }   // 서버 함수라 1,000행 상한 없이 전부 온다(v753)
  }
  const res = await _sbReadFetch(`${SUPABASE_URL}/rest/v1/${table}?${params}`);
  if (!res.ok) throw new Error(await res.text());
  const json = await res.json();
  // ★정확히 1,000행이 왔다 = PostgREST가 오류 없이 잘라서 준 것이다 → sbGetAll로 전체를 다시 받아 돌려준다(v753).
  //   왜: 경고만 남기던 시절엔 잘린 배열이 그대로 화면에 갔다. 2026-10-15 실측 회수 437행·입고 539행 → 약 53~55일 뒤 1,000행
  //   (성수기엔 더 빠름). 넘는 순간 재고·현황이 조용히 틀어지므로 호출처(100곳 이상)를 고치지 않고 여기 한 곳에서 막는다.
  //   limit을 직접 준 조회(sbGetAll의 페이지·더 보기 등)는 의도한 개수이므로 넘어간다.
  // ★무한 반복 없음: sbGetAll은 페이지를 limit=을 붙여 sbGet으로 받으므로 이 조건에 다시 걸리지 않는다.
  // ★이어 받기가 실패하면 예전과 똑같이 1,000행을 돌려준다(더 나빠지지 않게). id 컬럼이 없는 표(settings·op_settings·
  //   morning_plans·product_category_map·sync_deletes)는 sbGetAll의 order=id가 실패할 수 있어 이 경로로 간다 — 실제로 1,000행에 닿을 일은 없다.
  if (Array.isArray(json) && json.length === SB_PAGE && !/(^|&)limit=/.test(params)) {
    console.info(`[sbGet] ${table} 1,000행 도달 — sbGetAll로 전체 받기 (?${params})`);
    try { return await sbGetAll(table, params); }
    catch (e) {
      console.warn(`[sbGet] ${table} 응답이 정확히 ${SB_PAGE}행입니다 — 잘렸을 수 있습니다. sbGetAll 사용을 검토하세요. (?${params}) — 이어 받기 실패: ${e && e.message}`);
      return json;
    }
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

// 쓰기용 RPC(서버 함수) — 여러 쓰기를 한 트랜잭션으로 보낼 때(outbound_batch 등). 실패하면 서버 예외의 message를 던진다.
// ★app.js fetch 래퍼의 _RPC_WRITES에 경로를 넣어야 처리 중 바·버튼 잠금이 켜진다(/rpc/는 기본이 조회 취급).
async function sbRpcWrite(fn, args) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/${fn}`, {
    method: 'POST',
    headers: SB_HEADERS,
    body: JSON.stringify(args)
  });
  if (!res.ok) {
    const text = await res.text();
    let msg = text;
    try { const j = JSON.parse(text); if (j && j.message) msg = j.message; } catch (e) {}
    throw new Error(msg);
  }
  const json = await res.json();
  _sbNotifyWrite();
  return json;
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
