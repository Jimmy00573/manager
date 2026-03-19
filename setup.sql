-- ============================================================
--  감귤 수송·콘테이너 통합 관리 — Supabase 테이블 생성
--  사용법: Supabase > SQL Editor > 전체 복사 > Run
-- ============================================================

-- 1. 농가 테이블
CREATE TABLE IF NOT EXISTS farms (
  id          BIGSERIAL PRIMARY KEY,
  name        TEXT NOT NULL,
  tel         TEXT,
  addr        TEXT,
  variety     TEXT,
  contract    INTEGER DEFAULT 0,
  staff       TEXT,
  memo        TEXT,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- 2. 기사 테이블
CREATE TABLE IF NOT EXISTS drivers (
  id          BIGSERIAL PRIMARY KEY,
  name        TEXT NOT NULL,
  tel         TEXT NOT NULL,
  car         TEXT,
  type        TEXT DEFAULT '내부',   -- '내부' | '외부'
  note        TEXT,
  pin         TEXT NOT NULL,          -- 4자리 숫자 PIN
  pin_active  BOOLEAN DEFAULT TRUE,   -- FALSE = 차단(퇴사)
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- 3. 배차 테이블
CREATE TABLE IF NOT EXISTS dispatches (
  id          BIGSERIAL PRIMARY KEY,
  date        DATE NOT NULL,
  farm        TEXT NOT NULL,
  driver      TEXT NOT NULL,
  dtel        TEXT,
  car         TEXT,
  qty         INTEGER NOT NULL,
  ctype       TEXT NOT NULL,          -- '노랑' | '초록' | '헌콘'
  harvest     DATE,                   -- 수확 예정일
  item        TEXT,                   -- 품목
  note        TEXT,
  status      TEXT DEFAULT '배차완료', -- '배차완료' | '배출완료'
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- 4. 수거/배출 기록 테이블
CREATE TABLE IF NOT EXISTS picks (
  id          BIGSERIAL PRIMARY KEY,
  date        DATE NOT NULL,
  farm        TEXT NOT NULL,
  type        TEXT NOT NULL,          -- '배출' | '원물수거' | '잉여회수'
  qty         INTEGER NOT NULL,
  driver      TEXT,
  car         TEXT,
  note        TEXT,
  dispatch_id BIGINT REFERENCES dispatches(id) ON DELETE SET NULL,
  auto        BOOLEAN DEFAULT FALSE,  -- 배차 등록 시 자동 생성 여부
  updated_at  TIMESTAMPTZ,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- 5. 농가 자가 콘테이너 반입
CREATE TABLE IF NOT EXISTS own_ins (
  id          BIGSERIAL PRIMARY KEY,
  date        DATE NOT NULL,
  farm        TEXT NOT NULL,
  qty         INTEGER NOT NULL,
  desc        TEXT,                   -- 콘테이너 특징
  staff       TEXT,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- 6. 농가 자가 콘테이너 반납
CREATE TABLE IF NOT EXISTS own_outs (
  id          BIGSERIAL PRIMARY KEY,
  date        DATE NOT NULL,
  farm        TEXT NOT NULL,
  qty         INTEGER NOT NULL,
  method      TEXT,                   -- 반납 방법
  desc        TEXT,                   -- 콘테이너 특징
  staff       TEXT,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- 7. 농협 용기 반입
CREATE TABLE IF NOT EXISTS nhf_ins (
  id          BIGSERIAL PRIMARY KEY,
  date        DATE NOT NULL,
  nhf         TEXT NOT NULL,          -- 농협명·지점
  type        TEXT NOT NULL,          -- 콘테이너 / 파렛트 / 사각 등
  desc        TEXT,                   -- 용기 특징
  qty         INTEGER NOT NULL,
  goods       TEXT,                   -- 구매 내용
  staff       TEXT,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- 8. 농협 용기 반납
CREATE TABLE IF NOT EXISTS nhf_outs (
  id          BIGSERIAL PRIMARY KEY,
  date        DATE NOT NULL,
  nhf         TEXT NOT NULL,
  type        TEXT NOT NULL,
  method      TEXT,                   -- 반납 방법
  desc        TEXT,
  qty         INTEGER NOT NULL,
  staff       TEXT,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- 9. 완료 보고
CREATE TABLE IF NOT EXISTS reports (
  id          BIGSERIAL PRIMARY KEY,
  date        DATE NOT NULL,
  driver      TEXT NOT NULL,
  farm        TEXT NOT NULL,
  qty         INTEGER NOT NULL,
  note        TEXT,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
--  RLS (Row Level Security) 설정
--  anon key로 모든 테이블에 읽기/쓰기 허용
--  (실제 운영 시 더 엄격한 정책 권장)
-- ============================================================

ALTER TABLE farms ENABLE ROW LEVEL SECURITY;
ALTER TABLE drivers ENABLE ROW LEVEL SECURITY;
ALTER TABLE dispatches ENABLE ROW LEVEL SECURITY;
ALTER TABLE picks ENABLE ROW LEVEL SECURITY;
ALTER TABLE own_ins ENABLE ROW LEVEL SECURITY;
ALTER TABLE own_outs ENABLE ROW LEVEL SECURITY;
ALTER TABLE nhf_ins ENABLE ROW LEVEL SECURITY;
ALTER TABLE nhf_outs ENABLE ROW LEVEL SECURITY;
ALTER TABLE reports ENABLE ROW LEVEL SECURITY;

-- 모든 테이블 전체 접근 허용 (anon)
CREATE POLICY "allow_all_farms"      ON farms      FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY "allow_all_drivers"    ON drivers    FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY "allow_all_dispatches" ON dispatches FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY "allow_all_picks"      ON picks      FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY "allow_all_own_ins"    ON own_ins    FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY "allow_all_own_outs"   ON own_outs   FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY "allow_all_nhf_ins"    ON nhf_ins    FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY "allow_all_nhf_outs"   ON nhf_outs   FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY "allow_all_reports"    ON reports    FOR ALL TO anon USING (true) WITH CHECK (true);

-- ============================================================
--  완료! 이제 앱에서 데이터를 저장할 수 있습니다.
-- ============================================================
