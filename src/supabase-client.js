// ============================================================
//  ⚠️ 여기에 Supabase 정보를 입력하세요
//  supabase.com → 프로젝트 → Settings → API 에서 복사
// ============================================================
const SUPABASE_URL = 'https://pogrtghqsxryphfkyfgb.supabase.co';
const SUPABASE_ANON_KEY = 'https://eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBvZ3J0Z2hxc3hyeXBoZmt5ZmdiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM4ODUxOTYsImV4cCI6MjA4OTQ2MTE5Nn0.gsIVt5pIuGTOIlCKSjywlM7rdtsuEDnOtqsquWRvZeo';

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
    headers: { ...SB_HEADERS, 'Prefer': 'return=representation' }
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

async function sbInsert(table, data) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}`, {
    method: 'POST',
    headers: { ...SB_HEADERS, 'Prefer': 'return=representation' },
    body: JSON.stringify(data)
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

async function sbUpdate(table, id, data) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}?id=eq.${id}`, {
    method: 'PATCH',
    headers: { ...SB_HEADERS, 'Prefer': 'return=representation' },
    body: JSON.stringify(data)
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

async function sbDelete(table, id) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}?id=eq.${id}`, {
    method: 'DELETE',
    headers: SB_HEADERS
  });
  if (!res.ok) throw new Error(await res.text());
  return true;
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
